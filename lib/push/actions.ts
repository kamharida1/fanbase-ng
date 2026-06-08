"use server";

import { z } from "zod";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export type PushActionResult =
  | { success: true }
  | { success: false; error: string };

const subscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  p256dh: z.string().min(1).max(512),
  auth: z.string().min(1).max(512),
  userAgent: z.string().max(512).optional(),
});

export async function savePushSubscription(
  input: z.infer<typeof subscriptionSchema>,
): Promise<PushActionResult> {
  const parsed = subscriptionSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Invalid push subscription." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: auth.userId,
      endpoint: parsed.data.endpoint,
      p256dh: parsed.data.p256dh,
      auth_key: parsed.data.auth,
      user_agent: parsed.data.userAgent ?? null,
    },
    { onConflict: "user_id,endpoint" },
  );

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deletePushSubscription(endpoint: string): Promise<PushActionResult> {
  if (!endpoint) return { success: false, error: "Missing endpoint." };

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", auth.userId)
    .eq("endpoint", endpoint);

  if (error) return { success: false, error: error.message };
  return { success: true };
}
