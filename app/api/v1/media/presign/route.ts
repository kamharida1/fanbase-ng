import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { enforceRateLimit } from "@/lib/rate-limit-http";
import { presignMediaSchema } from "@/lib/media/schemas";
import { createPresignedUpload } from "@/lib/media/service";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const limited = await enforceRateLimit(
    request,
    "mediaPresign",
    authResult.ctx.userId,
  );
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = presignMediaSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const result = await createPresignedUpload(supabase, {
    userId: authResult.ctx.userId,
    isCreator: authResult.ctx.profile.role === "creator",
    context: parsed.data.context,
    contextRefId: parsed.data.contextRefId,
    mime: parsed.data.mime,
    byteSize: parsed.data.byteSize,
    filename: parsed.data.filename,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  return NextResponse.json({ data: result });
}
