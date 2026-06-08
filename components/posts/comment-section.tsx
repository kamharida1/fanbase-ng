"use client";

import { useState } from "react";
import { Eye, EyeOff, Pin, PinOff, Trash2 } from "lucide-react";

import { addPostComment } from "@/lib/posts/actions";
import {
  deleteComment,
  hideComment,
  pinComment,
  unhideComment,
  unpinComment,
} from "@/lib/posts/moderation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ReportButton } from "@/components/shared/report-button";
import type { PostCommentRow } from "@/types/posts";

function formatWhen(iso: string): string {
  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

type Thread = { comment: PostCommentRow; replies: PostCommentRow[] };

function buildThreads(comments: PostCommentRow[]): Thread[] {
  const topLevel: PostCommentRow[] = [];
  const byParent = new Map<string, PostCommentRow[]>();

  for (const c of comments) {
    if (!c.parent_id) {
      topLevel.push(c);
    } else {
      const bucket = byParent.get(c.parent_id) ?? [];
      bucket.push(c);
      byParent.set(c.parent_id, bucket);
    }
  }

  return topLevel.map((c) => ({ comment: c, replies: byParent.get(c.id) ?? [] }));
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
  const [comments, setComments] = useState(initialComments);
  const [body, setBody] = useState("");
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [replyLoading, setReplyLoading] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isCreator = viewerId != null && viewerId === postCreatorId;
  const threads = buildThreads(comments);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!body.trim()) return;
    setError(null);
    setLoading(true);
    const result = await addPostComment({ postId, body });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    setBody("");
    // Optimistically add placeholder; server refresh fills in author
    setComments((prev) => [
      ...prev,
      {
        id: result.data?.commentId ?? crypto.randomUUID(),
        post_id: postId,
        author_id: viewerId ?? "",
        body,
        parent_id: null,
        created_at: new Date().toISOString(),
        is_pinned: false,
        is_hidden_by_creator: false,
      },
    ]);
  }

  async function handleReply(parentId: string) {
    if (!replyBody.trim()) return;
    setError(null);
    setReplyLoading(true);
    const result = await addPostComment({ postId, body: replyBody, parentId });
    setReplyLoading(false);
    if (!result.success) { setError(result.error); return; }
    setReplyBody("");
    setReplyingTo(null);
    setComments((prev) => [
      ...prev,
      {
        id: result.data?.commentId ?? crypto.randomUUID(),
        post_id: postId,
        author_id: viewerId ?? "",
        body: replyBody,
        parent_id: parentId,
        created_at: new Date().toISOString(),
        is_pinned: false,
        is_hidden_by_creator: false,
      },
    ]);
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

  async function handleHide(comment: PostCommentRow) {
    setActionId(comment.id);
    const result = comment.is_hidden_by_creator
      ? await unhideComment(comment.id)
      : await hideComment(comment.id);
    setActionId(null);
    if (!result.success) { setError(result.error); return; }
    setComments((prev) =>
      prev.map((c) =>
        c.id === comment.id
          ? { ...c, is_hidden_by_creator: !comment.is_hidden_by_creator }
          : c,
      ),
    );
  }

  function CommentItem({
    c,
    isReply = false,
  }: {
    c: PostCommentRow;
    isReply?: boolean;
  }) {
    const canDelete = viewerId === c.author_id || isCreator;
    const isHidden = Boolean(c.is_hidden_by_creator);

    return (
      <div className={`text-sm ${isHidden ? "opacity-50" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              {c.is_pinned && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                  <Pin className="h-3 w-3" /> Pinned
                </span>
              )}
              {isHidden && isCreator && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <EyeOff className="h-3 w-3" /> Hidden
                </span>
              )}
            </div>
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
              {isCreator && !isReply && (
                <button
                  type="button"
                  onClick={() => handlePin(c)}
                  disabled={actionId === c.id || isHidden}
                  className="rounded p-1 text-muted-foreground hover:text-primary disabled:pointer-events-none disabled:opacity-40"
                  aria-label={c.is_pinned ? "Unpin" : "Pin"}
                >
                  {c.is_pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                </button>
              )}
              {isCreator && (
                <button
                  type="button"
                  onClick={() => handleHide(c)}
                  disabled={actionId === c.id}
                  className="rounded p-1 text-muted-foreground hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                  aria-label={isHidden ? "Unhide" : "Hide"}
                >
                  {isHidden ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => handleDelete(c.id)}
                  disabled={actionId === c.id}
                  className="rounded p-1 text-muted-foreground hover:text-destructive disabled:pointer-events-none disabled:opacity-40"
                  aria-label="Delete"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center gap-3">
          {viewerId && !isReply && !isHidden && (
            <button
              type="button"
              onClick={() =>
                setReplyingTo((prev) => (prev === c.id ? null : c.id))
              }
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              {replyingTo === c.id ? "Cancel" : "Reply"}
            </button>
          )}
          {viewerId && viewerId !== c.author_id && (
            <ReportButton
              postId={postId}
              reportedUserId={c.author_id}
              targetLabel="Report this comment"
              label="Report"
            />
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ul className="space-y-4">
        {threads.map(({ comment: c, replies }) => (
          <li key={c.id}>
            <CommentItem c={c} />

            {/* Inline reply form */}
            {replyingTo === c.id && (
              <div className="ml-5 mt-2 border-l-2 border-muted pl-3">
                <div className="space-y-2">
                  <Textarea
                    autoFocus
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder={`Reply to ${c.author?.display_name ?? c.author?.username ?? "User"}…`}
                    rows={2}
                    className="resize-none text-sm"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={replyLoading || !replyBody.trim()}
                    onClick={() => handleReply(c.id)}
                  >
                    {replyLoading ? "Posting…" : "Post reply"}
                  </Button>
                </div>
              </div>
            )}

            {/* Replies */}
            {replies.length > 0 && (
              <ul className="ml-5 mt-2 space-y-3 border-l-2 border-muted pl-3">
                {replies.map((r) => (
                  <li key={r.id}>
                    <CommentItem c={r} isReply />
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
        {threads.length === 0 && (
          <li className="text-sm text-muted-foreground">No comments yet.</li>
        )}
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
          {loading ? "Posting…" : "Comment"}
        </Button>
      </form>
    </div>
  );
}
