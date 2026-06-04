import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { getUnreadNotificationCount } from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const count = await getUnreadNotificationCount(
    supabase,
    authResult.ctx.userId,
  );

  return NextResponse.json(
    { data: { count } },
    {
      headers: {
        "Cache-Control": "private, no-cache",
      },
    },
  );
}
