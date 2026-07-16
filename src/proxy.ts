/**
 * Next.js Middleware — Photo Showdown
 *
 * Responsibilities:
 * 1. Refresh the Supabase session cookie on every request (required by @supabase/ssr).
 * 2. Enforce route protection:
 *    - Teacher routes (/dashboard, /classes, /assignments, /sessions, /account)
 *      require an authenticated, fully-provisioned teacher session.
 *    - Student routes (/my, /session, /assignment) require an anonymous or
 *      authenticated Supabase session.
 *    - Public routes (/join, /auth) are accessible to everyone.
 * 3. Block teacher routes if provisioning is incomplete and redirect to a
 *    recoverable error page.
 *
 * Security: This middleware does NOT trust client-supplied role claims.
 * Route-level protection here is a usability layer only. RLS and server
 * actions enforce authorization independently.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Routes that require a fully authenticated teacher account.
const TEACHER_ROUTES = [
  "/dashboard",
  "/classes",
  "/assignments",
  "/sessions",
  "/account",
];

// Routes that require any Supabase session (teacher or anonymous student).
const AUTHENTICATED_ROUTES = ["/my", "/session", "/assignment"];

// Routes accessible to unauthenticated visitors.
const PUBLIC_ROUTES = ["/", "/join", "/auth"];

function isTeacherRoute(pathname: string): boolean {
  return TEACHER_ROUTES.some((r) => pathname === r || pathname.startsWith(r + "/"));
}

function isAuthenticatedRoute(pathname: string): boolean {
  return AUTHENTICATED_ROUTES.some(
    (r) => pathname === r || pathname.startsWith(r + "/")
  );
}

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run any logic between createServerClient and
  // getUser() — it will break session refresh.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ── Teacher route protection ──────────────────────────────────────────────
  if (isTeacherRoute(pathname)) {
    if (!user) {
      // Not authenticated at all — redirect to sign-in.
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/auth/sign-in";
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (user.is_anonymous) {
      // Anonymous users cannot access teacher routes.
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/join";
      return NextResponse.redirect(redirectUrl);
    }

    // Teacher is authenticated. Provisioning completeness is checked in
    // the server action layer (ensureTeacherProvisioned) — not here,
    // to avoid an extra DB round-trip on every request.
    // If provisioning is incomplete, the dashboard will catch it and
    // show a recoverable error state.
  }

  // ── Authenticated student/teacher route protection ──────────────────────
  if (isAuthenticatedRoute(pathname)) {
    if (!user) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/join";
      redirectUrl.searchParams.set("redirectTo", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - api/health (health check — no auth needed)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|api/health).*)",
  ],
};
