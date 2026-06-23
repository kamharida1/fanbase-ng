import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import {
  autoProcessEligiblePayouts,
  notifyStalePayouts,
} from "@/lib/wallets/payout-processor";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const [automation, delayedNotices] = await Promise.all([
      autoProcessEligiblePayouts(admin),
      notifyStalePayouts(admin),
    ]);

    logger.info("cron.payout_automation_completed", {
      ...automation,
      delayedNotices,
    });

    return NextResponse.json({
      ok: true,
      ...automation,
      delayedNotices,
    });
  } catch (err) {
    logger.error("cron.payout_automation_failed", { err });
    const message = err instanceof Error ? err.message : "Payout automation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
