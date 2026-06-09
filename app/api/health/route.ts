import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, boolean> = { database: false };

  try {
    const admin = createAdminClient();
    const { error } = await admin.from("profiles").select("id").limit(1);
    checks.database = !error;
  } catch {
    checks.database = false;
  }

  const healthy = Object.values(checks).every(Boolean);

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      checks,
      service: "fanbase-ng",
      timestamp: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
