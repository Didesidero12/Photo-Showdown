/**
 * Supabase admin client — service-role access.
 *
 * CRITICAL: This file must ONLY be imported in:
 *   - Route handlers (app/api/**)
 *   - Server Actions (lib/actions/**)
 *   - Server-side scripts
 *
 * NEVER import this in Client Components, hooks, or any file
 * that could be included in the client bundle.
 *
 * The service-role key bypasses RLS. All callers are responsible
 * for performing their own authorization checks before using
 * this client.
 */
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./types";

// Validates at startup that server-only secrets are present.
// This will throw during build if SUPABASE_SERVICE_ROLE_KEY is missing,
// which prevents accidental deployment without the secret.
function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

  return createClient<Database>(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Lazily-initialized singleton — only instantiated on first call at runtime,
// not during Next.js build-time static analysis.
let _adminClient: ReturnType<typeof createAdminClient> | null = null;

export function getSupabaseAdmin() {
  if (!_adminClient) {
    _adminClient = createAdminClient();
  }
  return _adminClient;
}

// Convenience named export matching prior usage in provisioning.ts
export const supabaseAdmin = new Proxy({} as ReturnType<typeof createAdminClient>, {
  get(_target, prop) {
    return getSupabaseAdmin()[prop as keyof ReturnType<typeof createAdminClient>];
  },
});
