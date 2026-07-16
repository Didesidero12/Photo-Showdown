/**
 * POST /api/auth/sign-out
 *
 * Ends the teacher's Supabase session and clears cookies,
 * then redirects to the sign-in page.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  const origin = new URL(request.url).origin;
  return NextResponse.redirect(`${origin}/auth/sign-in`, { status: 303 });
}
