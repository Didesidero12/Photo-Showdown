/**
 * POST /api/submissions/[submissionId]/review — teacher approves, returns, or rejects.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await context.params;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const action = body?.action as string | undefined;
  const teacherNote = (body?.teacher_note as string | undefined)?.trim() || null;

  if (!["approved", "returned", "rejected"].includes(action ?? "")) {
    return NextResponse.json({ ok: false, error: "invalid_action" }, { status: 400 });
  }

  // Fetch submission — RLS ensures teacher sees only their class submissions
  const { data: sub, error: fetchError } = await supabase
    .from("submissions")
    .select("id, status, processing_status")
    .eq("id", submissionId)
    .maybeSingle();

  if (fetchError || !sub) {
    return NextResponse.json({ ok: false, error: "submission_not_found" }, { status: 404 });
  }

  // Block approval until image processing is complete
  if (action === "approved" && sub.processing_status !== "ready") {
    return NextResponse.json({ ok: false, error: "processing_not_ready" }, { status: 422 });
  }

  const allowedCurrentStatuses: Record<string, string[]> = {
    approved: ["pending"],
    returned: ["pending", "approved"],
    rejected: ["pending", "approved"],
  };

  if (!allowedCurrentStatuses[action!]?.includes(sub.status)) {
    return NextResponse.json({ ok: false, error: "invalid_status_transition" }, { status: 422 });
  }

  const { error: updateError } = await supabase
    .from("submissions")
    .update({
      status: action! as "pending" | "approved" | "returned" | "rejected",
      teacher_note: teacherNote,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user.id,
    })
    .eq("id", submissionId);

  if (updateError) {
    console.error("[review] update failed:", updateError.code);
    return NextResponse.json({ ok: false, error: "review_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
