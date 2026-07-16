/**
 * Root page — redirects authenticated teachers to /dashboard
 * and unauthenticated users to /auth/sign-in.
 */
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RootPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user && !user.is_anonymous) {
    redirect("/dashboard");
  }

  redirect("/auth/sign-in");
}
