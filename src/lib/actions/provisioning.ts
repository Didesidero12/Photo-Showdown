/**
 * ensureTeacherProvisioned — Idempotent teacher provisioning operation.
 *
 * Called from:
 * 1. /auth/callback route — after Supabase Auth exchange completes.
 * 2. Protected teacher route layouts — as a guard before rendering.
 *
 * Creates missing rows (profiles, organizations, organization_memberships)
 * using ON CONFLICT DO NOTHING semantics. Safe to call multiple times.
 *
 * Returns:
 * - { ok: true, organizationId } on success
 * - { ok: false, error } on failure (provisioning incomplete)
 *
 * NEVER logs authentication tokens, email addresses, or personal content.
 */
"use server";

import { supabaseAdmin } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ProvisioningResult =
  | { ok: true; organizationId: string }
  | { ok: false; error: string };

export async function ensureTeacherProvisioned(): Promise<ProvisioningResult> {
  // Step 1: Verify the authenticated Supabase user.
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, error: "not_authenticated" };
  }

  if (user.is_anonymous) {
    return { ok: false, error: "anonymous_user_cannot_be_provisioned" };
  }

  const userId = user.id;
  // Use "Teacher" as the safe temporary label — the teacher will complete
  // their profile in the onboarding step and provide their real name then.
  const displayName = "Teacher";

  try {
    // Step 2: Create profiles row if missing.
    const { error: profileError } = await supabaseAdmin
      .from("profiles")
      .upsert(
        {
          id: userId,
          display_name: displayName,
          is_anonymous: false,
        },
        { onConflict: "id", ignoreDuplicates: true }
      );

    if (profileError) {
      console.error("[provisioning] profiles upsert failed:", profileError.code);
      return { ok: false, error: "profiles_upsert_failed" };
    }

    // Step 3: Create Personal Workspace organization if no ownership exists.
    // Check first to avoid creating duplicate orgs on retries.
    const { data: existingMembership } = await supabaseAdmin
      .from("organization_memberships")
      .select("organization_id")
      .eq("user_id", userId)
      .eq("role", "owner")
      .eq("status", "active")
      .maybeSingle();

    if (existingMembership) {
      // Provisioning is already complete.
      return { ok: true, organizationId: existingMembership.organization_id };
    }

    // Create the Personal Workspace organization.
    // This internal name is always "Personal Workspace" — never derived from the
    // email address. The teacher can update their display name during onboarding.
    const orgName = "Personal Workspace";

    const { data: newOrg, error: orgError } = await supabaseAdmin
      .from("organizations")
      .insert({
        name: orgName,
        slug: generateOrgSlug(userId),
      })
      .select("id")
      .single();

    if (orgError || !newOrg) {
      console.error("[provisioning] organization insert failed:", orgError?.code);
      return { ok: false, error: "organization_insert_failed" };
    }

    // Step 4: Create owner organization_memberships row.
    const { error: membershipError } = await supabaseAdmin
      .from("organization_memberships")
      .insert({
        organization_id: newOrg.id,
        user_id: userId,
        role: "owner",
        status: "active",
      });

    if (membershipError) {
      // If this fails, we have an orphaned org. Log for manual review.
      console.error(
        "[provisioning] organization_memberships insert failed:",
        membershipError.code,
        "orphaned org:",
        newOrg.id
      );
      return { ok: false, error: "membership_insert_failed" };
    }

    return { ok: true, organizationId: newOrg.id };
  } catch (err) {
    // Log sanitized error — no PII, no tokens.
    console.error("[provisioning] unexpected error:", (err as Error).message);
    return { ok: false, error: "unexpected_error" };
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function deriveDisplayName(_user: {
  email?: string;
  user_metadata?: Record<string, unknown>;
}): string {
  // This helper is intentionally unused at provisioning time.
  // Teachers always start as "Teacher" and complete their profile during onboarding.
  return "Teacher";
}

function generateOrgSlug(userId: string): string {
  // Deterministic slug derived from user ID — no collision risk per-user,
  // and not guessable from outside.
  return `org-${userId.replace(/-/g, "").slice(0, 16)}`;
}
