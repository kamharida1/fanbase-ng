import type { SupabaseClient } from "@supabase/supabase-js";

import { enrichPosts } from "@/lib/posts/queries";
import type { PostRow } from "@/types/posts";

export type CategoryRow = {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  sort_order: number;
  post_count: number;
  cover_url: string | null;
  created_at: string;
};

export async function listCreatorCategories(
  supabase: SupabaseClient,
  creatorId: string,
): Promise<CategoryRow[]> {
  const { data, error } = await supabase
    .from("post_categories")
    .select(
      `id, creator_id, name, description, sort_order, created_at,
       post_category_assignments (
         posts!inner (id, status, post_media!left (r2_key, thumbnail_url, sort_order))
       )`,
    )
    .eq("creator_id", creatorId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error || !data) return [];

  return data.map((cat) => {
    type AssignmentRow = {
      posts: {
        id: string;
        status: string;
        post_media: { r2_key: string | null; thumbnail_url: string | null; sort_order: number }[];
      } | null;
    };
    const assignments = (cat.post_category_assignments as unknown as AssignmentRow[]) ?? [];

    const publishedPosts = assignments.filter(
      (a) => a.posts?.status === "published",
    );

    const firstMedia = publishedPosts
      .flatMap((a) =>
        (a.posts?.post_media ?? [])
          .sort((x, y) => x.sort_order - y.sort_order)
          .slice(0, 1),
      )
      .find((m) => m.r2_key || m.thumbnail_url);

    const coverUrl = firstMedia?.thumbnail_url ?? null;

    return {
      id: cat.id,
      creator_id: cat.creator_id,
      name: cat.name,
      description: cat.description,
      sort_order: cat.sort_order,
      post_count: publishedPosts.length,
      cover_url: coverUrl,
      created_at: cat.created_at,
    };
  });
}

export async function getCategoryPosts(
  supabase: SupabaseClient,
  categoryId: string,
  viewerId: string | null,
  limit = 20,
): Promise<PostRow[]> {
  const { data, error } = await supabase
    .from("post_category_assignments")
    .select("posts!inner (*)")
    .eq("category_id", categoryId)
    .eq("posts.status", "published")
    .order("assigned_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];

  const posts = data.map((row) => row.posts as unknown as Record<string, unknown>);
  return enrichPosts(supabase, posts, viewerId);
}

export async function getPostCategoryIds(
  supabase: SupabaseClient,
  postId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from("post_category_assignments")
    .select("category_id")
    .eq("post_id", postId);

  return (data ?? []).map((r) => r.category_id);
}
