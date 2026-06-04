import { NextResponse } from "next/server";

import { listCreators } from "@/lib/creators/queries";
import { enforceRateLimit } from "@/lib/rate-limit-http";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const limited = await enforceRateLimit(request, "creatorsPublic", "list");
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "24", 10) || 24,
    50,
  );
  const search = searchParams.get("q") ?? undefined;

  const supabase = await createClient();
  const creators = await listCreators(supabase, { limit, search });

  return NextResponse.json({ data: creators });
}
