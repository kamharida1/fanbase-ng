import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Pending payments older than this are assumed abandoned (Paystack checkout
// sessions expire after 1 hour; we give 24h of slack before marking them).
const ABANDON_AFTER_HOURS = 24;

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const cutoff = new Date(
    Date.now() - ABANDON_AFTER_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const { data: abandoned, error } = await admin
    .from("payments")
    .update({ status: "abandoned" })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");

  if (error) {
    logger.error("cron.cleanup_pending_payments_failed", { err: error });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const count = abandoned?.length ?? 0;
  if (count > 0) {
    logger.info("cron.pending_payments_abandoned", { count, cutoff });
  }

  return NextResponse.json({ ok: true, abandoned: count });
}
