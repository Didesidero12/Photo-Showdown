import { describe, test, expect, beforeAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

const admin = getSupabaseAdmin();

describe("Moderation RPC", () => {
  let teacherId: string;
  let otherTeacherId: string;
  let studentId: string;
  let critiqueId: string;

  beforeAll(async () => {
    teacherId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: teacherId, email: `t_a_${teacherId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: teacherId, display_name: "Seed Teacher A", profile_complete: true });

    otherTeacherId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: otherTeacherId, email: `t_b_${otherTeacherId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: otherTeacherId, display_name: "Seed Teacher B", profile_complete: true });

    studentId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: studentId, email: `s_${studentId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: studentId, display_name: "Student", profile_complete: true });

    const { data: org } = await admin.from("organizations").select("id").eq("slug", "seed-a").single();
    
    const { data: cls } = await admin.from("classes").insert({
      organization_id: org!.id,
      teacher_id: teacherId,
      name: "Moderation Test Class",
      class_code: ("M" + crypto.randomBytes(2).toString("hex")).substring(0, 6).toUpperCase()
    }).select("id").single();
    const classId = cls!.id;

    const { data: assignment } = await admin.from("assignments").insert({
      organization_id: org!.id,
      class_id: classId,
      teacher_id: teacherId,
      title: "Moderation Test",
      status: "submission_review",
      share_token: "MOD_TOKEN_" + crypto.randomUUID()
    }).select("id").single();
    const assignmentId = assignment!.id;

    const sessionId = crypto.randomUUID();
    await admin.from("showdown_sessions").insert({
      id: sessionId,
      assignment_id: assignmentId,
      teacher_id: teacherId,
      status: "active",
      lens_type: "lighting"
    });

    const submitterAId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: submitterAId, email: `a_${submitterAId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: submitterAId, display_name: "Submitter A", profile_complete: true });

    const membershipAId = crypto.randomUUID();
    const { error: cmErrA } = await admin.from("class_memberships").insert({
      id: membershipAId,
      class_id: classId,
      student_id: submitterAId, 
      display_name: "Test Submitter A",
      status: "active"
    });
    if (cmErrA) throw cmErrA;

    const submitterBId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: submitterBId, email: `b_${submitterBId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: submitterBId, display_name: "Submitter B", profile_complete: true });

    const membershipBId = crypto.randomUUID();
    const { error: cmErrB } = await admin.from("class_memberships").insert({
      id: membershipBId,
      class_id: classId,
      student_id: submitterBId, 
      display_name: "Test Submitter B",
      status: "active"
    });
    if (cmErrB) throw cmErrB;

    const criticId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: criticId, email: `c_${criticId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: criticId, display_name: "Dummy Critic", profile_complete: true });

    const criticMembershipId = crypto.randomUUID();
    const { error: cmErrC } = await admin.from("class_memberships").insert({
      id: criticMembershipId,
      class_id: classId,
      student_id: criticId, 
      display_name: "Test Critic",
      status: "active"
    });
    if (cmErrC) throw cmErrC;

    const subAId = crypto.randomUUID();
    const { error: saErr } = await admin.from("submissions").insert({
      id: subAId,
      organization_id: org!.id,
      assignment_id: assignmentId,
      class_membership_id: membershipAId,
      storage_path_raw: "fake",
      storage_path_processed: "fake",
      status: "approved",
      creative_intent: "Intent A"
    });
    if (saErr) throw saErr;

    const subBId = crypto.randomUUID();
    const { error: sbErr } = await admin.from("submissions").insert({
      id: subBId,
      organization_id: org!.id,
      assignment_id: assignmentId,
      class_membership_id: membershipBId,
      storage_path_raw: "fake",
      storage_path_processed: "fake",
      status: "approved",
      creative_intent: "Intent B"
    });
    if (sbErr) throw sbErr;

    const { error: ssErr } = await admin.from("session_submissions").insert([
      { session_id: sessionId, submission_id: subAId },
      { session_id: sessionId, submission_id: subBId }
    ]);
    if (ssErr) throw ssErr;

    const matchupId = crypto.randomUUID();
    const { error: mErr } = await admin.from("matchups").insert({
      id: matchupId,
      session_id: sessionId,
      submission_a_id: subAId, 
      submission_b_id: subBId, 
      critic_membership_id: criticMembershipId 
    });
    if (mErr) throw mErr;

    critiqueId = crypto.randomUUID();
    const { error: cErr } = await admin.from("critiques").insert({
      id: critiqueId,
      matchup_id: matchupId,
      selected_submission_id: subAId, 
      notice: "Original Notice",
      effect: "Original Effect",
      lens_type: "lighting"
    });
    if (cErr) throw cErr;
  });

  test("Owner teacher can hide feedback with a reason", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    await client.auth.signInWithPassword({ email: `t_a_${teacherId}@test.com`, password: "password123" });

    // Try to hide without reason
    const { error: noReasonErr } = await client.rpc("toggle_critique_hidden", {
      p_critique_id: critiqueId,
      p_is_hidden: true
    });
    expect(noReasonErr).not.toBeNull();
    expect(noReasonErr?.message).toContain("A reason is required");

    // Hide with reason
    const { error } = await client.rpc("toggle_critique_hidden", {
      p_critique_id: critiqueId,
      p_is_hidden: true,
      p_reason: "Inappropriate"
    });
    expect(error).toBeNull();

    const { data: critique } = await admin.from("critiques").select("is_hidden, hidden_by, hidden_at, hidden_reason, notice, effect").eq("id", critiqueId).single();
    expect(critique?.is_hidden).toBe(true);
    expect(critique?.hidden_by).toBe(teacherId);
    expect(critique?.hidden_reason).toBe("Inappropriate");
    expect(critique?.hidden_at).not.toBeNull();
    // Original text is preserved
    expect(critique?.notice).toBe("Original Notice");
  });

  test("Owner teacher can unhide feedback", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    await client.auth.signInWithPassword({ email: `t_a_${teacherId}@test.com`, password: "password123" });

    const { error } = await client.rpc("toggle_critique_hidden", {
      p_critique_id: critiqueId,
      p_is_hidden: false
    });
    expect(error).toBeNull();

    const { data: critique } = await admin.from("critiques").select("is_hidden, hidden_reason, unhidden_by, unhidden_at").eq("id", critiqueId).single();
    expect(critique?.is_hidden).toBe(false);
    expect(critique?.hidden_reason).toBe("Inappropriate"); // Prior reason preserved
    expect(critique?.unhidden_by).toBe(teacherId);
    expect(critique?.unhidden_at).not.toBeNull();
  });

  test("Non-owner teacher cannot hide feedback", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    const authRes = await client.auth.signInWithPassword({ email: `t_b_${otherTeacherId}@test.com`, password: "password123" });
    expect(authRes.error).toBeNull();

    const { error } = await client.rpc("toggle_critique_hidden", {
      p_critique_id: critiqueId,
      p_is_hidden: true,
      p_reason: "Hacked"
    });
    
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Unauthorized");
  });

  test("Student cannot hide feedback", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    const authRes = await client.auth.signInWithPassword({ email: `s_${studentId}@test.com`, password: "password123" });
    expect(authRes.error).toBeNull();

    const { error } = await client.rpc("toggle_critique_hidden", {
      p_critique_id: critiqueId,
      p_is_hidden: true,
      p_reason: "Haha"
    });
    
    expect(error).not.toBeNull();
    expect(error?.message).toContain("Unauthorized");
  });

  test("Anonymous user cannot execute RPC", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    // Do not sign in

    const { error } = await client.rpc("toggle_critique_hidden", {
      p_critique_id: critiqueId,
      p_is_hidden: true,
      p_reason: "Anon"
    });
    
    expect(error).not.toBeNull();
    expect(error?.message).toContain("permission denied"); // or unauthorized
  });
});
