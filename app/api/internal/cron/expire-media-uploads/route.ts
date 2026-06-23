import { NextResponse } from "next/server";

import { expireStaleUploads } from "@/lib/media/service";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyCronBearer } from "@/lib/security/cron-auth";

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();
    const expired = await expireStaleUploads(admin);
    return NextResponse.json({ ok: true, expired });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Expire failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
