import { NextResponse } from "next/server";

import { getCreatorByUsername } from "@/lib/creators/queries";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ username: string }> };

export async function GET(_request: Request, { params }: Params) {
  const { username } = await params;
  const supabase = await createClient();
  const creator = await getCreatorByUsername(supabase, username);

  if (!creator) {
    return NextResponse.json({ error: "Creator not found" }, { status: 404 });
  }

  return NextResponse.json({ data: creator });
}
