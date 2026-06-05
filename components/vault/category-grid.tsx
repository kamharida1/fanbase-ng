import Link from "next/link";
import { Folder } from "lucide-react";

import type { CategoryRow } from "@/lib/vault/queries";

type Props = {
  categories: CategoryRow[];
  username: string;
  activeId?: string | null;
};

export function CategoryGrid({ categories, username, activeId }: Props) {
  if (!categories.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold">Collections</h2>
      <div className="flex flex-wrap gap-2">
        <Link
          href={`/creators/${username}`}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
            !activeId
              ? "border-primary bg-primary text-primary-foreground"
              : "hover:border-primary hover:text-primary"
          }`}
        >
          All posts
        </Link>
        {categories.map((cat) => (
          <Link
            key={cat.id}
            href={`/creators/${username}?col=${cat.id}`}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
              activeId === cat.id
                ? "border-primary bg-primary text-primary-foreground"
                : "hover:border-primary hover:text-primary"
            }`}
          >
            <Folder className="h-3.5 w-3.5" />
            {cat.name}
            <span className="text-xs opacity-70">
              {cat.post_count}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
