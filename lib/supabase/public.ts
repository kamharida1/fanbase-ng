import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const CACHE_KEY = "__supabase_public_client__";
type GlobalCache = typeof globalThis & { [CACHE_KEY]?: SupabaseClient };

export function hasPublicSupabaseEnv(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
  );
}

/**
 * Anon-key Supabase client with no cookie handling.
 * Safe to use in static/ISR contexts where there is no request object.
 * Only queries that are readable by the anon role (public RLS) work here.
 */
export function createPublicClient(): SupabaseClient {
  const g = globalThis as GlobalCache;
  if (g[CACHE_KEY]) return g[CACHE_KEY]!;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required.",
    );
  }

  const client = createClient(url, key, { auth: { persistSession: false } });
  g[CACHE_KEY] = client;
  return client;
}
