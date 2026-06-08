"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAuth } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";

export type VerificationResult =
  | { success: true }
  | { success: false; error: string };

const requestSchema = z.object({
  note: z.string().trim().min(10, "Please describe yourself in at least 10 characters.").max(500),
});

export async function requestVerification(
  input: unknown,
): Promise<VerificationResult> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") {
    return { success: false, error: "Creator account required." };
  }

  // Only allow if currently none or rejected
  const { data: profile } = await supabase
    .from("profiles")
    .select("kyc_status")
    .eq("id", auth.userId)
    .single();

  if (profile?.kyc_status === "pending") {
    return { success: false, error: "Your request is already under review." };
  }
  if (profile?.kyc_status === "verified") {
    return { success: false, error: "You are already verified." };
  }

  const { error } = await supabase
    .from("profiles")
    .update({
      kyc_status: "pending",
      verification_note: parsed.data.note,
      verification_rejected_reason: null,
    })
    .eq("id", auth.userId);

  if (error) return { success: false, error: error.message };

  revalidatePath("/creator/profile");
  return { success: true };
}
