import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { cancelSubscriptionAtPeriodEnd } from "@/lib/subscriptions/lifecycle";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ subscriptionId: string }> };

export async function POST(_request: Request, context: RouteContext) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const { subscriptionId } = await context.params;
  if (!subscriptionId) {
    return NextResponse.json({ error: "Missing subscription id" }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    await cancelSubscriptionAtPeriodEnd(
      supabase,
      subscriptionId,
      authResult.ctx.userId,
    );
    return NextResponse.json({ data: { cancelled: true } });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not cancel subscription.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
