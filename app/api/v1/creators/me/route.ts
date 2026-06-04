import { NextResponse } from "next/server";

import { updateCreatorProfileSchema, updateProfileBasicsSchema } from "@/lib/creators/schemas";
import { getCreatorStudioProfile } from "@/lib/creators/queries";
import { normalizeSocialLinks } from "@/lib/creators/format";
import { requireApiAuth } from "@/lib/auth/api";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const authResult = await requireApiAuth("creator");
  if (authResult instanceof NextResponse) return authResult;

  const supabase = await createClient();
  const studio = await getCreatorStudioProfile(
    supabase,
    authResult.ctx.userId,
  );

  return NextResponse.json({ data: studio });
}

export async function PATCH(request: Request) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const supabase = await createClient();

  if (body.profile) {
    const parsed = updateProfileBasicsSchema.safeParse(body.profile);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: parsed.data.display_name,
        username: parsed.data.username,
      })
      .eq("id", authResult.ctx.userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  if (body.creator) {
    if (authResult.ctx.profile.role !== "creator") {
      return NextResponse.json(
        { error: "Creator account required" },
        { status: 403 },
      );
    }

    const parsed = updateCreatorProfileSchema.safeParse(body.creator);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { error } = await supabase
      .from("creator_profiles")
      .update({
        bio: parsed.data.bio || null,
        is_accepting_subscribers:
          parsed.data.is_accepting_subscribers ?? true,
        social_links: normalizeSocialLinks(parsed.data.social_links),
      })
      .eq("user_id", authResult.ctx.userId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
  }

  const studio = await getCreatorStudioProfile(
    supabase,
    authResult.ctx.userId,
  );

  return NextResponse.json({ data: studio });
}
