import { NextResponse } from "next/server";

import { getAuthContext } from "@/lib/auth/get-auth-context";
import { enforceRateLimit } from "@/lib/rate-limit-http";
import { deliveryMediaSchema } from "@/lib/media/schemas";
import { getMediaDeliveryUrl } from "@/lib/media/service";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = deliveryMediaSchema.safeParse({
    uploadId: searchParams.get("uploadId") ?? undefined,
    objectKey: searchParams.get("objectKey") ?? undefined,
    streamUid: searchParams.get("streamUid") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid query" },
      { status: 400 },
    );
  }

  if (!parsed.data.uploadId && !parsed.data.objectKey && !parsed.data.streamUid) {
    return NextResponse.json({ error: "Missing media reference." }, { status: 400 });
  }

  const supabase = await createClient();
  const auth = await getAuthContext(supabase);

  const rateKey = auth?.userId ?? "anon";
  const limited = await enforceRateLimit(request, "mediaDelivery", rateKey);
  if (limited) return limited;

  const result = await getMediaDeliveryUrl(supabase, {
    viewerId: auth?.userId ?? null,
    uploadId: parsed.data.uploadId,
    objectKey: parsed.data.objectKey,
    streamUid: parsed.data.streamUid,
  });

  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 403 });
  }

  if (searchParams.get("redirect") === "1") {
    return NextResponse.redirect(result.url, {
      status: 302,
      headers: {
        "Cache-Control": "private, max-age=300",
      },
    });
  }

  return NextResponse.json({ data: result });
}
