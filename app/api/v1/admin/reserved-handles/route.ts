import { NextResponse } from "next/server";
import { z } from "zod";

import { requireApiAuth } from "@/lib/auth/api";
import { normalizeHandle } from "@/lib/auth/username-guard";
import { createAdminClient } from "@/lib/supabase/admin";

const addHandleSchema = z.object({
  handles: z
    .array(
      z.object({
        handle: z.string().min(2).max(64),
        reason: z.string().max(200).optional(),
      }),
    )
    .min(1)
    .max(100),
});

/** GET /api/v1/admin/reserved-handles — list all reserved handles */
export async function GET(): Promise<Response> {
  const authResult = await requireApiAuth("admin");
  if (authResult instanceof NextResponse) return authResult;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("reserved_handles")
    .select("id, handle, normalized_handle, reason, created_at")
    .order("handle");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ data: data ?? [] });
}

/** POST /api/v1/admin/reserved-handles — bulk-add handles */
export async function POST(request: Request): Promise<Response> {
  const authResult = await requireApiAuth("admin");
  if (authResult instanceof NextResponse) return authResult;

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = addHandleSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid payload" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { userId } = authResult.ctx;

  const rows = parsed.data.handles.map(({ handle, reason }) => ({
    handle,
    normalized_handle: normalizeHandle(handle),
    reason: reason ?? null,
    reserved_by: userId,
  }));

  const { data, error } = await admin
    .from("reserved_handles")
    .upsert(rows, { onConflict: "normalized_handle", ignoreDuplicates: true })
    .select("id, handle");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ added: data?.length ?? 0 }, { status: 201 });
}

/** DELETE /api/v1/admin/reserved-handles?id=<uuid> — remove a handle */
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
    .from("reserved_handles")
    .delete()
    .eq("id", id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
