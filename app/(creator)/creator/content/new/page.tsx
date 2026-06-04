import { PostEditor } from "@/components/posts/post-editor";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function NewPostPage() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/content/new");

  const { data: plans } = await supabase
    .from("subscription_plans")
    .select("id, name")
    .eq("creator_id", auth.userId)
    .eq("is_active", true)
    .order("sort_order");

  return (
    <PostEditor
      plans={(plans ?? []).map((p) => ({ id: p.id, name: p.name }))}
    />
  );
}
