import { NextResponse } from "next/server";

import { logger } from "@/lib/logger";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  const checks: Record<string, "ok" | "error"> = {
    supabase: "error",
  };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id").limit(1);
    checks.supabase = error ? "error" : "ok";
  } catch (err) {
    logger.error("ready.supabase_failed", {
      error: err instanceof Error ? err.message : "unknown",
    });
  }

  const ready = Object.values(checks).every((v) => v === "ok");

  return NextResponse.json(
    {
      status: ready ? "ready" : "degraded",
      checks,
      timestamp: new Date().toISOString(),
    },
    { status: ready ? 200 : 503 },
  );
}
