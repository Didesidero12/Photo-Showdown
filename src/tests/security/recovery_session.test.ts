import { describe, test, expect, beforeAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const PEPPER = process.env.RECOVERY_PEPPER || "test-pepper-123";

describe("Milestone 3: Recovery During Active Session", () => {
  const admin = getSupabaseAdmin();
  let student1MemId: string;
  let oldStudentClient: any;
  let newStudentClient: any;
  let sessionId: string;
  let matchupId: string;
  let recoveryCodePlain: string;

  beforeAll(async () => {
    // 1. Setup Class, Assignment, Teacher
    const { data: teacher } = await admin.from("profiles").select("id").eq("display_name", "Seed Teacher A").single();
    const teacherId = teacher!.id;

    const { data: org } = await admin.from("organizations").select("id").eq("slug", "seed-a").single();
    
    const { data: cls } = await admin.from("classes").insert({
      organization_id: org!.id,
      teacher_id: teacherId,
      name: "Recovery Session Class",
      class_code: ("RC" + crypto.randomBytes(2).toString("hex")).substring(0, 6).toUpperCase()
    }).select("id").single();
    
    const { data: assignment, error: assErr } = await admin.from("assignments").insert({
      organization_id: org!.id,
      class_id: cls!.id,
      teacher_id: teacherId,
      title: "Recovery Active Critique",
      status: "submission_review",
      share_token: "REC_" + crypto.randomUUID()
    }).select("id").single();
    if (assErr) console.error(assErr);

    // 2. Setup Student 1 (Old Identity)
    const oldUid = crypto.randomUUID();
    const oldEmail = `old_rec_${crypto.randomBytes(4).toString("hex")}@test.local`;
    await admin.auth.admin.createUser({ id: oldUid, email: oldEmail, password: "password", email_confirm: true });
    await admin.from("profiles").insert({ id: oldUid, display_name: "Recovery Student", profile_complete: true });
    
    const { data: mem } = await admin.from("class_memberships").insert({
      class_id: cls!.id,
      student_id: oldUid,
      display_name: "Recovery Student",
      status: "active"
    }).select("id").single();
    student1MemId = mem!.id;

    oldStudentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await oldStudentClient.auth.signInWithPassword({ email: oldEmail, password: "password" });

    // 3. Setup Session
    const { data: session } = await admin.from("showdown_sessions").insert({
      assignment_id: assignment!.id,
      teacher_id: teacherId,
      status: "active"
    }).select("id").single();
    sessionId = session!.id;

    // 4. Create Participation and Override
    await admin.from("session_participations").insert({
      session_id: sessionId,
      class_membership_id: student1MemId,
      override_active: true,
      override_reason: "Testing Recovery"
    });

    // To bypass the check trigger: we need them to belong to DIFFERENT students.
    // Let's create 2 dummy students
    const dummy2Uid = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: dummy2Uid, email: `d2_${crypto.randomBytes(4).toString("hex")}@test.local`, password: "password", email_confirm: true });
    await admin.from("profiles").insert({ id: dummy2Uid, display_name: "D2", profile_complete: true });
    const res2 = await admin.from("class_memberships").insert({class_id: cls!.id, student_id: dummy2Uid, display_name: "D2", status: "active"}).select("id").single();
    if (res2.error) throw new Error(JSON.stringify(res2.error));
    const dummyMem2 = res2.data;

    const dummy3Uid = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: dummy3Uid, email: `d3_${crypto.randomBytes(4).toString("hex")}@test.local`, password: "password", email_confirm: true });
    await admin.from("profiles").insert({ id: dummy3Uid, display_name: "D3", profile_complete: true });
    const res3 = await admin.from("class_memberships").insert({class_id: cls!.id, student_id: dummy3Uid, display_name: "D3", status: "active"}).select("id").single();
    if (res3.error) throw new Error(JSON.stringify(res3.error));
    const dummyMem3 = res3.data;

    const resSub2 = await admin.from("submissions").insert({
      organization_id: org!.id, assignment_id: assignment!.id, class_membership_id: dummyMem2.id, status: "approved", processing_status: "ready", creative_intent: "T", storage_path_processed: "t.jpg"
    }).select("id").single();
    if (resSub2.error) console.error("Sub2 err", resSub2.error);
    const sub2 = resSub2.data;

    const resSub3 = await admin.from("submissions").insert({
      organization_id: org!.id, assignment_id: assignment!.id, class_membership_id: dummyMem3.id, status: "approved", processing_status: "ready", creative_intent: "T", storage_path_processed: "t.jpg"
    }).select("id").single();
    if (resSub3.error) console.error("Sub3 err", resSub3.error);
    const sub3 = resSub3.data;

    await admin.from("session_submissions").insert([{ session_id: sessionId, submission_id: sub2!.id }, { session_id: sessionId, submission_id: sub3!.id }]);

    const { data: matchup } = await admin.from("matchups").insert({
      session_id: sessionId,
      critic_membership_id: student1MemId,
      submission_a_id: sub2!.id,
      submission_b_id: sub3!.id
    }).select("id").single();
    matchupId = matchup!.id;

    // 6. Generate Recovery Code
    recoveryCodePlain = "TEST" + crypto.randomBytes(2).toString("hex").toUpperCase();
    const hash = crypto.createHmac("sha256", PEPPER).update(recoveryCodePlain).digest("hex");
    
    const rcRes = await admin.from("recovery_codes").insert({
      class_membership_id: student1MemId,
      created_by: teacherId,
      code_hash: hash,
      expires_at: new Date(Date.now() + 3600000).toISOString()
    });
    if (rcRes.error) console.error("RC insert error:", rcRes.error);

    // 7. Setup New Identity
    const newUid = crypto.randomUUID();
    const newEmail = `new_rec_${crypto.randomBytes(4).toString("hex")}@test.local`;
    await admin.auth.admin.createUser({ id: newUid, email: newEmail, password: "password", email_confirm: true });
    await admin.from("profiles").insert({ id: newUid, display_name: "Anon Device 2", profile_complete: true });

    newStudentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    await newStudentClient.auth.signInWithPassword({ email: newEmail, password: "password" });
  });

  test("Old identity has access to matchup", async () => {
    const { data } = await oldStudentClient.from("matchups").select("id").eq("id", matchupId);
    expect(data).toHaveLength(1);
  });

  test("New identity does not have access initially", async () => {
    const { data } = await newStudentClient.from("matchups").select("id").eq("id", matchupId);
    expect(data).toHaveLength(0);
  });

  test("Claim recovery code via RPC", async () => {
    const hash = crypto.createHmac("sha256", PEPPER).update(recoveryCodePlain).digest("hex");
    const { data, error } = await newStudentClient.rpc("claim_recovery_code", {
      provided_code_hash: hash
    });
    expect(error).toBeNull();
    expect(data).toEqual({ ok: true });
  });

  test("New identity now has access to matchup", async () => {
    const { data } = await newStudentClient.from("matchups").select("id").eq("id", matchupId);
    expect(data).toHaveLength(1);
  });

  test("Old identity lost access", async () => {
    const { data } = await oldStudentClient.from("matchups").select("id").eq("id", matchupId);
    expect(data).toHaveLength(0);
  });

  test("Participation and Overrides remained attached to membership", async () => {
    const { data: parts } = await admin.from("session_participations").select("*").eq("session_id", sessionId).eq("class_membership_id", student1MemId);
    expect(parts).toHaveLength(1);
    expect(parts![0].override_active).toBe(true);
  });
});
