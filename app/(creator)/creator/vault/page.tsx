import Link from "next/link";
import { redirect } from "next/navigation";

import { CategoryManager } from "@/components/vault/category-manager";
import { requireAuth } from "@/lib/auth/get-auth-context";
import { listCreatorCategories } from "@/lib/vault/queries";
import { createClient } from "@/lib/supabase/server";

export default async function CreatorVaultPage() {
  const supabase = await createClient();
  const auth = await requireAuth(supabase);

  if (auth.profile.role !== "creator") redirect("/settings");

  const categories = await listCreatorCategories(supabase, auth.userId);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Content vault</h1>
        <p className="mt-2 text-muted-foreground">
          Organise your posts into named collections. Fans can browse by
          collection on your public profile.
        </p>
      </div>

      <CategoryManager categories={categories} />

      {categories.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Your collections</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {categories.map((cat) => (
              <div key={cat.id} className="rounded-xl border p-5 space-y-2">
                <p className="font-semibold">{cat.name}</p>
                {cat.description && (
                  <p className="text-sm text-muted-foreground">{cat.description}</p>
                )}
                <p className="text-sm text-muted-foreground">
                  {cat.post_count} post{cat.post_count !== 1 ? "s" : ""}
                </p>
                <Link
                  href={`/creator/content`}
                  className="text-sm font-medium underline-offset-4 hover:underline"
                >
                  Manage posts →
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-sm text-muted-foreground">
        To add posts to a collection, open any post in{" "}
        <Link href="/creator/content" className="underline">
          Content
        </Link>{" "}
        and use the Collections picker.
      </p>
    </div>
  );
}
