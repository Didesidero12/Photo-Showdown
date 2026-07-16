import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { cookies } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  if (process.env.APP_ENV === "production") return NextResponse.json({ error: "Not allowed" }, { status: 403 });

  const url = new URL(request.url);
  const userId = url.searchParams.get("userId");
  
  // A backdoor just for test scripts to skip OTP flow.
  // Not intended for production!
  const admin = getSupabaseAdmin();
  
  // We need an actual session. We can just sign in as a user with their password if we reset it, or we can use admin.auth.admin.generateLink
  const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
    type: 'magiclink',
    email: 'teacher-a@dev.local',
  });

  if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 });
  
  // redirect to the magic link to get the cookie set!
  return NextResponse.redirect(linkData.properties.action_link);
}
