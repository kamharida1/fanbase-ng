import { NextResponse } from "next/server";

import {
  ngnToKobo,
  subscriptionPlanSchema,
} from "@/lib/creators/schemas";
import { requireApiAuth } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

type Params = { params: Promise<{ planId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  const authResult = await requireApiAuth("creator");
  if (authResult instanceof NextResponse) return authResult;

  const { planId } = await params;
  const body = await request.json();
  const parsed = subscriptionPlanSchema.partial().safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined) {
    updates.description = parsed.data.description || null;
  }
  if (parsed.data.price_ngn !== undefined) {
    updates.price_kobo = ngnToKobo(parsed.data.price_ngn);
  }
  if (parsed.data.billing_interval !== undefined) {
    updates.billing_interval = parsed.data.billing_interval;
  }
  if (parsed.data.trial_days !== undefined) {
    updates.trial_days = parsed.data.trial_days;
  }
  if (parsed.data.sort_order !== undefined) {
    updates.sort_order = parsed.data.sort_order;
  }
  if (parsed.data.is_active !== undefined) {
    updates.is_active = parsed.data.is_active;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .update(updates)
    .eq("id", planId)
    .eq("creator_id", authResult.ctx.userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}

export async function DELETE(_request: Request, { params }: Params) {
  const authResult = await requireApiAuth("creator");
  if (authResult instanceof NextResponse) return authResult;

  const { planId } = await params;
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("subscription_plans")
    .update({ is_active: false })
    .eq("id", planId)
    .eq("creator_id", authResult.ctx.userId)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data });
}
