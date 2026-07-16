/**
 * Supabase server client — for use in Server Components, Server Actions,
 * and Route Handlers.
 *
 * Creates a new client per request (not a singleton) using cookies for
 * session management via @supabase/ssr.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./types";

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // setAll called from a Server Component — mutations are ignored.
            // Middleware handles session refresh.
          }
        },
      },
    }
  );
}
