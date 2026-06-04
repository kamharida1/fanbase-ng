import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { confirmMediaSchema } from "@/lib/media/schemas";
import { confirmMediaUpload } from "@/lib/media/service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = confirmMediaSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const result = await confirmMediaUpload(admin, {
      userId: authResult.ctx.userId,
      uploadId: parsed.data.uploadId,
      streamUid: parsed.data.streamUid,
    });

    if ("error" in result) {
      const status = result.error.includes("processing") ? 202 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Confirm failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
