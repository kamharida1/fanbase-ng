import { notFound } from "next/navigation";

import { PostEditor } from "@/components/posts/post-editor";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { getPostById } from "@/lib/posts/queries";
import { listCreatorCategories, getPostCategoryIds } from "@/lib/vault/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

type PageProps = { params: Promise<{ postId: string }> };

export default async function EditPostPage({ params }: PageProps) {
  const { postId } = await params;
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/content");

  const post = await getPostById(supabase, postId, auth.userId);
  if (!post || post.creator_id !== auth.userId) notFound();

  const [{ data: plans }, categories, assignedCategoryIds] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("id, name")
      .eq("creator_id", auth.userId)
      .eq("is_active", true),
    listCreatorCategories(supabase, auth.userId),
    getPostCategoryIds(supabase, postId),
  ]);

  return (
    <PostEditor
      post={post}
      plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name }))}
      categories={categories}
      assignedCategoryIds={assignedCategoryIds}
    />
  );
}
