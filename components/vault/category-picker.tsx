"use client";

import { useEffect, useState, useTransition } from "react";
import { Folder } from "lucide-react";

import { setPostCategories } from "@/lib/vault/actions";
import type { CategoryRow } from "@/lib/vault/queries";

type Props = {
  postId: string | null;
  categories: CategoryRow[];
  initialCategoryIds: string[];
};

export function CategoryPicker({ postId, categories, initialCategoryIds }: Props) {
  const [selected, setSelected] = useState<Set<string>>(
    new Set(initialCategoryIds),
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setSelected(new Set(initialCategoryIds));
  }, [initialCategoryIds]);

  if (!categories.length) {
    return (
      <p className="text-sm text-muted-foreground">
        No collections yet.{" "}
        <a href="/creator/vault" className="underline">
          Create one
        </a>{" "}
        to organise your posts.
      </p>
    );
  }

  function toggle(categoryId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);

      if (postId) {
        startTransition(async () => {
          await setPostCategories({ postId: postId!, categoryIds: [...next] });
        });
      }

      return next;
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {categories.map((cat) => {
          const active = selected.has(cat.id);
          return (
            <button
              key={cat.id}
              type="button"
              onClick={() => toggle(cat.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                active
                  ? "border-primary bg-primary text-primary-foreground"
                  : "hover:border-primary hover:text-primary"
              }`}
            >
              <Folder className="h-3.5 w-3.5" />
              {cat.name}
            </button>
          );
        })}
      </div>
      {selected.size > 0 && (
        <p className="text-xs text-muted-foreground">
          In {selected.size} collection{selected.size !== 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
}
