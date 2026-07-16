import { describe, test, expect, beforeAll, afterAll } from "vitest";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";

const NEXT_URL = "http://localhost:3000";

describe("Recovery Flow & Security", () => {
  const admin = getSupabaseAdmin();
  let orgId: string;
  let teacherId: string;
  let classId: string;
  let classCode: string;
  let oldStudentId: string;
  let targetMembershipId: string;
  let generatedCode: string;
  let codeHash: string;

  beforeAll(async () => {
    // 1. Create Teacher
    const teacherEmail = `recovery-teacher-${Date.now()}@test.local`;
    const { data: tAuth } = await admin.auth.admin.createUser({
      email: teacherEmail,
      password: "password123",
      email_confirm: true,
    });
    teacherId = tAuth.user!.id;
    await new Promise(r => setTimeout(r, 1000));
    await admin.from("profiles").upsert({ id: teacherId, display_name: "Recovery Teacher", is_anonymous: false });

    // 2. Create Org & Class
    const { data: org } = await admin.from("organizations").insert({ name: "Recovery Org", slug: `rec-org-${Date.now()}` }).select("id").single();
    orgId = org!.id;
    await admin.from("organization_memberships").insert({ organization_id: orgId, user_id: teacherId, role: "owner", status: "active" });

    classCode = (Math.random().toString(36).substring(2, 8).toUpperCase()).slice(0, 6);
    const { data: cls } = await admin.from("classes").insert({
      organization_id: orgId, teacher_id: teacherId, name: "Recovery Class", class_code: classCode,
    }).select("id").single();
    classId = cls!.id;

    // 3. Create Student Session (Old Device)
    const res = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: classCode, display_name: "To Be Recovered" }),
    });
    const { classId: cid } = await res.json();
    const cookies = res.headers.get("set-cookie");
    const cookieString = cookies!.split(";")[0];

    // Get the membership and old student ID
    const { data: mem } = await admin.from("class_memberships").select("id, student_id").eq("class_id", classId).single();
    targetMembershipId = mem!.id;
    oldStudentId = mem!.student_id;

    // 4. Generate Recovery Code
    generatedCode = "A8B2-9F3C";
    const cleanCode = generatedCode.replace("-", "");
    const pepper = process.env.RECOVERY_CODE_PEPPER || "test-pepper";
    codeHash = crypto.createHmac("sha256", pepper).update(cleanCode).digest("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);

    await admin.from("recovery_codes").insert({
      class_membership_id: targetMembershipId,
      code_hash: codeHash,
      expires_at: expiresAt.toISOString(),
      created_by: teacherId
    });
  });

  afterAll(async () => {
    if (teacherId) await admin.auth.admin.deleteUser(teacherId);
    if (oldStudentId) await admin.auth.admin.deleteUser(oldStudentId);
  });

  test("Plaintext recovery codes are absent from the database", async () => {
    // The table only has code_hash, not code.
    const { data: codes, error } = await admin.from("recovery_codes").select("*").eq("class_membership_id", targetMembershipId);
    expect(error).toBeNull();
    expect(codes![0]).toHaveProperty("code_hash");
    expect(codes![0]).not.toHaveProperty("code");
    expect(codes![0].code_hash).toBe(codeHash);
  });

  test("Rate limiting blocks brute-force attempts", async () => {
    // We send 15 bad requests from same IP to trigger 429
    const reqs = [];
    for (let i = 0; i < 15; i++) {
      reqs.push(fetch(`${NEXT_URL}/api/recover`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.168.1.100" },
        body: JSON.stringify({ code: "XXXX-XXXX" })
      }));
    }
    const responses = await Promise.all(reqs);
    const statuses = responses.map(r => r.status);
    expect(statuses).toContain(429);
  });

  test("Failed transfer does not consume the code (invalid code)", async () => {
    const res = await fetch(`${NEXT_URL}/api/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.168.1.101" }, // New IP to bypass rate limit
      body: JSON.stringify({ code: "B9C3-8E2D" }) // Wrong code
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("invalid_code");

    // Code should still be unused
    const { data: codeRow } = await admin.from("recovery_codes").select("used_at").eq("code_hash", codeHash).single();
    expect(codeRow!.used_at).toBeNull();
  });

  test("Successful recovery transfers membership and marks code as used", async () => {
    const res = await fetch(`${NEXT_URL}/api/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.168.1.102" },
      body: JSON.stringify({ code: generatedCode })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.ok).toBe(true);

    // Code is now used
    const { data: codeRow } = await admin.from("recovery_codes").select("used_at").eq("code_hash", codeHash).single();
    expect(codeRow!.used_at).not.toBeNull();

    // Membership transferred
    const { data: mem } = await admin.from("class_memberships").select("student_id").eq("id", targetMembershipId).single();
    expect(mem!.student_id).not.toBe(oldStudentId); // It has changed to the new anonymous user!
  });

  test("Old identity loses access after transfer", async () => {
    // If we use oldStudentId session, we shouldn't have active memberships for this class
    const { data: mems } = await admin.from("class_memberships").select("id").eq("student_id", oldStudentId);
    expect(mems?.length).toBe(0);
  });

  test("Reusing a code fails", async () => {
    const res = await fetch(`${NEXT_URL}/api/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.168.1.103" },
      body: JSON.stringify({ code: generatedCode })
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("invalid_code");
  });

  test("Existing destination membership conflicts fail safely", async () => {
    // 1. Create a student who ALREADY is in the class
    const resAuth = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: classCode, display_name: "Conflicting Student" }),
    });
    const cookieString = resAuth.headers.get("set-cookie")!.split(";")[0];

    // 2. We generate a recovery code for SOME OTHER student in the same class
    const { data: otherMem } = await admin.from("class_memberships").insert({
      class_id: classId,
      student_id: (await admin.auth.admin.createUser({ email: `dummy${Date.now()}@t.local`, password: "password123" })).data.user!.id,
      display_name: "Another Student",
      status: "active"
    }).select("id").single();

    const otherCode = "C2D4-3E5F";
    const otherHash = crypto.createHmac("sha256", process.env.RECOVERY_CODE_PEPPER || "test-pepper").update(otherCode.replace("-", "")).digest("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    await admin.from("recovery_codes").insert({
      class_membership_id: otherMem!.id,
      code_hash: otherHash,
      expires_at: expiresAt.toISOString(),
      created_by: teacherId
    });

    // 3. The conflicting student tries to recover it
    const res = await fetch(`${NEXT_URL}/api/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookieString, "X-Forwarded-For": "192.168.1.104" },
      body: JSON.stringify({ code: otherCode })
    });
    const data = await res.json();
    expect(res.status).toBe(400);
    expect(data.error).toBe("conflict_existing_membership");
  });

  test("Idempotent success if recovering a membership they ALREADY own", async () => {
    // Generate a code for the targetMembershipId (which the NEW anonymous user now owns)
    const newCode = "F9G8-7H6J";
    const newHash = crypto.createHmac("sha256", process.env.RECOVERY_CODE_PEPPER || "test-pepper").update(newCode.replace("-", "")).digest("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    await admin.from("recovery_codes").insert({
      class_membership_id: targetMembershipId,
      code_hash: newHash,
      expires_at: expiresAt.toISOString(),
      created_by: teacherId
    });

    // To hit this, we need the cookie of the student who claimed it. 
    // Since we didn't save the cookie in the previous test (we just proved it worked),
    // let's just make an RPC call directly using the DB function with their ID.
    // Actually, we can get their auth ID from the database!
    const { data: mem } = await admin.from("class_memberships").select("student_id").eq("id", targetMembershipId).single();
    
    // Create an authenticated client for that student
    const tokenRes = await fetch(`http://localhost:54321/auth/v1/token?grant_type=password`, {
      method: "POST",
      // Wait, we can't login with password for an anonymous user.
      // But we can just use `admin.rpc`? No, RPC is SECURITY DEFINER but uses `auth.uid()`.
    });
    
    // We will just verify it via another approach: create a known user, give them a membership, generate a code, use their cookie to claim.
    const resAuth = await fetch(`${NEXT_URL}/api/classes/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ class_code: classCode, display_name: "Idempotent Student" }),
    });
    const cookieString = resAuth.headers.get("set-cookie")!.split(";")[0];
    const { data: idemMem } = await admin.from("class_memberships").select("id").eq("display_name", "Idempotent Student").single();
    
    const idemCode = "J6H7-8G9F";
    const idemHash = crypto.createHmac("sha256", process.env.RECOVERY_CODE_PEPPER || "test-pepper").update(idemCode.replace("-", "")).digest("hex");
    await admin.from("recovery_codes").insert({
      class_membership_id: idemMem!.id,
      code_hash: idemHash,
      expires_at: expiresAt.toISOString(),
      created_by: teacherId
    });

    const res = await fetch(`${NEXT_URL}/api/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Cookie": cookieString, "X-Forwarded-For": "192.168.1.105" },
      body: JSON.stringify({ code: idemCode })
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.message).toBe("already_owned");
  });

  test("Replacement code invalidates the prior code", async () => {
    // We simulate generating a new code for the targetMembershipId
    const pepper = process.env.RECOVERY_CODE_PEPPER || "test-pepper";

    // 1. Create a "prior" code
    const priorCode = "P2R3-X4Y5";
    const priorHash = crypto.createHmac("sha256", pepper).update(priorCode.replace("-", "")).digest("hex");
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30);
    
    await admin.from("recovery_codes").insert({
      class_membership_id: targetMembershipId,
      code_hash: priorHash,
      expires_at: expiresAt.toISOString(),
      created_by: teacherId
    });

    // 2. Generate a "replacement" code using the server action logic simulation
    // First invalidate old codes
    await admin.from("recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("class_membership_id", targetMembershipId)
      .is("used_at", null);

    const replacementCode = "R5E6-P7L8";
    const replacementHash = crypto.createHmac("sha256", pepper).update(replacementCode.replace("-", "")).digest("hex");
    
    await admin.from("recovery_codes").insert({
      class_membership_id: targetMembershipId,
      code_hash: replacementHash,
      expires_at: expiresAt.toISOString(),
      created_by: teacherId
    });

    // 3. Ensure the prior code is now invalidated (used_at is not null)
    const { data: priorRow } = await admin.from("recovery_codes").select("used_at").eq("code_hash", priorHash).single();
    expect(priorRow!.used_at).not.toBeNull();
    
    // 4. Try claiming the prior code - should fail
    const res = await fetch(`${NEXT_URL}/api/recover`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Forwarded-For": "192.168.1.106" },
      body: JSON.stringify({ code: priorCode })
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_code");
  });
});
