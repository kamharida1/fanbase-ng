import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { notifyScheduledPostPublished } from "@/lib/notifications/emit";
import { verifyCronBearer } from "@/lib/security/cron-auth";

export async function GET(request: Request) {
  if (!verifyCronBearer(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const admin = createAdminClient();

    // publish_due_scheduled_posts now returns rows of (post_id, creator_id)
    const { data: published, error } = await admin.rpc(
      "publish_due_scheduled_posts",
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const rows = (published as { post_id: string; creator_id: string }[] | null) ?? [];

    if (rows.length === 0) {
      return NextResponse.json({ ok: true, published: 0 });
    }

    // Fetch captions for all published posts in one query
    const postIds = rows.map((r) => r.post_id);
    const { data: posts } = await admin
      .from("posts")
      .select("id, caption, creator_id")
      .in("id", postIds);

    const postMap = new Map((posts ?? []).map((p) => [p.id, p]));

    // Fan out notifications concurrently, one per published post
    await Promise.allSettled(
      rows.map(async (row) => {
        const post = postMap.get(row.post_id);
        await notifyScheduledPostPublished(admin, {
          postId: row.post_id,
          creatorId: row.creator_id,
          caption: post?.caption ?? "",
        });
      }),
    );

    return NextResponse.json({ ok: true, published: rows.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
