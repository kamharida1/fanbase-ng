import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { listNotificationsSchema } from "@/lib/notifications/schemas";
import { listNotifications } from "@/lib/notifications/queries";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const parsed = listNotificationsSchema.safeParse({
    cursor: searchParams.get("cursor") ?? undefined,
    limit: searchParams.get("limit") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const page = await listNotifications(supabase, {
    userId: authResult.ctx.userId,
    cursor: parsed.data.cursor ?? null,
    limit: parsed.data.limit,
  });

  return NextResponse.json(
    { data: page },
    {
      headers: {
        "Cache-Control": "private, no-cache",
      },
    },
  );
}
