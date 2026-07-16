import { getSupabaseAdmin } from "@/lib/supabase/admin";
/**
 * GET /api/assignment/[shareToken]/submission-data
 *
 * Returns assignment data and the student's own submission (if any).
 * Validates active membership before returning any assignment content.
 * Does NOT expose other students' data, UUIDs, or storage paths.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await context.params;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  // Resolve assignment from token
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id, title, instructions, status, creative_intent_prompt, submission_deadline")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const STUDENT_VISIBLE = ["accepting_submissions", "submission_review", "ready", "complete"];
  if (!STUDENT_VISIBLE.includes(assignment.status)) {
    return NextResponse.json({ error: "not_accepting" }, { status: 403 });
  }

  // Verify active membership
  const { data: membership } = await admin
    .from("class_memberships")
    .select("id")
    .eq("class_id", assignment.class_id)
    .eq("student_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: "no_active_membership" }, { status: 403 });
  }

  // Fetch student's own submission (via class_membership_id — their durable anchor)
  const { data: submission } = await admin
    .from("submissions")
    .select("id, status, processing_status, creative_intent, teacher_note")
    .eq("assignment_id", assignment.id)
    .eq("class_membership_id", membership.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    assignment_id: assignment.id,
    title: assignment.title,
    instructions: assignment.instructions,
    creative_intent_prompt: assignment.creative_intent_prompt,
    submission_deadline: assignment.submission_deadline,
    existing_submission: submission ?? null,
  });
}
