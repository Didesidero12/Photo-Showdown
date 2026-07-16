/**
 * Teacher auth server actions.
 *
 * All auth operations delegate to Supabase Auth.
 * Tokens are never logged, stored in the DB, or included in responses.
 */
"use server";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function signInWithEmail(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { error } = await supabase.auth.signInWithPassword({
    email: email?.trim(),
    password,
  });

  if (error) {
    // Generic error — does not reveal whether the email exists.
    return { error: "incorrect_credentials" };
  }

  redirect("/dashboard");
}

export async function signInWithMagicLink(formData: FormData) {
  const supabase = await createSupabaseServerClient();
  const email = formData.get("email") as string;

  const { error } = await supabase.auth.signInWithOtp({
    email: email?.trim(),
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/confirm`,
    },
  });

  if (error) {
    // Generic error — does not reveal whether the email exists.
    return { error: "magic_link_failed" };
  }

  return { ok: true };
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/auth/sign-in");
}

export async function signInAnonymously() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInAnonymously();
  if (error) {
    return { error: "anonymous_sign_in_failed" };
  }
  return { ok: true };
}
