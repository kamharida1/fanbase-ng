import Link from "next/link";

import { CreatePostPrompt } from "@/components/posts/create-post-prompt";
import { CreatorPostList } from "@/components/posts/creator-post-list";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { listCreatorPosts } from "@/lib/posts/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function CreatorContentPage() {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/creator/content");

  const posts = await listCreatorPosts(supabase, auth.userId);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Content</h1>
          <p className="mt-2 text-muted-foreground">
            Text, images, videos — public, subscriber, tier, or PPV posts.
          </p>
        </div>
        <Link
          href="/creator/content/new"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          New post
        </Link>
      </div>
      <CreatePostPrompt />
      <CreatorPostList posts={posts} />
    </div>
  );
}
