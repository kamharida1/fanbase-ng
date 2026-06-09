"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { checkHandleForImpersonation } from "@/lib/auth/username-guard";
import { createClient } from "@/lib/supabase/server";

const updateProfileSchema = z.object({
  display_name: z.string().min(1).max(64).trim(),
});

export type ProfileActionResult =
  | { success: true }
  | { success: false; error: string };

export async function updateProfileAction(
  input: unknown,
): Promise<ProfileActionResult> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? "Invalid input",
    };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  const guard = await checkHandleForImpersonation({
    displayName: parsed.data.display_name,
    excludeUserId: auth.userId,
  });
  if (!guard.ok) {
    return { success: false, error: guard.reason };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ display_name: parsed.data.display_name })
    .eq("id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/settings");
  revalidatePath("/creator/settings");
  return { success: true };
}
