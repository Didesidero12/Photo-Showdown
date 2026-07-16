import { describe, test, expect, beforeAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

const NEXT_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

describe("Milestone 2.6: Critique Logic", () => {
  const admin = getSupabaseAdmin();
  let testClassId: string;
  let testAssignmentId: string;
  let teacherId: string;
  let student1MemId: string;
  let student2MemId: string;
  let student3MemId: string;

  let sub1Id: string;
  let sub2Id: string;
  let sub3Id: string;
  
  let sessionId: string;

  beforeAll(async () => {
    // 1. Get teacher
    const { data: teacher } = await admin.from("profiles").select("id").eq("display_name", "Seed Teacher A").single();
    teacherId = teacher!.id;

    // 2. Create Class
    const { data: org } = await admin.from("organizations").select("id").eq("slug", "seed-a").single();
    const { data: cls, error: clsErr } = await admin.from("classes").insert({
      organization_id: org!.id,
      teacher_id: teacherId,
      name: "Critique Test Class",
      class_code: ("CR" + crypto.randomBytes(2).toString("hex")).substring(0, 6).toUpperCase()
    }).select("id").single();
    if (clsErr) console.error("Class Error:", clsErr);
    testClassId = cls!.id;

    // 3. Create Assignment
    const { data: assignment } = await admin.from("assignments").insert({
      organization_id: org!.id,
      class_id: testClassId,
      teacher_id: teacherId,
      title: "Test Critique Assignment",
      status: "submission_review",
      share_token: "TEST_CRIT_TOKEN_" + crypto.randomUUID()
    }).select("id").single();
    testAssignmentId = assignment!.id;

    // 4. Create Students and Memberships
    async function createStudent(name: string) {
      const uid = crypto.randomUUID();
      const nonce = crypto.randomBytes(4).toString("hex");
      const { data: user, error: authErr } = await admin.auth.admin.createUser({ email: `${name.replace(/\s+/g, '')}_${nonce}@test.local`, password: "password", email_confirm: true });
      if (authErr) console.error("Auth Error:", authErr);
      const actualUid = user!.user.id;
      
      await admin.from("profiles").insert({ id: actualUid, display_name: name, profile_complete: true });
      const { data: mem, error } = await admin.from("class_memberships").insert({
        class_id: testClassId,
        student_id: actualUid,
        display_name: name,
        status: "active"
      }).select("id").single();
      if (error) console.error("CreateStudent Error:", error);
      return mem!.id;
    }

    student1MemId = await createStudent("Critique Student 1");
    student2MemId = await createStudent("Critique Student 2");
    student3MemId = await createStudent("Critique Student 3");

    // 5. Create Submissions
    async function createSub(memId: string) {
      const { data: sub, error } = await admin.from("submissions").insert({
        organization_id: org!.id,
        assignment_id: testAssignmentId,
        class_membership_id: memId,
        creative_intent: "My intent",
        status: "approved",
        processing_status: "ready",
        storage_path_processed: "test.jpg"
      }).select("id").single();
      if (error) console.error("CreateSub Error:", error);
      return sub!.id;
    }

    sub1Id = await createSub(student1MemId);
    sub2Id = await createSub(student2MemId);
    sub3Id = await createSub(student3MemId);
    
    // 6. Create Session & Freeze Pool
    const { data: session } = await admin.from("showdown_sessions").insert({
      assignment_id: testAssignmentId,
      teacher_id: teacherId,
      status: "active"
    }).select("id").single();
    sessionId = session!.id;
    
    await admin.from("session_submissions").insert([
      { session_id: sessionId, submission_id: sub1Id },
      { session_id: sessionId, submission_id: sub2Id },
      { session_id: sessionId, submission_id: sub3Id }
    ]);
  });

  test("assign_matchup_rpc pairs correctly and protects constraints", async () => {
    // 1. Assign Matchup for Student 1
    const { data: matchupId, error: rpcErr } = await admin.rpc("assign_matchup_rpc", {
      p_session_id: sessionId,
      p_critic_membership_id: student1MemId
    });
    
    expect(rpcErr).toBeNull();
    expect(matchupId).toBeDefined();

    // 2. Refresh returns the exact same matchup
    const { data: matchupId2, error: rpcErr2 } = await admin.rpc("assign_matchup_rpc", {
      p_session_id: sessionId,
      p_critic_membership_id: student1MemId
    });
    expect(rpcErr2).toBeNull();
    expect(matchupId2).toBe(matchupId);

    // 3. Verify neither A nor B belong to student 1
    const { data: matchup } = await admin.from("matchups").select("*").eq("id", matchupId).single();
    expect(matchup!.submission_a_id).not.toBe(sub1Id);
    expect(matchup!.submission_b_id).not.toBe(sub1Id);

    // 4. Try to insert self-matchup manually (should fail DB trigger)
    const { error: triggerErr } = await admin.from("matchups").insert({
      session_id: sessionId,
      critic_membership_id: student2MemId,
      submission_a_id: sub2Id,
      submission_b_id: sub1Id
    });
    expect(triggerErr).toBeDefined();
    expect(triggerErr?.message).toContain("Self-critique is not allowed");

    // 5. Submit valid critique
    const { data: critique, error: critErr } = await admin.from("critiques").insert({
      matchup_id: matchup!.id,
      selected_submission_id: matchup!.submission_a_id,
      lens_type: "lighting",
      justification: "This is a valid long specific visual observation critique that passes."
    }).select("id").single();
    expect(critErr).toBeNull();
    expect(critique).toBeDefined();
    
    // Complete matchup
    await admin.from("matchups").update({ completed_at: new Date().toISOString() }).eq("id", matchup!.id);
  });

  test("Give-to-Get logic enforces completion requirement", async () => {
    // Student 1 completed their matchup, Student 2 did not.
    // This matches the logic in our /results route.
    const { data: matchup1 } = await admin
      .from("matchups")
      .select("id, completed_at")
      .eq("session_id", sessionId)
      .eq("critic_membership_id", student1MemId)
      .single();
    
    expect(matchup1!.completed_at).not.toBeNull();

    const { data: matchup2 } = await admin
      .from("matchups")
      .select("id, completed_at")
      .eq("session_id", sessionId)
      .eq("critic_membership_id", student2MemId)
      .maybeSingle();

    expect(matchup2).toBeNull(); // Hasn't even started
  });
});
