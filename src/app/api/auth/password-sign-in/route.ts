/**
 * POST /api/auth/password-sign-in
 *
 * Handles the plain HTML form POST from the password sign-in tab.
 * Uses @supabase/ssr to set the session cookie, then redirects.
 *
 * Error responses redirect back to /auth/sign-in with a query param
 * so the UI can display a generic error (never reveals whether the
 * email address exists).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { ensureTeacherProvisioned } from "@/lib/actions/provisioning";
import type { Database } from "@/lib/supabase/types";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const email = (formData.get("email") as string | null)?.trim() ?? "";
  const password = (formData.get("password") as string | null) ?? "";

  if (!email || !password) {
    return NextResponse.redirect(
      new URL("/auth/sign-in?error=missing_fields", request.url),
      { status: 303 }
    );
  }

  // Build a response object first so the SSR helper can write cookies onto it.
  const response = NextResponse.redirect(new URL("/dashboard", request.url), {
    status: 303,
  });

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
              httpOnly: true,
              secure: process.env.APP_ENV === "production",
              sameSite: "lax",
            })
          );
        },
      },
    }
  );

  const { error: signInError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (signInError) {
    // Generic error — does not reveal whether the email exists.
    console.error("[password-sign-in] auth error:", signInError.status);
    return NextResponse.redirect(
      new URL("/auth/sign-in?tab=password&error=invalid_credentials", request.url),
      { status: 303 }
    );
  }

  // Run idempotent provisioning (creates org/profile rows if missing).
  const provision = await ensureTeacherProvisioned();

  if (!provision.ok && provision.error !== "not_authenticated") {
    console.error("[password-sign-in] provisioning failed:", provision.error);
    return NextResponse.redirect(
      new URL(`/auth/provisioning-error?code=${provision.error}`, request.url),
      { status: 303 }
    );
  }

  return response;
}
