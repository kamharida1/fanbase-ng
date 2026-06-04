import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiAuth } from "@/lib/auth/api";
import { enforceRateLimit } from "@/lib/rate-limit-http";
import { verifyAndFulfillPayment } from "@/lib/payments/verify";
import { createAdminClient } from "@/lib/supabase/admin";

const verifySchema = z.object({
  reference: z.string().min(8).max(120),
});

function requestIdFrom(request: Request): string {
  return request.headers.get("x-request-id") ?? crypto.randomUUID();
}

export async function POST(request: Request) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const limited = await enforceRateLimit(
    request,
    "paymentVerify",
    authResult.ctx.userId,
  );
  if (limited) return limited;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = verifySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid reference" },
      { status: 400 },
    );
  }

  try {
    const admin = createAdminClient();
    const result = await verifyAndFulfillPayment(admin, {
      reference: parsed.data.reference,
      fanId: authResult.ctx.userId,
      requestId: requestIdFrom(request),
    });

    return NextResponse.json({ data: result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Verification failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
