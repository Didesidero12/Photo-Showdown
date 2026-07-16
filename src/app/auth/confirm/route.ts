import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { ensureTeacherProvisioned } from "@/lib/actions/provisioning";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/dashboard";

  // Validate next parameter to prevent open redirects.
  const allowedNext = ["/dashboard", "/classes", "/onboarding", "/join"];
  const finalNext = allowedNext.includes(next) ? next : "/dashboard";

  if (!token_hash || !type) {
    console.error("[auth/confirm] Missing token_hash or type");
    return NextResponse.redirect(`${origin}/auth/sign-in?error=invalid_link`);
  }

  const supabase = await createSupabaseServerClient();

  // Exchange the token_hash for a session via PKCE.
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    console.error("[auth/confirm] verifyOtp error:", error.message);
    return NextResponse.redirect(`${origin}/auth/sign-in?error=expired_link`);
  }

  // Confirm the identity is now established.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    console.error("[auth/confirm] Failed to get user after verifyOtp:", userError?.message);
    return NextResponse.redirect(`${origin}/auth/sign-in?error=invalid_session`);
  }

  // Idempotent provisioning: creates profile, Personal Workspace, membership.
  const provisionResult = await ensureTeacherProvisioned();

  if (!provisionResult.ok) {
    if (provisionResult.error === "anonymous_user_cannot_be_provisioned") {
      return NextResponse.redirect(`${origin}/join`);
    }
    if (provisionResult.error !== "not_authenticated") {
      console.error("[auth/confirm] provisioning failed:", provisionResult.error);
      return NextResponse.redirect(
        `${origin}/auth/provisioning-error?code=${provisionResult.error}`
      );
    }
  }

  // Check whether this teacher has completed their profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("profile_complete")
    .eq("id", user.id)
    .single();

  if (!profile?.profile_complete) {
    return NextResponse.redirect(`${origin}/onboarding`);
  }

  return NextResponse.redirect(`${origin}${finalNext}`);
}
