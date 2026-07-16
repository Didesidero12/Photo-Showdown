/**
 * Teacher profile server actions — Milestone 1.
 *
 * completeTeacherProfile:
 *   Idempotent. Updates display_name and optional school on the authenticated
 *   teacher's profile, then marks profile_complete = true.
 *
 *   Identity is verified server-side via getUser() before the update.
 *   The supabaseAdmin client (service role) is used for the write to avoid
 *   the RLS self-referencing recursion in organization_memberships policies
 *   that is triggered when the authenticated client runs a profile UPDATE.
 *   The .eq("id", user.id) filter provides the security boundary equivalent
 *   to the RLS UPDATE policy.
 *
 * updateTeacherProfile:
 *   Same semantics, used from the Account page for subsequent edits.
 */
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type ProfileActionResult =
  | { ok: true }
  | { ok: false; error: string };

export async function completeTeacherProfile(
  formData: FormData
): Promise<ProfileActionResult> {
  // Step 1: verify identity via the user's own session.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "not_authenticated" };
  }

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const school = (formData.get("school") as string | null)?.trim() ?? null;

  if (!displayName) {
    return { ok: false, error: "display_name_required" };
  }

  // Step 2: update profile via authenticated client.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      school: school || null,
      profile_complete: true,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[profile] completeTeacherProfile failed:", updateError.code, updateError.message);
    return { ok: false, error: "update_failed" };
  }

  redirect("/dashboard");
}

export async function updateTeacherProfile(
  formData: FormData
): Promise<ProfileActionResult> {
  // Step 1: verify identity.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "not_authenticated" };
  }

  const displayName = (formData.get("display_name") as string | null)?.trim() ?? "";
  const school = (formData.get("school") as string | null)?.trim() ?? null;

  if (!displayName) {
    return { ok: false, error: "display_name_required" };
  }

  // Step 2: update profile via authenticated client.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      school: school || null,
    })
    .eq("id", user.id);

  if (updateError) {
    console.error("[profile] updateTeacherProfile failed:", updateError.code, updateError.message);
    return { ok: false, error: "update_failed" };
  }

  redirect("/account?saved=1");
}
