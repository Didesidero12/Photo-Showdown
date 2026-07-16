import { describe, test, expect, beforeAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

const admin = getSupabaseAdmin();

describe("Waiting Room Participation State", () => {
  let teacherId: string;
  let otherTeacherId: string;
  let studentId: string;
  let sessionId: string;
  let membershipId: string;

  beforeAll(async () => {
    teacherId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: teacherId, email: `t_${teacherId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: teacherId, display_name: "Teacher", profile_complete: true });

    otherTeacherId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: otherTeacherId, email: `ot_${otherTeacherId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: otherTeacherId, display_name: "Other Teacher", profile_complete: true });

    studentId = crypto.randomUUID();
    await admin.auth.admin.createUser({ id: studentId, email: `s_${studentId}@test.com`, password: "password123", email_confirm: true });
    await admin.from("profiles").insert({ id: studentId, display_name: "Student", profile_complete: true });

    const { data: org } = await admin.from("organizations").select("id").eq("slug", "seed-a").single();
    
    const { data: cls } = await admin.from("classes").insert({
      organization_id: org!.id,
      teacher_id: teacherId,
      name: "Waiting Room Class",
      class_code: ("W" + crypto.randomBytes(2).toString("hex")).substring(0, 6).toUpperCase()
    }).select("id").single();
    const classId = cls!.id;

    const { data: assignment } = await admin.from("assignments").insert({
      organization_id: org!.id,
      class_id: classId,
      teacher_id: teacherId,
      title: "Waiting Room Test",
      status: "submission_review",
      share_token: "WAIT_" + crypto.randomUUID()
    }).select("id").single();
    const assignmentId = assignment!.id;

    sessionId = crypto.randomUUID();
    await admin.from("showdown_sessions").insert({
      id: sessionId,
      assignment_id: assignmentId,
      teacher_id: teacherId,
      status: "active",
      lens_type: "lighting"
    });

    membershipId = crypto.randomUUID();
    await admin.from("class_memberships").insert({
      id: membershipId,
      class_id: classId,
      student_id: studentId,
      display_name: "Test Student",
      status: "active"
    });
  });

  test("Session teacher can grant override", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    const authRes = await client.auth.signInWithPassword({ email: `t_${teacherId}@test.com`, password: "password123" });
    expect(authRes.error).toBeNull();

    const { error } = await client.from("session_participations").upsert({
      session_id: sessionId,
      class_membership_id: membershipId,
      override_active: true,
      override_reason: "Test",
      override_actor_id: teacherId
    });
    
    expect(error).toBeNull();

    const { data } = await admin.from("session_participations").select("override_active").eq("session_id", sessionId).eq("class_membership_id", membershipId).single();
    expect(data?.override_active).toBe(true);
  });

  test("Other teacher cannot grant override", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    const authRes = await client.auth.signInWithPassword({ email: `ot_${otherTeacherId}@test.com`, password: "password123" });
    expect(authRes.error).toBeNull();

    const { error } = await client.from("session_participations").upsert({
      session_id: sessionId,
      class_membership_id: membershipId,
      override_active: false,
      override_reason: "Hacked",
      override_actor_id: otherTeacherId
    });
    
    expect(error).not.toBeNull();

    // Verify it is still active
    const { data } = await admin.from("session_participations").select("override_active").eq("session_id", sessionId).eq("class_membership_id", membershipId).single();
    expect(data?.override_active).toBe(true);
  });

  test("Student can read their own participation state", async () => {
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false }
    });
    const authRes = await client.auth.signInWithPassword({ email: `s_${studentId}@test.com`, password: "password123" });
    expect(authRes.error).toBeNull();

    const { data, error } = await client.from("session_participations")
      .select("override_active")
      .eq("session_id", sessionId)
      .eq("class_membership_id", membershipId)
      .single();
    
    expect(error).toBeNull();
    expect(data?.override_active).toBe(true);
  });
});
