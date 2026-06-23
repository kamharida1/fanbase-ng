import { NextResponse } from "next/server";

import { sendWeeklyDigest } from "@/lib/email/digest";
import { logger } from "@/lib/logger";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const MS_DAY = 86_400_000;
const DUE_AFTER_DAYS = 6;
// Cap per cron invocation to stay well within Vercel's function timeout.
// The scheduler fires this route daily, so the backlog drains across runs.
const BATCH_PER_RUN = 200;

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();
  const admin = createAdminClient();
  const dueBefore = new Date(Date.now() - DUE_AFTER_DAYS * MS_DAY).toISOString();

  const { data: candidates } = await admin
    .from("notification_preferences")
    .select("user_id")
    .eq("digest_enabled", true)
    .eq("email_enabled", true)
    .or(`last_digest_sent_at.is.null,last_digest_sent_at.lt.${dueBefore}`)
    .limit(BATCH_PER_RUN)
    .order("last_digest_sent_at", { ascending: true, nullsFirst: true });

  let sent = 0;
  for (const candidate of candidates ?? []) {
    const userId = candidate.user_id as string;
    try {
      const [{ data: authUser }, { data: profile }] = await Promise.all([
        admin.auth.admin.getUserById(userId),
        admin.from("profiles").select("display_name, username").eq("id", userId).maybeSingle(),
      ]);

      const email = authUser?.user?.email;
      if (!email) continue;

      const displayName = profile?.display_name ?? profile?.username ?? "there";

      const delivered = await sendWeeklyDigest(admin, { userId, email, displayName });

      await admin
        .from("notification_preferences")
        .update({ last_digest_sent_at: new Date().toISOString() })
        .eq("user_id", userId);

      if (delivered) sent += 1;
    } catch (err) {
      logger.warn("cron.email_digest_failed", { err, userId });
    }
  }

  logger.info("cron.email_digests_completed", { candidates: candidates?.length ?? 0, sent, durationMs: Date.now() - startMs });
  return NextResponse.json({ ok: true, candidates: candidates?.length ?? 0, sent });
}
