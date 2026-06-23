import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { verifyCronBearer } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Privacy policy states audit logs are kept for 24 months.
const RETENTION_MONTHS = 24;

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startMs = Date.now();
  const admin = createAdminClient();

  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - RETENTION_MONTHS);
  const cutoffIso = cutoff.toISOString();

  // audit_logs is partitioned by created_at — the DELETE uses the partition
  // key directly so Postgres can prune whole partitions rather than row-scan.
  const { error, count } = await admin
    .from("audit_logs")
    .delete({ count: "exact" })
    .lt("created_at", cutoffIso);

  if (error) {
    logger.error("cron.purge_audit_logs_failed", { err: error, cutoff: cutoffIso });
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  logger.info("cron.purge_audit_logs_completed", {
    deleted: count ?? 0,
    cutoff: cutoffIso,
    durationMs: Date.now() - startMs,
  });

  return NextResponse.json({ ok: true, deleted: count ?? 0, cutoff: cutoffIso });
}
