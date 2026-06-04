import { NextResponse } from "next/server";

import { expireStaleUploads } from "@/lib/media/service";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST() {
  try {
    const admin = createAdminClient();
    const expired = await expireStaleUploads(admin);
    return NextResponse.json({ ok: true, expired });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Expire failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
