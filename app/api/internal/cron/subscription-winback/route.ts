import { NextResponse } from "next/server";

import { isFanBlocked } from "@/lib/fans/queries";
import { logger } from "@/lib/logger";
import { notifyWinBackReminder } from "@/lib/notifications/emit";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { getBlockingSubscription } from "@/lib/subscriptions/lifecycle";
import { WIN_BACK_DELAY_DAYS, WIN_BACK_WINDOW_DAYS } from "@/lib/subscriptions/period";
import { findWinBackCandidates } from "@/lib/subscriptions/queries";
import { createAdminClient } from "@/lib/supabase/admin";

const MS_DAY = 86_400_000;

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();
  const admin = createAdminClient();
  const now = Date.now();
  const windowEnd = new Date(now - WIN_BACK_DELAY_DAYS * MS_DAY);
  const windowStart = new Date(windowEnd.getTime() - WIN_BACK_WINDOW_DAYS * MS_DAY);

  const candidates = await findWinBackCandidates(admin, windowStart, windowEnd);

  let sent = 0;
  for (const candidate of candidates) {
    try {
      const blocking = await getBlockingSubscription(admin, candidate.fanId, candidate.creatorId);
      if (blocking) continue;

      const blocked = await isFanBlocked(admin, candidate.creatorId, candidate.fanId);
      if (blocked) continue;

      await notifyWinBackReminder(admin, candidate);
      sent += 1;
    } catch (err) {
      logger.warn("cron.winback_notify_failed", { err, subscriptionId: candidate.subscriptionId });
    }
  }

  logger.info("cron.winback_completed", { candidates: candidates.length, sent, durationMs: Date.now() - startMs });
  return NextResponse.json({ ok: true, candidates: candidates.length, sent });
}
