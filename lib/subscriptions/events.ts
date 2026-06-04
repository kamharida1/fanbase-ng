import type { SupabaseClient } from "@supabase/supabase-js";

export async function logSubscriptionEvent(
  supabase: SupabaseClient,
  subscriptionId: string,
  eventType: string,
  payload: Record<string, unknown> = {},
  source = "system",
): Promise<void> {
  const { error } = await supabase.from("subscription_events").insert({
    subscription_id: subscriptionId,
    event_type: eventType,
    payload,
    source,
  });

  if (error) {
    console.error("[subscription_events]", error.message, {
      subscriptionId,
      eventType,
    });
  }
}
