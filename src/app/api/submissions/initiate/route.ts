/**
 * POST /api/submissions/initiate
 *
 * Server-locked upload initiation flow:
 * 1. Validates identity, membership, assignment state, and deadline.
 * 2. Enforces submission limit transactionally via initiate_submission() DB function.
 * 3. Generates an exact server-side raw object path.
 * 4. Issues a short-lived (5-minute) signed upload URL for that exact path.
 * 5. Returns submissionId + uploadUrl.
 *
 * The client MUST NOT provide a storage path. The path is resolved server-side.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "not_authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const assignmentId: string | undefined = body?.assignment_id;
    const creativeIntent: string | undefined = body?.creative_intent;

    if (!assignmentId) {
      return NextResponse.json({ error: "assignment_id_required" }, { status: 400 });
    }
    if (!creativeIntent?.trim()) {
      return NextResponse.json({ error: "creative_intent_required" }, { status: 400 });
    }
    if (creativeIntent.trim().length > 2000) {
      return NextResponse.json({ error: "creative_intent_too_long" }, { status: 400 });
    }

    // Call the concurrency-safe DB function — handles all validation and limit enforcement
    const { data: result, error: fnError } = await supabase.rpc(
      "initiate_submission" as any,
      {
        p_assignment_id: assignmentId,
        p_creative_intent: creativeIntent.trim(),
      }
    );

    if (fnError) {
      const msg = fnError.message ?? "";
      if (msg.includes("assignment_not_accepting")) {
        return NextResponse.json({ error: "assignment_not_accepting" }, { status: 422 });
      }
      if (msg.includes("deadline_passed")) {
        return NextResponse.json({ error: "deadline_passed" }, { status: 422 });
      }
      if (msg.includes("no_active_membership")) {
        return NextResponse.json({ error: "no_active_membership" }, { status: 403 });
      }
      if (msg.includes("submission_limit_reached")) {
        return NextResponse.json({ error: "submission_limit_reached" }, { status: 422 });
      }
      console.error("[initiate] DB error:", fnError.code, msg);
      return NextResponse.json({ error: "initiate_failed" }, { status: 500 });
    }

    const row = Array.isArray(result) ? result[0] : result;
    if (!row) {
      return NextResponse.json({ error: "initiate_failed" }, { status: 500 });
    }

    const submissionId: string = row.submission_id;
    const rawPath: string = row.raw_path;

    // Issue a short-lived signed upload URL via service role client
    const admin = getSupabaseAdmin();
    const { data: signedData, error: signedError } = await admin.storage
      .from("submissions-raw")
      .createSignedUploadUrl(rawPath);

    if (signedError || !signedData) {
      console.error("[initiate] signed URL error:", signedError?.message);
      return NextResponse.json({ error: "signed_url_failed" }, { status: 500 });
    }

    return NextResponse.json({
      submission_id: submissionId,
      upload_url: signedData.signedUrl,
      raw_path: rawPath,
      is_revision: row.is_revision,
    });
  } catch (err) {
    console.error("[initiate] unexpected error:", err);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
