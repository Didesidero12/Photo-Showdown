import { getSupabaseAdmin } from "@/lib/supabase/admin";
/**
 * GET /api/assignment/[shareToken]/my-status
 *
 * Returns the authenticated student's own submission status and a signed image URL.
 * Validates active membership. Never exposes other students' data.
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

  // Resolve assignment
  const { data: assignment } = await admin
    .from("assignments")
    .select("id, class_id, title")
    .eq("share_token", shareToken)
    .maybeSingle();

  if (!assignment) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  // Verify membership
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

  // Fetch student's own submission
  const { data: sub } = await admin
    .from("submissions")
    .select("id, status, processing_status, creative_intent, teacher_note, submitted_at, reviewed_at, storage_path_processed")
    .eq("assignment_id", assignment.id)
    .eq("class_membership_id", membership.id)
    .order("submitted_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let image_url: string | null = null;
  // Only expose teacher note for returned or rejected submissions
  let teacherNote: string | null = null;

  if (sub) {
    if (sub.processing_status === "ready" && sub.storage_path_processed) {
      const { data: signed } = await admin.storage
        .from("submissions-processed")
        .createSignedUrl(sub.storage_path_processed, 300);
      image_url = signed?.signedUrl ?? null;
    }

    if (sub.status === "returned" || sub.status === "rejected") {
      teacherNote = sub.teacher_note;
    }
  }

  return NextResponse.json({
    title: assignment.title,
    submission: sub
      ? {
          status: sub.status,
          processing_status: sub.processing_status,
          creative_intent: sub.creative_intent,
          teacher_note: teacherNote,
          submitted_at: sub.submitted_at,
          reviewed_at: sub.reviewed_at,
          image_url,
        }
      : null,
  });
}
