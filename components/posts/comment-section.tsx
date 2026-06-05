"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pin, PinOff, Trash2 } from "lucide-react";

import { addPostComment } from "@/lib/posts/actions";
import { deleteComment, pinComment, unpinComment } from "@/lib/posts/moderation";
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
  comments: initialComments,
  viewerId,
  postCreatorId,
}: {
  postId: string;
  comments: PostCommentRow[];
  viewerId?: string | null;
  postCreatorId?: string;
}) {
  const router = useRouter();
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCreator = viewerId != null && viewerId === postCreatorId;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await addPostComment({ postId, body });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setBody("");
    router.refresh();
  }

  async function handleDelete(commentId: string) {
    setActionId(commentId);
    const result = await deleteComment(commentId);
    setActionId(null);
    if (!result.success) { setError(result.error); return; }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  async function handlePin(comment: PostCommentRow) {
    setActionId(comment.id);
    const result = comment.is_pinned
      ? await unpinComment(comment.id)
      : await pinComment(comment.id, postId);
    setActionId(null);
    if (!result.success) { setError(result.error); return; }
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? { ...c, is_pinned: !comment.is_pinned }
          : comment.is_pinned
            ? c
            : { ...c, is_pinned: false },
      ).sort((a, b) => Number(b.is_pinned) - Number(a.is_pinned)),
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-3">
        {comments.map((c) => {
          const canDelete =
            viewerId === c.author_id || isCreator;

          return (
            <li key={c.id} className="text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  {c.is_pinned && (
                    <span className="mb-1 inline-flex items-center gap-1 text-xs font-medium text-primary">
                      <Pin className="h-3 w-3" /> Pinned
                    </span>
                  )}
                  <div className="flex flex-wrap items-baseline gap-2">
                    <span className="font-medium">
                      {c.author?.display_name ?? c.author?.username ?? "User"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {formatWhen(c.created_at)}
                    </span>
                  </div>
                  <p className="mt-0.5 whitespace-pre-wrap break-words">{c.body}</p>
                </div>

                {(canDelete || isCreator) && (
                  <div className="flex shrink-0 items-center gap-0.5">
                    {isCreator && (
                      <button
                        type="button"
                        onClick={() => handlePin(c)}
                        disabled={actionId === c.id}
                        className="rounded p-1 text-muted-foreground hover:text-primary"
                        aria-label={c.is_pinned ? "Unpin comment" : "Pin comment"}
                      >
                        {c.is_pinned ? (
                          <PinOff className="h-3.5 w-3.5" />
                        ) : (
                          <Pin className="h-3.5 w-3.5" />
                        )}
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={actionId === c.id}
                        className="rounded p-1 text-muted-foreground hover:text-destructive"
                        aria-label="Delete comment"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {comments.length === 0 ? (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        ) : null}
      </ul>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-2">
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a comment…"
          rows={2}
          className="resize-none"
        />
        <Button type="submit" size="sm" disabled={loading || !body.trim()}>
          Comment
        </Button>
      </form>
    </div>
  );
}
