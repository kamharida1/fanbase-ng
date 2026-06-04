import type { SupabaseClient } from "@supabase/supabase-js";

import { buildAppActionUrl, toSafeNotificationHref } from "@/lib/security/safe-url";
import type { NotificationType } from "@/types/notifications";

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  actionUrl?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string | null;
};

export async function createNotification(
  admin: SupabaseClient,
  input: CreateNotificationInput,
): Promise<string | null> {
  let actionUrl: string | null = null;
  if (input.actionUrl) {
    const path = toSafeNotificationHref(input.actionUrl);
    actionUrl = path ? buildAppActionUrl(path) : null;
  }

  const { data, error } = await admin.rpc("create_notification", {
    p_user_id: input.userId,
    p_type: input.type,
    p_title: input.title,
    p_body: input.body ?? null,
    p_action_url: actionUrl,
    p_entity_type: input.entityType ?? null,
    p_entity_id: input.entityId ?? null,
    p_metadata: input.metadata ?? {},
    p_idempotency_key: input.idempotencyKey ?? null,
  });

  if (error) {
    console.error("[notifications] create", error.message, input.type);
    return null;
  }

  return (data as string | null) ?? null;
}
