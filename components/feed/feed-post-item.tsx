"use client";

import { useCallback, useState } from "react";

import { CommentSection } from "@/components/posts/comment-section";
import { PostCard } from "@/components/posts/post-card";
import { Button } from "@/components/ui/button";
import type { PostCommentRow } from "@/types/posts";
import type { PostRow } from "@/types/posts";

export function FeedPostItem({
  post,
  viewerId,
  watermarkLabel,
}: {
  post: PostRow;
  viewerId?: string | null;
  watermarkLabel?: string | null;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comments, setComments] = useState<PostCommentRow[] | null>(null);
  const [loadingComments, setLoadingComments] = useState(false);
  const [commentsError, setCommentsError] = useState<string | null>(null);

  const loadComments = useCallback(async () => {
    if (comments !== null) return;
    setLoadingComments(true);
    setCommentsError(null);
    try {
      const res = await fetch(`/api/v1/posts/${post.id}/comments`);
      const json = (await res.json()) as {
        data?: { comments: PostCommentRow[] };
        error?: string;
      };
      if (!res.ok) {
        throw new Error(json.error ?? "Could not load comments.");
      }
      setComments(json.data?.comments ?? []);
    } catch (err) {
      setCommentsError(
        err instanceof Error ? err.message : "Could not load comments.",
      );
    } finally {
      setLoadingComments(false);
    }
  }, [comments, post.id]);

  async function toggleComments() {
    const next = !commentsOpen;
    setCommentsOpen(next);
    if (next && post.can_view_full) {
      await loadComments();
    }
  }

  return (
    <div className="space-y-2">
      <PostCard
        post={post}
        watermarkLabel={watermarkLabel}
        showComments={
          commentsOpen && post.can_view_full ? (
            <div className="space-y-2">
              {loadingComments ? (
                <p className="text-sm text-muted-foreground">Loading comments…</p>
              ) : null}
              {commentsError ? (
                <p className="text-sm text-destructive">{commentsError}</p>
              ) : null}
              {comments ? (
                <CommentSection
                  postId={post.id}
                  comments={comments}
                  viewerId={viewerId}
                  postCreatorId={post.creator_id}
                />
              ) : null}
            </div>
          ) : null
        }
      />
      {post.can_view_full ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8 text-muted-foreground"
          onClick={() => void toggleComments()}
        >
          {commentsOpen ? "Hide comments" : `View ${post.comment_count ?? 0} comments`}
        </Button>
      ) : null}
    </div>
  );
}
