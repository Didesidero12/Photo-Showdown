import { describe, test, expect, beforeAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";

const admin = getSupabaseAdmin();

describe("Analytics Concurrency", () => {
  let sessionId: string;
  let teacherId: string;

  beforeAll(async () => {
    // 1. Create a dummy user to act as the authenticated caller
    teacherId = crypto.randomUUID();
    await admin.auth.admin.createUser({
      id: teacherId,
      email: `teacher_concurrency_${teacherId}@test.com`,
      email_confirm: true,
      password: "password123",
      user_metadata: { role: "teacher" },
    });
    
    await admin.from("profiles").insert({ id: teacherId, display_name: "Dummy Teacher", profile_complete: true });

    const { data: org } = await admin.from("organizations").select("id").eq("slug", "seed-a").single();
    
    const { data: cls, error: cErr } = await admin.from("classes").insert({
      organization_id: org!.id,
      teacher_id: teacherId,
      name: "Concurrency Test Class",
      class_code: ("C" + crypto.randomBytes(2).toString("hex")).substring(0, 6).toUpperCase()
    }).select("id").single();
    if (cErr) throw cErr;
    const classId = cls!.id;

    const { data: assignment, error: aErr } = await admin.from("assignments").insert({
      organization_id: org!.id,
      class_id: classId,
      teacher_id: teacherId,
      title: "Concurrency Test",
      status: "submission_review",
      share_token: "CONC_TOKEN_" + crypto.randomUUID()
    }).select("id").single();
    if (aErr) throw aErr;
    const assignmentId = assignment!.id;

    sessionId = crypto.randomUUID();
    const { error: sErr } = await admin.from("showdown_sessions").insert({
      id: sessionId,
      assignment_id: assignmentId,
      teacher_id: teacherId,
      status: "active",
      lens_type: "lighting"
    });
    if (sErr) throw sErr;
  });

  test("Simultaneous updates to pilot_analytics do not lose increments", async () => {
    // We will fire 50 concurrent requests to increment "missing_notice"
    const NUM_REQUESTS = 50;

    // We must call the RPC using an authenticated client or admin.
    // For this test, we can use the admin client because the RPC has SECURITY DEFINER 
    // and checks `auth.uid() IS NULL`. 
    // Wait, the RPC specifically checks `auth.uid() IS NULL`. Admin client uses service role which might have auth.uid() = null.
    // Let's create an authenticated client.
    // We will use the Seed Teacher A client to hit the RPC
    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const authRes = await client.auth.signInWithPassword({ email: `teacher_concurrency_${teacherId}@test.com`, password: "password123" });
    if (authRes.error) throw authRes.error;
    console.log("Logged in UID:", authRes.data.user.id);

    const promises = [];
    for (let i = 0; i < NUM_REQUESTS; i++) {
      promises.push(
        client.rpc("increment_session_coaching_trigger", {
          p_session_id: sessionId,
          p_trigger_type: "missing_notice"
        })
      );
    }

    // Fire all at the same time
    await Promise.all(promises);

    // Fetch the final value
    const { data: session } = await admin.from("showdown_sessions").select("pilot_analytics").eq("id", sessionId).single();
    
    console.log("SESSION ANALYTICS:", session?.pilot_analytics);
    expect(session).toBeDefined();
    expect(session!.pilot_analytics).toBeDefined();
    expect(session!.pilot_analytics.coaching_triggers.missing_notice).toBe(NUM_REQUESTS);
  });
});
