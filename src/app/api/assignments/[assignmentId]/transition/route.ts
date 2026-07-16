/**
 * POST /api/assignments/[assignmentId]/transition — assignment lifecycle transitions.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOWED_TRANSITIONS: Record<string, { from: string | string[]; to: string }> = {
  publish:        { from: "draft",                 to: "accepting_submissions" },
  move_to_review: { from: "accepting_submissions",  to: "submission_review" },
  start_critique: { from: ["submission_review", "ready"], to: "active_critique" },
  reveal_results: { from: "active_critique",       to: "results_reveal" },
  archive:        { from: "*",                     to: "archived" },
};

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ assignmentId: string }> }
) {
  const { assignmentId } = await context.params;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const action = body?.action as string | undefined;

  if (!action || !ALLOWED_TRANSITIONS[action]) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  const { from, to } = ALLOWED_TRANSITIONS[action];

  // Verify teacher owns this assignment
  const { data: assignment } = await supabase
    .from("assignments")
    .select("id, status, teacher_id")
    .eq("id", assignmentId)
    .eq("teacher_id", user.id)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ ok: false, error: "assignment_not_found" }, { status: 404 });
  }

  if (from !== "*") {
    if (Array.isArray(from)) {
      if (!from.includes(assignment.status)) {
        return NextResponse.json({ ok: false, error: "invalid_transition" }, { status: 422 });
      }
    } else if (assignment.status !== from) {
      return NextResponse.json({ ok: false, error: "invalid_transition" }, { status: 422 });
    }
  }

  const { error: updateError } = await supabase
    .from("assignments")
    .update({ status: to as "draft" | "accepting_submissions" | "submission_review" | "ready" | "active_critique" | "results_reveal" | "reflection" | "complete" | "archived" })
    .eq("id", assignmentId)
    .eq("teacher_id", user.id);

  if (updateError) {
    return NextResponse.json({ ok: false, error: "update_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, status: to });
}
