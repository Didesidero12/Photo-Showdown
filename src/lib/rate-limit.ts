import { getSupabaseAdmin } from "@/lib/supabase/admin";

/**
 * Shared PostgreSQL-backed Rate Limiter.
 * Uses the `rate_limits` table to track counts securely across all nodes.
 */
export async function checkRateLimit(ip: string, maxRequests: number = 5, windowMs: number = 60000): Promise<boolean> {
  const admin = getSupabaseAdmin();
  const now = new Date();
  
  // We clean up expired limits on a best-effort basis for the same IP
  await admin.from("rate_limits").delete().lt("reset_at", now.toISOString());

  // Upsert the count
  const { data: limit, error } = await admin.rpc("increment_rate_limit", {
    p_key: ip,
    p_window_interval: `${windowMs} milliseconds`
  });

  if (error || !limit) {
    // If RPC is not available yet, we fallback to simple upsert logic inside JS
    // Let's implement the fallback if RPC fails or doesn't exist
    const { data: existing } = await admin
      .from("rate_limits")
      .select("count, reset_at")
      .eq("key", ip)
      .maybeSingle();

    if (existing) {
      if (new Date(existing.reset_at) < now) {
        // Expired, reset
        const resetAt = new Date(now.getTime() + windowMs);
        await admin.from("rate_limits").update({ count: 1, reset_at: resetAt.toISOString() }).eq("key", ip);
        return true;
      }
      
      if (existing.count >= maxRequests) {
        return false;
      }
      
      await admin.from("rate_limits").update({ count: existing.count + 1 }).eq("key", ip);
      return true;
    } else {
      const resetAt = new Date(now.getTime() + windowMs);
      await admin.from("rate_limits").insert({ key: ip, count: 1, reset_at: resetAt.toISOString() });
      return true;
    }
  }

  // If using RPC, the RPC would return the new count
  return limit <= maxRequests;
}
