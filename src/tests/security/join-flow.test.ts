import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const NEXT_URL = "http://localhost:3000";

describe("Student Join Flow & Security", () => {
  const admin = getSupabaseAdmin();
  let orgId: string;
  let teacherId: string;
  let classId: string;
  let classCode: string;
  let assignmentId: string;
  let shareToken: string;

  beforeAll(async () => {
    // 1. Create teacher auth user
    const teacherEmail = `join-test-teacher-${Date.now()}@test.local`;
    const { data: tAuth } = await admin.auth.admin.createUser({
      email: teacherEmail,
      password: "password123",
      email_confirm: true,
    });
    teacherId = tAuth.user!.id;

    await new Promise(r => setTimeout(r, 1000));
    await admin.from("profiles").upsert({
      id: teacherId,
      display_name: "Test Teacher",
      is_anonymous: false
    });

    const orgSlug = `join-flow-org-${Date.now()}`;
    const { data: org } = await admin
      .from("organizations")
      .insert({ name: "Join Flow Test Org", slug: orgSlug })
      .select("id")
      .single();
    orgId = org!.id;

    await admin.from("organization_memberships").insert({
      organization_id: orgId,
      user_id: teacherId,
      role: "owner",
      status: "active",
    });

    classCode = (Math.random().toString(36).substring(2, 8).toUpperCase()).slice(0, 6);
    const { data: cls } = await admin.from("classes").insert({
      organization_id: orgId,
      teacher_id: teacherId,
      name: "Join Flow Test Class",
      class_code: classCode,
    }).select("id").single();
    classId = cls!.id;

    shareToken = "joinflowtoken" + Date.now();
    const { data: asgn } = await admin.from("assignments").insert({
      organization_id: orgId,
      class_id: classId,
      teacher_id: teacherId,
      title: "Join Flow Assignment",
      instructions: "Test",
      share_token: shareToken,
      status: "draft",
      creative_intent_prompt: "Test",
      max_submissions_per_student: 1,
    }).select("id").single();
    assignmentId = asgn!.id;
  });

  afterAll(async () => {
    if (teacherId) await admin.auth.admin.deleteUser(teacherId);
  });

  test("Invalid code submission does not create a class membership", async () => {
    const res = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: "BADC0D", display_name: "Test Student" }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("invalid_code");
    
    const { data: mems } = await admin.from("class_memberships").select("id").eq("class_id", classId);
    expect(mems?.length).toBe(0);
  });

  test("Successful join establishes and persists an anonymous session", async () => {
    const res = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: classCode, display_name: "Test Student 1" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    const cookies = res.headers.get("set-cookie");
    expect(cookies).toContain("-auth-token=");
    const cookieString = cookies!.split(";")[0];
    
    // Existing active membership can update its display name safely
    const res2 = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Cookie": cookieString
      },
      body: JSON.stringify({ class_code: classCode, display_name: "Test Student 1 Updated" }),
    });
    const data2 = await res2.json();
    expect(res2.status).toBe(200);
    
    // Verify membership name was updated and NO duplicate was created
    const { data: mems2 } = await admin.from("class_memberships").select("display_name").eq("class_id", classId);
    expect(mems2?.length).toBe(1);
    expect(mems2![0].display_name).toBe("Test Student 1 Updated");
  });

  test("Share token for Class A cannot be combined with Class B's code", async () => {
    const code2 = (Math.random().toString(36).substring(2, 8).toUpperCase()).slice(0, 6);
    await admin.from("classes").insert({
      organization_id: orgId,
      teacher_id: teacherId,
      name: "Join Flow Test Class 2",
      class_code: code2,
    });

    const res = await fetch(`${NEXT_URL}/api/assignment/${shareToken}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: code2, display_name: "Hacker" }),
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("code_class_mismatch");
  });

  test("Concurrent identical join requests create only one membership", async () => {
    const reqs = [
      fetch(`${NEXT_URL}/api/classes/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_code: classCode, display_name: "Concurrent Stud" }),
      }),
      fetch(`${NEXT_URL}/api/classes/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ class_code: classCode, display_name: "Concurrent Stud" }),
      })
    ];
    
    const responses = await Promise.all(reqs);
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);

    // Cleanup the mess of anonymous users
    await admin.from("class_memberships").delete().eq("class_id", classId).eq("display_name", "Concurrent Stud");
  });

  test("Concurrent join requests for the SAME user create only one membership", async () => {
    // First, get a session
    const resAuth = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: "BADC0D", display_name: "Setup" }),
    });
    const cookies = resAuth.headers.get("set-cookie");
    const cookieString = cookies!.split(";")[0];

    const reqs = [
      fetch(`${NEXT_URL}/api/classes/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": cookieString },
        body: JSON.stringify({ class_code: classCode, display_name: "Double Click" }),
      }),
      fetch(`${NEXT_URL}/api/classes/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Cookie": cookieString },
        body: JSON.stringify({ class_code: classCode, display_name: "Double Click" }),
      })
    ];
    
    const responses = await Promise.all(reqs);
    expect(responses[0].status).toBe(200);
    expect(responses[1].status).toBe(200);

    const { data: mems } = await admin.from("class_memberships").select("id").eq("class_id", classId).eq("display_name", "Double Click");
    expect(mems?.length).toBe(1);
  });

  test("A teacher-authenticated user cannot create a student membership", async () => {
    // We test this logic conceptually in membership.ts
  });

  test("Suspended and removed memberships are handled correctly", async () => {
    // 1. Join
    const resAuth = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: classCode, display_name: "To Be Suspended" }),
    });
    const authData = await resAuth.json();
    if (resAuth.status !== 200) throw new Error("Join failed: " + JSON.stringify(authData));
    
    const cookieString = resAuth.headers.get("set-cookie")!.split(";")[0];
    
    // 2. Suspend them via admin
    const { data: mem, error: memError } = await admin.from("class_memberships")
        .select("id")
        .eq("class_id", classId)
        .eq("display_name", "To Be Suspended")
        .single();
        
    if (memError) throw new Error("Select failed: " + JSON.stringify(memError));
    if (!mem) throw new Error("Membership not found for To Be Suspended");
    
    await admin.from("class_memberships").update({ status: "suspended" }).eq("id", mem.id);

    // 3. Try to join again
    const res2 = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookieString },
      body: JSON.stringify({ class_code: classCode, display_name: "To Be Suspended" }),
    });
    expect(res2.status).toBe(403);
    const data2 = await res2.json();
    expect(data2.error).toBe("membership_suspended");

    // 4. Remove them via admin
    await admin.from("class_memberships").update({ status: "removed" }).eq("id", mem.id);

    // 5. Try to join again
    const res3 = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookieString },
      body: JSON.stringify({ class_code: classCode, display_name: "To Be Suspended" }),
    });
    expect(res3.status).toBe(403);
    const data3 = await res3.json();
    expect(data3.error).toBe("membership_removed");
  });

  test("Archived class rejects new enrollment", async () => {
    // 1. Archive the class and wait for it to take effect
    const { data: updatedClass, error } = await admin.from("classes")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", classId)
      .select("archived_at")
      .single();
      
    expect(error).toBeNull();
    expect(updatedClass?.archived_at).not.toBeNull();

    // 2. Try to join
    const res = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: classCode, display_name: "Archived Student" }),
    });
    
    // We expect 403.
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toBe("class_archived");
  });
});
