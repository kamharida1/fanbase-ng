import { NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";

import { writeAuditLog } from "@/lib/audit/log";
import { feedCacheTag } from "@/lib/feed/queries";
import { getMediaWebhookSecret } from "@/lib/media/config";
import { verifyWebhookSecret } from "@/lib/media/crypto";
import { virusScanWebhookSchema } from "@/lib/media/schemas";
import {
  applyVirusScanResult,
  finalizeUploadAfterScan,
} from "@/lib/media/virus-scan";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const secret = getMediaWebhookSecret();
  const provided = request.headers.get("x-media-webhook-secret");

  if (!verifyWebhookSecret(provided, secret)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = virusScanWebhookSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const upload = await applyVirusScanResult(admin, {
      uploadId: parsed.data.uploadId,
      status: parsed.data.status,
      provider: parsed.data.provider,
      details: parsed.data.details,
    });

    if (!upload) {
      return NextResponse.json({ error: "Upload not found" }, { status: 404 });
    }

    if (parsed.data.status === "clean") {
      await finalizeUploadAfterScan(admin, parsed.data.uploadId);
    }

    if (upload.context === "post" && upload.owner_id) {
      revalidatePath("/creator/content");
      revalidatePath("/feed");
      revalidatePath("/discover");
      revalidateTag(feedCacheTag(upload.owner_id));

      const { data: profile } = await admin
        .from("profiles")
        .select("username")
        .eq("id", upload.owner_id)
        .maybeSingle();

      if (profile?.username) {
        revalidatePath(`/creators/${profile.username}`);
      }
    }

    await writeAuditLog(admin, {
      actorType: "system",
      action: "media.scan.completed",
      entityType: "media_uploads",
      entityId: parsed.data.uploadId,
      metadata: {
        status: parsed.data.status,
        provider: parsed.data.provider,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Webhook failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
