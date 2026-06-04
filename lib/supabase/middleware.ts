import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";

import { fetchAuthContext } from "@/lib/auth/get-auth-context";
import type { AuthContext } from "@/types/auth";

export type SessionUpdate = {
  response: NextResponse;
  user: User | null;
  auth: AuthContext | null;
};

export async function updateSession(
  request: NextRequest,
): Promise<SessionUpdate> {
  let response = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!url || !key) {
    return { response, user: null, auth: null };
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response, user: null, auth: null };
  }

  const auth = await fetchAuthContext(supabase, user);
  return { response, user, auth };
}
