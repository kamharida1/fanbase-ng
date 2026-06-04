import { NextResponse } from "next/server";

import {
  ngnToKobo,
  subscriptionPlanSchema,
} from "@/lib/creators/schemas";
import { requireApiAuth } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const authResult = await requireApiAuth("creator");
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("creator_id", authResult.ctx.userId)
    .order("sort_order", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data });
}

export async function POST(request: Request) {
  const authResult = await requireApiAuth("creator");
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const parsed = subscriptionPlanSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("subscription_plans")
    .insert({
      creator_id: authResult.ctx.userId,
      name: parsed.data.name,
      description: parsed.data.description || null,
      price_kobo: ngnToKobo(parsed.data.price_ngn),
      billing_interval: parsed.data.billing_interval,
      trial_days: parsed.data.trial_days,
      sort_order: parsed.data.sort_order,
      is_active: parsed.data.is_active,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ data }, { status: 201 });
}
