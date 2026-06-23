"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { writeAuditLog } from "@/lib/audit/log";
import { requireAdminStaff } from "@/lib/admin/require";
import { createAdminClient } from "@/lib/supabase/admin";

export type ContentHashRow = {
  id: string;
  sha256_hex: string;
  category: string;
  severity: string;
  source: string;
  notes: string | null;
  created_at: string;
};

export type ContentHashStats = {
  total: number;
  by_category: Record<string, number>;
};

export type HashActionResult =
  | { success: true; imported?: number }
  | { success: false; error: string };

const importSchema = z.object({
  rawHashes: z.string().min(1),
  category: z.enum(["csam", "ncii", "violence", "spam", "other"]),
  severity: z.enum(["critical", "high", "medium"]).default("critical"),
  source: z.enum(["ncmec", "stopncii", "internal", "manual"]).default("manual"),
  notes: z.string().max(500).optional(),
});

export async function listContentHashes(): Promise<ContentHashRow[]> {
  await requireAdminStaff("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_violation_hashes")
    .select("id, sha256_hex, category, severity, source, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(500);
  return data ?? [];
}

export async function getContentHashStats(): Promise<ContentHashStats> {
  await requireAdminStaff("admin");
  const admin = createAdminClient();
  const { data } = await admin
    .from("content_violation_hashes")
    .select("category");

  const rows = data ?? [];
  const by_category: Record<string, number> = {};
  for (const row of rows) {
    by_category[row.category] = (by_category[row.category] ?? 0) + 1;
  }
  return { total: rows.length, by_category };
}

export async function importContentHashes(
  input: unknown,
): Promise<HashActionResult> {
  const ctx = await requireAdminStaff("admin");
  const parsed = importSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }

  const { rawHashes, category, severity, source, notes } = parsed.data;

  // Accept one SHA-256 hex per line; strip whitespace, skip blanks and comments.
  const hashes = rawHashes
    .split(/[\n,]+/)
    .map((l) => l.trim().toLowerCase())
    .filter((l) => /^[0-9a-f]{64}$/.test(l));

  if (hashes.length === 0) {
    return { success: false, error: "No valid SHA-256 hashes found. Each hash must be 64 lowercase hex characters." };
  }

  const admin = createAdminClient();
  const rows = hashes.map((sha256_hex) => ({
    sha256_hex,
    category,
    severity,
    source,
    notes: notes ?? null,
    added_by: ctx.userId,
  }));

  const { data, error } = await admin
    .from("content_violation_hashes")
    .upsert(rows, { onConflict: "sha256_hex", ignoreDuplicates: true })
    .select("id");

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog(admin, {
    actorId: ctx.userId,
    actorType: "user",
    action: "admin.content_hashes.imported",
    entityType: "content_violation_hashes",
    metadata: { attempted: hashes.length, imported: data?.length ?? 0, category, source },
  });

  revalidatePath("/admin/moderation");
  return { success: true, imported: data?.length ?? 0 };
}

export async function deleteContentHash(id: string): Promise<HashActionResult> {
  const ctx = await requireAdminStaff("super_admin");
  const admin = createAdminClient();

  const { error } = await admin
    .from("content_violation_hashes")
    .delete()
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  await writeAuditLog(admin, {
    actorId: ctx.userId,
    actorType: "user",
    action: "admin.content_hashes.deleted",
    entityType: "content_violation_hashes",
    entityId: id,
  });

  revalidatePath("/admin/moderation");
  return { success: true };
}
