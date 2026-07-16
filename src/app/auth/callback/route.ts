/**
 * /auth/callback — Supabase Auth exchange route.
 *
 * Called after:
 * - Magic-link email click
 * - OAuth provider redirect
 *
 * Responsibilities:
 * 1. Exchange the auth code for a Supabase session.
 * 2. Call ensureTeacherProvisioned() to idempotently create
 *    profiles / organization / membership rows.
 * 3. Redirect to the originally requested URL (or /dashboard).
 *
 * If provisioning fails, redirect to /auth/provisioning-error
 * so the teacher sees a recoverable generic error — not a broken dashboard.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ensureTeacherProvisioned } from "@/lib/actions/provisioning";
import type { Database } from "@/lib/supabase/types";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/auth/sign-in?error=missing_code`);
  }

  const response = NextResponse.redirect(`${origin}${next}`);

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, {
              ...options,
              // Enforce secure cookie settings in production.
              httpOnly: true,
              secure: process.env.APP_ENV === "production",
              sameSite: "lax",
            })
          );
        },
      },
    }
  );

  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error("[auth/callback] exchange failed:", exchangeError.status);
    return NextResponse.redirect(`${origin}/auth/sign-in?error=exchange_failed`);
  }

  // Run idempotent provisioning for teacher accounts.
  const provisionResult = await ensureTeacherProvisioned();

  if (!provisionResult.ok) {
    if (provisionResult.error === "anonymous_user_cannot_be_provisioned") {
      // Anonymous users don't provision — send to join flow.
      return NextResponse.redirect(`${origin}/join`);
    }

    if (provisionResult.error !== "not_authenticated") {
      // Provisioning failed — redirect to recoverable error page.
      console.error("[auth/callback] provisioning failed:", provisionResult.error);
      return NextResponse.redirect(
        `${origin}/auth/provisioning-error?code=${provisionResult.error}`
      );
    }
  }

  return response;
}
