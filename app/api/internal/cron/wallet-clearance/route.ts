import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { logger } from "@/lib/logger";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { runWalletClearances } from "@/lib/wallets/ledger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const startMs = Date.now();
    const admin = createAdminClient();
    const cleared = await runWalletClearances(admin);

    if (cleared > 0) {
      await writeAuditLog(admin, {
        actorType: "system",
        action: "wallet.cleared",
        entityType: "wallets",
        metadata: { cleared_count: cleared },
      });
    }

    logger.info("cron.wallet_clearance_completed", { cleared, durationMs: Date.now() - startMs });
    return NextResponse.json({ ok: true, cleared });
  } catch (err) {
    logger.error("cron.wallet_clearance_failed", { err });
    const message = err instanceof Error ? err.message : "Clearance failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
