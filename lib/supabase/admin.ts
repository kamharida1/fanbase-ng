import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton keyed on the service-role URL so that all 127 call-sites in the
// same warm lambda container share one HTTP client and its keep-alive pool
// rather than spinning up a fresh SDK instance per call.
const CACHE_KEY = "__supabase_admin_client__";
type GlobalCache = typeof globalThis & { [CACHE_KEY]?: SupabaseClient };

/**
 * Service-role client for webhooks, cron, and other trusted server jobs.
 * Bypasses RLS — never expose to the browser.
 */
export function createAdminClient(): SupabaseClient {
  const g = globalThis as GlobalCache;
  if (g[CACHE_KEY]) return g[CACHE_KEY]!;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error("Supabase admin client is not configured.");
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  g[CACHE_KEY] = client;
  return client;
}
