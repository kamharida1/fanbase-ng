import {
  createServerClient,
  type CookieOptions,
} from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { NextRequest, NextResponse } from "next/server";

import { getSupabasePublicConfig } from "@/lib/supabase/env";

type PendingCookie = { name: string; value: string; options: CookieOptions };

/**
 * Supabase client for Route Handlers (e.g. /callback).
 * Reads PKCE verifiers from the incoming request and writes session cookies
 * onto the outgoing NextResponse — required for exchangeCodeForSession.
 */
export function createRouteHandlerClient(request: NextRequest): {
  supabase: SupabaseClient;
  applyCookies: (response: NextResponse) => NextResponse;
} {
  const pending: PendingCookie[] = [];
  const { url, anonKey } = getSupabasePublicConfig();

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          request.cookies.set(name, value);
          pending.push({ name, value, options });
        }
      },
    },
  });

  return {
    supabase,
    applyCookies(response: NextResponse) {
      for (const { name, value, options } of pending) {
        response.cookies.set(name, value, options);
      }
      return response;
    },
  };
}
