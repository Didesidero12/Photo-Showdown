import { getSupabaseAdmin } from "@/lib/supabase/admin";
/**
 * GET /api/assignment/[shareToken]/info
 *
 * Resolves the assignment from its share token.
 * Returns ONLY the minimum safe fields needed for the enrollment gate:
 * - class_name, assignment_title, status (student-facing)
 * - is_member: whether the calling user already has active membership
 *
 * Does NOT expose: full instructions, UUIDs, org IDs, storage paths,
 * submission records, student identities, Creative Intent, teacher notes.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const STUDENT_VISIBLE_STATUSES = ["accepting_submissions", "submission_review", "ready", "active_critique", "results_reveal", "reflection", "complete"];

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ shareToken: string }> }
) {
  const { shareToken } = await context.params;

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Use service role to resolve the assignment from the token (bypassing student RLS intentionally
  // because the student doesn't have membership yet — this is the enrollment gate)
  const admin = getSupabaseAdmin();

  // Minimal fields ONLY — no instructions, UUIDs (except class_id for membership check), org IDs
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id, title, status, creative_intent_prompt, classes(name)")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (!STUDENT_VISIBLE_STATUSES.includes(assignment.status)) {
    return NextResponse.json({ error: "not_accepting" }, { status: 403 });
  }

  // Check if authenticated user has active membership
  let is_member = false;
  if (user) {
    const { data: membership } = await admin
      .from("class_memberships")
      .select("id")
      .eq("class_id", assignment.class_id)
      .eq("student_id", user.id)
      .eq("status", "active")
      .maybeSingle();
    is_member = !!membership;
  }

  const classInfo = (Array.isArray(assignment.classes)
    ? assignment.classes[0]
    : assignment.classes) as any;

  // Check for active or reveal sessions
  const { data: session } = await admin
    .from("showdown_sessions")
    .select("status")
    .eq("assignment_id", assignment.id)
    .in("status", ["active", "reveal"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    class_name: classInfo?.name || "Unknown Class",
    assignment_title: assignment.title,
    status: assignment.status,
    session_status: session?.status || null,
    creative_intent_prompt: assignment.creative_intent_prompt,
    is_member
  });
}
