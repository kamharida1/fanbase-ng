import { PostEditor } from "@/components/posts/post-editor";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { listCreatorCategories } from "@/lib/vault/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewPostPage() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/content/new");

  const [{ data: plans }, categories] = await Promise.all([
    supabase
      .from("subscription_plans")
      .select("id, name")
      .eq("creator_id", auth.userId)
      .eq("is_active", true)
      .order("sort_order"),
    listCreatorCategories(supabase, auth.userId),
  ]);

  return (
    <PostEditor
      plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name }))}
      categories={categories}
    />
  );
}
