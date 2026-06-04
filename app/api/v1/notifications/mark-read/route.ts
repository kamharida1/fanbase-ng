import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { markReadSchema } from "@/lib/notifications/schemas";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = markReadSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid body" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("mark_notifications_read", {
    p_user_id: authResult.ctx.userId,
    p_notification_ids: parsed.data.ids ?? null,
    p_mark_all: parsed.data.markAll ?? false,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: { marked: (data as number) ?? 0 } });
}
