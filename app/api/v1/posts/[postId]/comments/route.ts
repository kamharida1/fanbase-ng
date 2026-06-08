import { NextResponse } from "next/server";

import { requireApiAuth } from "@/lib/auth/api";
import { listPostComments } from "@/lib/posts/queries";
import { createClient } from "@/lib/supabase/server";

type RouteContext = { params: Promise<{ postId: string }> };

export async function GET(_request: Request, context: RouteContext) {
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const { postId } = await context.params;
  const supabase = await createClient();

  const { data: canPreview } = await supabase.rpc("can_preview_post", {
    p_user_id: authResult.ctx.userId,
    p_post_id: postId,
  });

  if (!canPreview) {
    return NextResponse.json({ error: "Post not found." }, { status: 404 });
  }

  const { data: canView } = await supabase.rpc("can_view_post", {
    p_user_id: authResult.ctx.userId,
    p_post_id: postId,
  });

  if (!canView) {
    return NextResponse.json({ data: { comments: [] } });
  }

  const { data: postRow } = await supabase
    .from("posts")
    .select("creator_id")
    .eq("id", postId)
    .maybeSingle();

  const isCreator = postRow?.creator_id === authResult.ctx.userId;
  const comments = await listPostComments(supabase, postId, { includeHidden: isCreator });

  return NextResponse.json(
    { data: { comments } },
    {
      headers: {
        "Cache-Control": "private, max-age=30, stale-while-revalidate=60",
      },
    },
  );
}
