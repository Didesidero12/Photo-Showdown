/**
 * GET /api/submissions/[submissionId]/image
 *
 * Generates a short-lived (5-minute) signed URL for the processed submission image.
 * Verifies the caller is the owning student OR a teacher of the class.
 * Signed URLs are never stored in the database.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

const SIGNED_URL_EXPIRY = 300; // 5 minutes

export async function GET(
  _req: NextRequest,
  context: { params: Promise<{ submissionId: string }> }
) {
  const { submissionId } = await context.params;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
  }

  // RLS on the authenticated client ensures only the student or teacher can read this row
  const { data: sub, error: subError } = await supabase
    .from("submissions")
    .select("id, storage_path_processed, processing_status")
    .eq("id", submissionId)
    .maybeSingle();

  if (subError || !sub) {
    return NextResponse.json({ error: "submission_not_found" }, { status: 404 });
  }

  if (sub.processing_status !== "ready" || !sub.storage_path_processed) {
    return NextResponse.json({ error: "image_not_ready" }, { status: 404 });
  }

  const admin = getSupabaseAdmin();
  const { data: signed, error: signErr } = await admin.storage
    .from("submissions-processed")
    .createSignedUrl(sub.storage_path_processed, SIGNED_URL_EXPIRY);

  if (signErr || !signed) {
    console.error("[image] signed URL error:", signErr?.message);
    return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
  }

  return NextResponse.json({ url: signed.signedUrl, expires_in: SIGNED_URL_EXPIRY });
}
