"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addPostComment } from "@/lib/posts/actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import type { PostCommentRow } from "@/types/posts";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function CommentSection({
  postId,
  comments,
}: {
  postId: string;
  comments: PostCommentRow[];
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await addPostComment({ postId, body });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {comments.map((c) => (
          <li key={c.id} className="text-sm">
            <span className="font-medium">
              {c.author?.display_name ?? c.author?.username ?? "User"}
            </span>
            <span className="ml-2 text-xs text-muted-foreground">
              {formatWhen(c.created_at)}
            </span>
            <p className="mt-0.5 whitespace-pre-wrap">{c.body}</p>
          </li>
        ))}
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        ) : null}
      </ul>
      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="resize-none"
        />
        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        <Button type="submit" size="sm" disabled={loading || !body.trim()}>
          Comment
        </Button>
      </form>
    </div>
  );
}
