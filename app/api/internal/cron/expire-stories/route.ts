import { NextResponse } from "next/server";

import { verifyCronBearer } from "@/lib/security/cron-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("posts")
    .update({ status: "archived" })
    .eq("is_story", true)
    .eq("status", "published")
    .lt("expires_at", new Date().toISOString())
    .select("id");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ expired: data?.length ?? 0 });
}
