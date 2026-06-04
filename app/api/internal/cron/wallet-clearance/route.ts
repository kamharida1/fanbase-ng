import { NextResponse } from "next/server";

import { writeAuditLog } from "@/lib/audit/log";
import { runWalletClearances } from "@/lib/wallets/ledger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
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

    return NextResponse.json({ ok: true, cleared });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Clearance failed";
    console.error("[cron wallet-clearance]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
