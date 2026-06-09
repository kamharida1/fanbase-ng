import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiAuth } from "@/lib/auth/api";
import { writeAuditLog } from "@/lib/audit/log";
import { createAdminClient } from "@/lib/supabase/admin";

const addHashSchema = z.object({
  hashes: z
    .array(
      z.object({
        sha256_hex: z.string().regex(/^[0-9a-f]{64}$/, "Must be a lowercase hex SHA-256"),
        category: z.enum(["csam", "ncii", "violence", "spam", "other"]),
        severity: z.enum(["critical", "high", "medium"]).default("critical"),
        source: z.enum(["ncmec", "stopncii", "internal", "manual"]).default("manual"),
        notes: z.string().max(500).optional(),
      }),
    )
    .min(1)
    .max(1000),
});

/** GET /api/v1/admin/content-hashes — list registry (admin only) */
export async function GET(): Promise<Response> {
  const authResult = await requireApiAuth("admin");
  if (authResult instanceof NextResponse) return authResult;

  const admin = createAdminClient();

  const { data, error } = await admin
    .from("content_violation_hashes")
    .select("id, sha256_hex, category, severity, source, notes, created_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

/** POST /api/v1/admin/content-hashes — bulk-import hashes (admin only) */
export async function POST(request: Request): Promise<Response> {
  const authResult = await requireApiAuth("admin");
  if (authResult instanceof NextResponse) return authResult;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addHashSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { userId } = authResult.ctx;

  const rows = parsed.data.hashes.map((h) => ({
    ...h,
    added_by: userId,
  }));

  const { data, error } = await admin
    .from("content_violation_hashes")
    .upsert(rows, { onConflict: "sha256_hex", ignoreDuplicates: true })
    .select("id, sha256_hex, category");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    actorId: userId,
    actorType: "user",
    action: "admin.content_hashes.imported",
    entityType: "content_violation_hashes",
    metadata: { count: parsed.data.hashes.length, categories: [...new Set(parsed.data.hashes.map((h) => h.category))] },
  });

  return NextResponse.json({ imported: data?.length ?? 0 });
}

/** DELETE /api/v1/admin/content-hashes?id=<uuid> — remove a hash (super_admin only) */
export async function DELETE(request: Request): Promise<Response> {
  const authResult = await requireApiAuth("super_admin");
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("content_violation_hashes")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await writeAuditLog(admin, {
    actorId: authResult.ctx.userId,
    actorType: "user",
    action: "admin.content_hashes.deleted",
    entityType: "content_violation_hashes",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
