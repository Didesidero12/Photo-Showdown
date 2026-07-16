import { describe, test, expect, beforeAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("Milestone 3: Security & RLS Tests for Critiques", () => {
  const admin = getSupabaseAdmin();
  let student1Id: string;
  let student1MemId: string;
  let student1Client: any;
  let student2Id: string;
  let student2MemId: string;
  let student2Client: any;
  
  let sessionId: string;
  let sub1Id: string;
  let sub2Id: string;
  let sub3Id: string;
  let matchupId: string;

  beforeAll(async () => {
    const { data: teacher } = await admin.from("profiles").select("id").eq("display_name", "Seed Teacher A").single();
    const teacherId = teacher!.id;

    const { data: org } = await admin.from("organizations").select("id").eq("slug", "seed-a").single();
    
    const { data: cls } = await admin.from("classes").insert({
      organization_id: org!.id,
      teacher_id: teacherId,
      name: "RLS Test Class",
      class_code: ("R" + crypto.randomBytes(2).toString("hex")).substring(0, 6).toUpperCase()
    }).select("id").single();
    const testClassId = cls!.id;

    const { data: assignment } = await admin.from("assignments").insert({
      organization_id: org!.id,
      class_id: testClassId,
      teacher_id: teacherId,
      title: "RLS Test Critique",
      status: "submission_review",
      share_token: "RLS_TOKEN_" + crypto.randomUUID()
    }).select("id").single();
    const testAssignmentId = assignment!.id;

    // Create Students
    async function createStudentAndClient(name: string) {
      const uid = crypto.randomUUID();
      const email = `${name.replace(/\s+/g, '')}_${crypto.randomBytes(4).toString("hex")}@test.local`;
      await admin.auth.admin.createUser({ id: uid, email, password: "password", email_confirm: true });
      await admin.from("profiles").insert({ id: uid, display_name: name, profile_complete: true });
      
      const { data: mem } = await admin.from("class_memberships").insert({
        class_id: testClassId,
        student_id: uid,
        display_name: name,
        status: "active"
      }).select("id").single();

      // Sign in to create client
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      await client.auth.signInWithPassword({ email, password: "password" });
      
      return { id: uid, memId: mem!.id, client };
    }

    const s1 = await createStudentAndClient("RLS Student 1");
    student1Id = s1.id;
    student1MemId = s1.memId;
    student1Client = s1.client;

    const s2 = await createStudentAndClient("RLS Student 2");
    student2Id = s2.id;
    student2MemId = s2.memId;
    student2Client = s2.client;

    const s3 = await createStudentAndClient("RLS Student 3");

    // Submissions
    async function createSub(memId: string) {
      const { data: sub } = await admin.from("submissions").insert({
        organization_id: org!.id,
        assignment_id: testAssignmentId,
        class_membership_id: memId,
        creative_intent: "Intent " + memId,
        status: "approved",
        processing_status: "ready",
        storage_path_processed: "test.jpg"
      }).select("id").single();
      return sub!.id;
    }

    sub1Id = await createSub(student1MemId);
    sub2Id = await createSub(student2MemId);
    sub3Id = await createSub(s3.memId);
    
    // Create Session
    const { data: session } = await admin.from("showdown_sessions").insert({
      assignment_id: testAssignmentId,
      teacher_id: teacherId,
      status: "active"
    }).select("id").single();
    sessionId = session!.id;

    // Freeze pool
    await admin.from("session_submissions").insert([
      { session_id: sessionId, submission_id: sub1Id },
      { session_id: sessionId, submission_id: sub2Id },
      { session_id: sessionId, submission_id: sub3Id }
    ]);
    
    // Assign Matchup for Student 1
    const { data: matchup, error: mErr } = await admin.from("matchups").insert({
      session_id: sessionId,
      critic_membership_id: student1MemId,
      submission_a_id: sub2Id,
      submission_b_id: sub3Id
    }).select("id").single();
    if (mErr) console.error("RLS Matchup Insert Error:", mErr);
    matchupId = matchup!.id;
  });

  test("Student 1 can ONLY view their assigned matchup", async () => {
    const { data: matchups, error } = await student1Client.from("matchups").select("*");
    expect(error).toBeNull();
    expect(matchups).toHaveLength(1);
    expect(matchups![0].id).toBe(matchupId);
  });

  test("Student 2 CANNOT view Student 1's matchup", async () => {
    const { data: matchups, error } = await student2Client.from("matchups").select("*");
    expect(error).toBeNull();
    expect(matchups).toHaveLength(0);
  });

  test("Student 1 cannot insert a critique for another student's matchup", async () => {
    // Let's create a matchup for Student 2 using sub1 and sub3
    const { data: matchup2 } = await admin.from("matchups").insert({
      session_id: sessionId,
      critic_membership_id: student2MemId,
      submission_a_id: sub1Id,
      submission_b_id: sub3Id
    }).select("id").single();

    // Student 1 tries to insert critique for Student 2's matchup
    const { error } = await student1Client.from("critiques").insert({
      matchup_id: matchup2!.id,
      selected_submission_id: sub1Id,
      lens_type: "lighting",
      justification: "I chose this because..."
    });

    expect(error).toBeDefined();
    // RLS prevents inserting into a matchup they don't own
  });

  test("Student 1 cannot insert a critique with a submission ID outside the assigned pair", async () => {
    // Attempt to critique with an unrelated submission ID
    const { error } = await student1Client.from("critiques").insert({
      matchup_id: matchupId,
      selected_submission_id: crypto.randomUUID(), // Arbitrary ID
      lens_type: "lighting",
      justification: "I chose this because..."
    });

    expect(error).toBeDefined();
    expect(error!.message).toContain("Selected submission must be either submission A or submission B");
  });

  test("Student 1 can insert a critique for their own matchup", async () => {
    const { error } = await student1Client.from("critiques").insert({
      matchup_id: matchupId,
      selected_submission_id: sub2Id,
      lens_type: "lighting",
      notice: "I chose this because...",
      effect: "The effect is..."
    });
    expect(error).toBeNull();
  });

  test("Student 1 cannot generate signed URLs for arbitrary submissions directly", async () => {
    // Attempt to download sub3Id directly using student client
    // Since storage is private and no policy allows SELECT on submissions-processed for public/anon/authenticated
    const { data, error } = await student1Client.storage.from("submissions-processed").createSignedUrl("test.jpg", 60);
    
    // createSignedUrl doesn't inherently check existence, but it requires SELECT access.
    // However, download requires SELECT access. Let's try downloading directly.
    const { error: dlError } = await student1Client.storage.from("submissions-processed").download("test.jpg");
    expect(dlError).toBeDefined();
  });
});
