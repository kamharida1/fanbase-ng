import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { expireEndedSubscriptions } from "@/lib/subscriptions/lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startMs = Date.now();
    const admin = createAdminClient();
    const result = await expireEndedSubscriptions(admin);
    logger.info("cron.subscription_reconcile_completed", { ...result, durationMs: Date.now() - startMs });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("cron.subscription_reconcile_failed", { err });
    const message = err instanceof Error ? err.message : "Reconcile failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
