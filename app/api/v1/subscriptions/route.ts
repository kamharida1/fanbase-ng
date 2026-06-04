import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { listFanSubscriptions } from "@/lib/subscriptions/queries";
import { subscribeSchema } from "@/lib/subscriptions/schemas";
import { startSubscription } from "@/lib/subscriptions/service";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const data = await listFanSubscriptions(supabase, authResult.ctx.userId);

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = subscribeSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid request" },
      { status: 400 },
    );
  }

  if (!authResult.ctx.email) {
    return NextResponse.json(
      { error: "Account email is required for checkout." },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  try {
    const result = await startSubscription(supabase, {
      fanId: authResult.ctx.userId,
      fanEmail: authResult.ctx.email,
      planId: parsed.data.planId,
    });

    if (result.type === "active") {
      return NextResponse.json({
        data: { subscriptionId: result.subscriptionId, status: "active" },
      });
    }

    return NextResponse.json({
      data: {
        authorizationUrl: result.authorizationUrl,
        reference: result.reference,
      },
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not start subscription.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
