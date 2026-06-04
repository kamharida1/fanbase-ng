"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

import { uploadFileWithPresign } from "@/lib/media/client-upload";
import { archivePost, savePost } from "@/lib/posts/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { PostRow } from "@/types/posts";

type PlanOption = { id: string; name: string };

export function PostEditor({
  post,
  plans,
}: {
  post?: PostRow;
  plans: PlanOption[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [postId, setPostId] = useState(post?.id ?? "");
  const [type, setType] = useState(post?.type ?? "text");
  const [caption, setCaption] = useState(post?.caption ?? "");
  const [visibility, setVisibility] = useState(post?.visibility ?? "subscribers");
  const [planId, setPlanId] = useState(post?.plan_id ?? "");
  const [ppvPrice, setPpvPrice] = useState(
    post?.ppv_price_kobo ? String(post.ppv_price_kobo / 100) : "",
  );
  const [scheduledAt, setScheduledAt] = useState(
    post?.scheduled_publish_at
      ? post.scheduled_publish_at.slice(0, 16)
      : "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensurePostId(): Promise<string | null> {
    if (postId) return postId;

    const result = await savePost({
      type,
      caption,
      visibility,
      planId: visibility === "tier" ? planId : null,
      ppvPriceNgn: visibility === "ppv" ? parseFloat(ppvPrice) || 0 : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      publishNow: false,
    });

    if (!result.success) {
      setError(result.error);
      return null;
    }
    if (!result.data) return null;

    setPostId(result.data.postId);
    return result.data.postId;
  }

  async function handleMediaUpload(file: File) {
    const id = await ensurePostId();
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const result = await uploadFileWithPresign({
        context: "post",
        contextRefId: id,
        file,
      });

      if (result.status === "scanning") {
        setError(
          "Upload received — security scan in progress. Refresh in a moment.",
        );
      }

      if (file.type.startsWith("video/")) setType("video");
      else setType("image");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(publishNow: boolean) {
    setError(null);
    setLoading(true);

    const result = await savePost({
      postId: postId || undefined,
      type,
      caption,
      visibility,
      planId: visibility === "tier" ? planId : null,
      ppvPriceNgn: visibility === "ppv" ? parseFloat(ppvPrice) || 0 : null,
      scheduledAt:
        !publishNow && scheduledAt
          ? new Date(scheduledAt).toISOString()
          : null,
      publishNow,
    });

    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    if (result.data?.postId) setPostId(result.data.postId);
    router.push("/creator/content");
    router.refresh();
  }

  async function handleArchive() {
    if (!postId) return;
    setLoading(true);
    await archivePost(postId);
    setLoading(false);
    router.push("/creator/content");
  }

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">
          {post ? "Edit post" : "New post"}
        </h2>
        <Link href="/creator/content" className="text-sm underline">
          Back
        </Link>
      </div>

      <div className="space-y-4 rounded-xl border p-5">
        <div className="space-y-2">
          <Label htmlFor="caption">Caption</Label>
          <Textarea
            id="caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            rows={4}
            placeholder="Write something…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="visibility">Visibility</Label>
            <select
              id="visibility"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={visibility}
              onChange={(e) =>
                setVisibility(e.target.value as PostRow["visibility"])
              }
            >
              <option value="public">Public</option>
              <option value="subscribers">Subscribers only</option>
              <option value="tier">Tier only</option>
              <option value="ppv">Pay-per-view</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="type">Type</Label>
            <select
              id="type"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={type}
              onChange={(e) => setType(e.target.value as PostRow["type"])}
            >
              <option value="text">Text</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
          </div>
        </div>

        {visibility === "tier" ? (
          <div className="space-y-2">
            <Label htmlFor="planId">Tier plan</Label>
            <select
              id="planId"
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              required
            >
              <option value="">Select plan</option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}

        {visibility === "ppv" ? (
          <div className="space-y-2">
            <Label htmlFor="ppvPrice">PPV price (NGN)</Label>
            <Input
              id="ppvPrice"
              type="number"
              min={1}
              value={ppvPrice}
              onChange={(e) => setPpvPrice(e.target.value)}
              required
            />
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="scheduled">Schedule (optional)</Label>
          <Input
            id="scheduled"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Leave empty to save as draft. Use Publish now or set a future time.
          </p>
        </div>

        <div className="space-y-2">
          <Label>Media</Label>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/mp4,video/webm"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleMediaUpload(file);
            }}
          />
          <Button
            type="button"
            variant="outline"
            disabled={loading}
            onClick={() => fileRef.current?.click()}
          >
            Upload image or video
          </Button>
          {post?.media?.length ? (
            <p className="text-xs text-muted-foreground">
              {post.media.length} file(s) attached
            </p>
          ) : null}
        </div>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={loading}
            onClick={() => void handleSave(false)}
          >
            Save draft
          </Button>
          <Button
            type="button"
            disabled={loading}
            onClick={() => void handleSave(true)}
          >
            Publish now
          </Button>
          {scheduledAt ? (
            <Button
              type="button"
              variant="secondary"
              disabled={loading}
              onClick={() => void handleSave(false)}
            >
              Schedule
            </Button>
          ) : null}
          {postId ? (
            <Button
              type="button"
              variant="ghost"
              disabled={loading}
              onClick={() => void handleArchive()}
            >
              Archive
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
