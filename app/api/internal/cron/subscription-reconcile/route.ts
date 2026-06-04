import { NextResponse } from "next/server";

import { expireEndedSubscriptions } from "@/lib/subscriptions/lifecycle";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const admin = createAdminClient();
    const result = await expireEndedSubscriptions(admin);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reconcile failed";
    console.error("[cron subscription-reconcile]", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
