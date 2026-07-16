/**
 * Submission management server actions — Milestone 2.
 *
 * Security guarantees:
 * - reviewSubmission verifies the authenticated teacher owns the class.
 * - Teacher approval is blocked if processing_status != 'ready'.
 * - joinClassWithCode validates the code server-side and creates membership.
 * - No client-supplied storage paths are accepted.
 */
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export type SubmissionActionResult =
  | { ok: true }
  | { ok: false; error: string };

export type JoinClassResult =
  | { ok: true; classId: string }
  | { ok: false; error: string };

// ─────────────────────────────────────────────────────────────────────────────

/**
 * reviewSubmission — teacher approves, returns, or rejects a submission.
 *
 * Blocks approval if processing_status is not 'ready'.
 * Adds optional private teacher note (visible only to the submitting student and teacher).
 */
export async function reviewSubmission(
  submissionId: string,
  action: "approved" | "returned" | "rejected",
  teacherNote?: string
): Promise<SubmissionActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { ok: false, error: "not_authenticated" };

  // Fetch the submission — RLS ensures teacher can only see their own class submissions
  const { data: sub, error: fetchError } = await supabase
    .from("submissions")
    .select("id, status, processing_status, assignment_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (fetchError || !sub) return { ok: false, error: "submission_not_found" };

  // Block approval until image processing is complete
  if (action === "approved" && sub.processing_status !== "ready") {
    return { ok: false, error: "processing_not_ready" };
  }

  // Only pending submissions can be reviewed; approved can be returned/rejected
  const allowedCurrentStatuses: Record<string, string[]> = {
    approved: ["pending"],
    returned: ["pending", "approved"],
    rejected: ["pending", "approved"],
  };
  if (!allowedCurrentStatuses[action]?.includes(sub.status)) {
    return { ok: false, error: "invalid_status_transition" };
  }

  const { error: updateError } = await supabase
    .from("submissions")
    .update({
      status: action,
      teacher_note: teacherNote?.trim() || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", submissionId);

  if (updateError) {
    console.error("[submissions] review failed:", updateError.code);
    return { ok: false, error: "review_failed" };
  }

  return { ok: true };
}

/**
 * joinClassWithCode — student joins a class using the 6-char class code.
 *
 * Called when a student without active membership tries to access an assignment.
 * Creates a new class_memberships row. Idempotent: if already a member, returns ok.
 */
export async function joinClassWithCode(
  classCode: string,
  displayName: string,
  expectedClassId?: string
): Promise<JoinClassResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) return { ok: false, error: "not_authenticated" };

  const code = classCode.trim().toUpperCase();

  // Resolve class from code — only non-archived classes
  const { data: cls, error: clsError } = await supabase
    .from("classes")
    .select("id, class_code, archived_at")
    .eq("class_code", code)
    .maybeSingle();

  if (clsError || !cls) return { ok: false, error: "invalid_code" };
  if (cls.archived_at) return { ok: false, error: "class_archived" };

  // If a specific class was expected (from assignment token), verify it matches
  if (expectedClassId && cls.id !== expectedClassId) {
    return { ok: false, error: "code_class_mismatch" };
  }

  // Check if already a member
  const { data: existing } = await supabase
    .from("class_memberships")
    .select("id, status")
    .eq("class_id", cls.id)
    .eq("student_id", user.id)
    .maybeSingle();

  if (existing?.status === "active") {
    return { ok: true, classId: cls.id };
  }
  if (existing?.status === "suspended") {
    return { ok: false, error: "membership_suspended" };
  }

  // Create new membership
  const name = displayName.trim() || "Student";
  const { error: insertError } = await supabase
    .from("class_memberships")
    .insert({
      class_id: cls.id,
      student_id: user.id,
      display_name: name,
      status: "active",
    });

  if (insertError) {
    // 23505 = unique violation — already active (race condition), treat as ok
    if (insertError.code === "23505") return { ok: true, classId: cls.id };
    console.error("[submissions] join failed:", insertError.code);
    return { ok: false, error: "join_failed" };
  }

  return { ok: true, classId: cls.id };
}
