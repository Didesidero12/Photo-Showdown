/**
 * Class management server actions — Milestone 1.
 *
 * Security guarantees:
 * - organization_id is derived from authenticated server context (never from client input).
 * - teacher_id is always auth.uid() — cannot be spoofed.
 * - class_code is generated server-side with a unique constraint retry loop.
 * - All write operations enforce the authenticated user's identity.
 * - RLS policies on the `classes` table double-enforce all access.
 */
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";

import { redirect } from "next/navigation";

export type ClassActionResult =
  | { ok: true; classId?: string }
  | { ok: false; error: string };

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Generates a random 6-character alphanumeric class code (uppercase). */
function generateClassCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // omit I, O, 0, 1 to avoid confusion
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// ── Actions ───────────────────────────────────────────────────────────────────

/**
 * createClass — creates a new class for the authenticated teacher.
 *
 * organization_id and teacher_id are derived from the authenticated session
 * and the teacher's organization membership. The client cannot supply these values.
 */
export async function createClass(formData: FormData): Promise<ClassActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "not_authenticated" };
  }

  const name = (formData.get("name") as string | null)?.trim() ?? "";
  if (!name) {
    return { ok: false, error: "name_required" };
  }
  if (name.length > 120) {
    return { ok: false, error: "name_too_long" };
  }

  // Resolve organization_id from the teacher's active owner membership.
  // This is derived entirely from the authenticated session — no client input.
  const { data: membership, error: membershipError } = await supabase
    .from("organization_memberships")
    .select("organization_id")
    .eq("user_id", user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();

  if (membershipError || !membership) {
    console.error("[classes] could not resolve organization:", membershipError?.code);
    return { ok: false, error: "no_organization" };
  }

  // Generate a unique 6-char class code — retry on collision (unique constraint).
  let classId: string | null = null;
  let attempts = 0;
  while (!classId && attempts < 5) {
    attempts++;
    const code = generateClassCode();
    const { data, error } = await supabase
      .from("classes")
      .insert({
        organization_id: membership.organization_id,
        teacher_id: user.id,
        name,
        class_code: code,
      })
      .select("id")
      .single();

    if (!error && data) {
      classId = data.id;
    } else if (error && error.code !== "23505") {
      // 23505 = unique_violation (code collision) — retry. Anything else is fatal.
      console.error("[classes] insert failed:", error.code);
      return { ok: false, error: "create_failed" };
    }
  }

  if (!classId) {
    return { ok: false, error: "code_collision_exhausted" };
  }

  redirect(`/classes/${classId}`);
}

/**
 * archiveClass — sets archived_at on a class the teacher owns.
 * Only the class's teacher_id can archive it (enforced by RLS UPDATE policy).
 */
export async function archiveClass(classId: string): Promise<ClassActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "not_authenticated" };
  }

  // Use the authenticated (RLS) client — the UPDATE policy enforces teacher_id = auth.uid()
  const { error } = await supabase
    .from("classes")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", classId)
    .eq("teacher_id", user.id); // belt-and-suspenders check on top of RLS

  if (error) {
    console.error("[classes] archive failed:", error.code);
    return { ok: false, error: "archive_failed" };
  }

  redirect("/classes");
}

/**
 * unarchiveClass — clears archived_at, restoring the class.
 */
export async function unarchiveClass(classId: string): Promise<ClassActionResult> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "not_authenticated" };
  }

  const { error } = await supabase
    .from("classes")
    .update({ archived_at: null })
    .eq("id", classId)
    .eq("teacher_id", user.id);

  if (error) {
    console.error("[classes] unarchive failed:", error.code);
    return { ok: false, error: "unarchive_failed" };
  }

  redirect(`/classes/${classId}`);
}
