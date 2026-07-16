/**
 * POST /api/assignments/create — creates a new draft assignment.
 * Derives organization_id and teacher_id from authenticated session.
 * Share token is generated server-side (crypto random fallback).
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ ok: false, error: "not_authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const classId = body?.class_id as string | undefined;
    const title = (body?.title as string | undefined)?.trim();
    const instructions = (body?.instructions as string | undefined)?.trim() || null;
    const deadline = (body?.submission_deadline as string | undefined) || null;
    const creativePrompt =
      (body?.creative_intent_prompt as string | undefined)?.trim() ||
      "Explain the creative choices behind your photograph.";

    if (!classId) return NextResponse.json({ ok: false, error: "class_id_required" }, { status: 400 });
    if (!title) return NextResponse.json({ ok: false, error: "title_required" }, { status: 400 });
    if (title.length > 200) return NextResponse.json({ ok: false, error: "title_too_long" }, { status: 400 });

    // Verify teacher owns this class
    const { data: cls } = await supabase
      .from("classes")
      .select("id, organization_id")
      .eq("id", classId)
      .eq("teacher_id", user.id)
      .maybeSingle();

    if (!cls) return NextResponse.json({ ok: false, error: "class_not_found" }, { status: 404 });

    // Generate a cryptographically random share token (server-side only)
    const { randomBytes } = await import("crypto");
    const shareToken = randomBytes(24).toString("base64url");

    const { data: assignment, error: insertError } = await supabase
      .from("assignments")
      .insert({
        organization_id: cls.organization_id,
        class_id: classId,
        teacher_id: user.id,
        title,
        instructions,
        creative_intent_prompt: creativePrompt,
        submission_deadline: deadline ? new Date(deadline).toISOString() : null,
        share_token: shareToken,
        status: "draft",
      })
      .select("id")
      .single();

    if (insertError || !assignment) {
      console.error("[assignments/create]", insertError?.code);
      return NextResponse.json({ ok: false, error: "create_failed" }, { status: 500 });
    }

    return NextResponse.json({ ok: true, assignment_id: assignment.id });
  } catch (err) {
    console.error("[assignments/create] unexpected:", err);
    return NextResponse.json({ ok: false, error: "internal_error" }, { status: 500 });
  }
}
