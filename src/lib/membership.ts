import { getSupabaseAdmin } from "./supabase/admin";
import { createSupabaseServerClient } from "./supabase/server";

export interface JoinClassParams {
  classCode: string;
  displayName: string;
  expectedShareToken?: string; // Optional: If joining from an assignment link
}

export interface JoinClassResult {
  ok: boolean;
  classId?: string;
  error?: string;
  status?: number;
}

export async function processClassJoin({
  classCode,
  displayName,
  expectedShareToken,
}: JoinClassParams): Promise<JoinClassResult> {
  // Normalize inputs
  const code = classCode?.trim().toUpperCase();
  const rawName = displayName?.trim().replace(/[\x00-\x1F\x7F-\x9F]/g, ""); // Remove control chars
  
  if (!code || code.length !== 6) {
    return { ok: false, error: "invalid_code", status: 400 };
  }
  
  let finalName = rawName;
  
  if (!finalName || finalName.length < 1 || finalName.length > 80) {
    // If not provided, we will attempt to pull it from an existing membership later, IF they have a session
    finalName = "";
  }

  // Handle Authentication Encapuslated
  const supabase = await createSupabaseServerClient();
  let { data: { user }, error: authError } = await supabase.auth.getUser();

  // If no active session, seamlessly provision an anonymous student session
  if (authError || !user) {
    const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously();
    if (anonError || !anonData.user) {
      return { ok: false, error: "not_authenticated", status: 401 };
    }
    user = anonData.user;
  } else {
    // Teachers shouldn't accidentally join their own or other classes using their teacher account.
    // Anonymous users do not have an email.
    if (user.email) {
      return { ok: false, error: "teacher_account", status: 403 };
    }
  }

  const studentId = user.id;
  const admin = getSupabaseAdmin();

  if (!finalName) {
    // Try to get existing name
    const { data: anyMembership } = await admin
      .from("class_memberships")
      .select("display_name")
      .eq("student_id", studentId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
      
    if (anyMembership?.display_name) {
      finalName = anyMembership.display_name;
    } else {
      return { ok: false, error: "invalid_display_name", status: 400 };
    }
  }

  // 1. Resolve Class
  const { data: cls } = await admin
    .from("classes")
    .select("id, archived_at")
    .eq("class_code", code)
    .maybeSingle();

  if (!cls) {
    return { ok: false, error: "invalid_code", status: 400 };
  }

  if (cls.archived_at) {
    return { ok: false, error: "class_archived", status: 403 };
  }

  // 2. Validate Assignment Share Token (if joining via assignment)
  if (expectedShareToken) {
    const { data: assignment } = await admin
      .from("assignments")
      .select("id, class_id")
      .eq("share_token", expectedShareToken)
      .maybeSingle();

    if (!assignment || assignment.class_id !== cls.id) {
      return { ok: false, error: "code_class_mismatch", status: 400 };
    }
  }

  // 3. Check existing membership
  const { data: existing } = await admin
    .from("class_memberships")
    .select("id, status")
    .eq("class_id", cls.id)
    .eq("student_id", studentId)
    .maybeSingle();

  if (existing) {
    if (existing.status === "active") {
      return { ok: true, classId: cls.id };
    }
    if (existing.status === "suspended") {
      return { ok: false, error: "membership_suspended", status: 403 };
    }
    if (existing.status === "removed") {
      return { ok: false, error: "membership_removed", status: 403 };
    }
  }

  // 4. Create new membership safely
  const { error: insertError } = await admin
    .from("class_memberships")
    .insert({
      class_id: cls.id,
      student_id: studentId,
      display_name: finalName,
      status: "active",
    });

  if (insertError) {
    // 23505 is PostgreSQL unique violation (concurrent join requests)
    if (insertError.code === "23505") {
      // Another request beat us to it. Fetch the membership to ensure it's active.
      const { data: concurrent } = await admin
        .from("class_memberships")
        .select("status, student_id")
        .eq("class_id", cls.id)
        .eq("student_id", studentId)
        .maybeSingle();
        
      if (concurrent?.status === "active" && concurrent?.student_id === studentId) {
        return { ok: true, classId: cls.id };
      }
      return { ok: false, error: "membership_conflict", status: 409 };
    }
    return { ok: false, error: "internal_error", status: 500 };
  }

  return { ok: true, classId: cls.id };
}
