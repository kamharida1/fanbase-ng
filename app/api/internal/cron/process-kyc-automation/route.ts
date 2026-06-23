import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { autoApprovePendingKyc } from "@/lib/kyc/auto-approve";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const result = await autoApprovePendingKyc(admin);

    logger.info("cron.kyc_automation_completed", result);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    logger.error("cron.kyc_automation_failed", { err });
    const message = err instanceof Error ? err.message : "KYC automation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
