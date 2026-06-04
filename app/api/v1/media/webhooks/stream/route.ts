import { NextResponse } from "next/server";

import { getMediaWebhookSecret } from "@/lib/media/config";
import { verifyStreamWebhookRequest } from "@/lib/media/crypto";
import { handleStreamWebhook } from "@/lib/media/service";
import { createAdminClient } from "@/lib/supabase/admin";

type StreamWebhookBody = {
  uid?: string;
  status?: { state?: string };
  thumbnail?: string;
  meta?: Record<string, string>;
};

export async function POST(request: Request) {
  const secret = getMediaWebhookSecret();
  const rawBody = await request.text();

  const authorized = verifyStreamWebhookRequest({
    rawBody,
    secret,
    customSecretHeader: request.headers.get("x-media-webhook-secret"),
    cloudflareSignatureHeader:
      request.headers.get("webhook-signature") ??
      request.headers.get("Webhook-Signature"),
  });

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: StreamWebhookBody;
  try {
    body = JSON.parse(rawBody) as StreamWebhookBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const streamUid = body.uid;
  const state = body.status?.state;

  if (!streamUid || !state) {
    return NextResponse.json({ error: "Missing uid or status" }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    await handleStreamWebhook(admin, {
      streamUid,
      state,
      thumbnail: body.thumbnail,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
