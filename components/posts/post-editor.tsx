"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { X, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

import { uploadFileWithPresign } from "@/lib/media/client-upload";
import { archivePost, savePost } from "@/lib/posts/actions";
import { CategoryPicker } from "@/components/vault/category-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CategoryRow } from "@/lib/vault/queries";
import type { PostRow } from "@/types/posts";

type PlanOption = { id: string; name: string };

type GalleryItem = {
  localId: string;
  dataUrl: string;
  file: File;
  status: "pending" | "uploading" | "done" | "error";
};

export function PostEditor({
  post,
  plans,
  categories = [],
  assignedCategoryIds = [],
}: {
  post?: PostRow;
  plans: PlanOption[];
  categories?: CategoryRow[];
  assignedCategoryIds?: string[];
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [postId, setPostId] = useState(post?.id ?? "");
  const [type, setType] = useState(post?.type ?? "text");

  // Video thumbnail (canvas-extracted for new uploads, or stored thumbnail_url)
  const existingVideoMedia = post?.media?.find((m) => m.media_type === "video");
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(
    existingVideoMedia?.thumbnail_url ?? null,
  );

  // Gallery images: new local files + existing attached images
  const initialGallery: GalleryItem[] = (
    post?.media?.filter((m) => m.media_type === "image" && m.url) ?? []
  ).map((m) => ({
    localId: m.id,
    dataUrl: m.url!,
    file: new File([], ""),   // placeholder — already uploaded
    status: "done" as const,
  }));
  const [gallery, setGallery] = useState<GalleryItem[]>(initialGallery);

  const [caption, setCaption] = useState(post?.caption ?? "");
  const [visibility, setVisibility] = useState(post?.visibility ?? "subscribers");
  const [planId, setPlanId] = useState(post?.plan_id ?? "");
  const [ppvPrice, setPpvPrice] = useState(
    post?.ppv_price_kobo ? String(post.ppv_price_kobo / 100) : "",
  );
  const [scheduledAt, setScheduledAt] = useState(
    post?.scheduled_publish_at ? post.scheduled_publish_at.slice(0, 16) : "",
  );
  const [contentWarning, setContentWarning] = useState(post?.content_warning ?? "");

  // Polls can only be attached when a post is first created — editing an
  // existing poll would invalidate any votes already cast, so the fields
  // are locked once a poll exists.
  const existingPoll = post?.poll ?? null;
  const [pollEnabled, setPollEnabled] = useState(Boolean(existingPoll));
  const [pollQuestion, setPollQuestion] = useState(existingPoll?.question ?? "");
  const [pollOptions, setPollOptions] = useState<string[]>(
    existingPoll ? existingPoll.options.map((o) => o.label) : ["", ""],
  );

  function buildPollInput() {
    if (existingPoll || !pollEnabled) return undefined;
    const question = pollQuestion.trim();
    const options = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question || options.length < 2) return undefined;
    return { question, options: options.slice(0, 5) };
  }

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensurePostId(): Promise<string | null> {
    if (postId) return postId;
    const result = await savePost({
      type,
      caption,
      contentWarning: contentWarning.trim() || null,
      visibility,
      planId: visibility === "tier" ? planId : null,
      ppvPriceNgn: visibility === "ppv" ? parseFloat(ppvPrice) || 0 : null,
      scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
      publishNow: false,
      poll: buildPollInput(),
    });
    if (!result.success) { setError(result.error); return null; }
    if (!result.data) return null;
    setPostId(result.data.postId);
    return result.data.postId;
  }

  function generateVideoThumbnail(file: File): Promise<string | null> {
    return new Promise((resolve) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.muted = true;
      video.playsInline = true;
      const objectUrl = URL.createObjectURL(file);
      video.src = objectUrl;
      video.addEventListener("loadedmetadata", () => {
        video.currentTime = Math.min(1, video.duration * 0.1);
      });
      video.addEventListener("seeked", () => {
        try {
          const canvas = document.createElement("canvas");
          canvas.width = 640;
          canvas.height = Math.round((video.videoHeight / video.videoWidth) * 640) || 360;
          const ctx = canvas.getContext("2d");
          if (!ctx) { resolve(null); return; }
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", 0.8));
        } catch { resolve(null); }
        finally { URL.revokeObjectURL(objectUrl); }
      });
      video.addEventListener("error", () => { URL.revokeObjectURL(objectUrl); resolve(null); });
    });
  }

  async function handleFilesSelected(files: FileList) {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    // Single video — existing flow
    if (fileArray.length === 1 && fileArray[0].type.startsWith("video/")) {
      const file = fileArray[0];
      const id = await ensurePostId();
      if (!id) return;
      setLoading(true);
      setError(null);
      generateVideoThumbnail(file).then((url) => { if (url) setThumbnailPreview(url); });
      try {
        const result = await uploadFileWithPresign({ context: "post", contextRefId: id, file });
        if (result.status === "scanning") setError("Upload received — security scan in progress. Refresh in a moment.");
        setType("video");
        setGallery([]);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed.");
      } finally {
        setLoading(false);
      }
      return;
    }

    // One or more images — gallery flow
    const imageFiles = fileArray.filter((f) => f.type.startsWith("image/"));
    if (!imageFiles.length) return;

    setType("image");
    setThumbnailPreview(null);

    // Build local preview entries immediately
    const newItems: GalleryItem[] = await Promise.all(
      imageFiles.map(async (file) => {
        const dataUrl = await new Promise<string>((resolve) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target?.result as string);
          reader.readAsDataURL(file);
        });
        return {
          localId: `local-${crypto.randomUUID()}`,
          dataUrl,
          file,
          status: "pending" as const,
        };
      }),
    );

    setGallery((prev) => [...prev.filter((g) => g.status === "done"), ...newItems]);

    // Upload pending items sequentially
    const id = await ensurePostId();
    if (!id) return;

    for (const item of newItems) {
      setGallery((prev) =>
        prev.map((g) => g.localId === item.localId ? { ...g, status: "uploading" } : g),
      );
      try {
        await uploadFileWithPresign({ context: "post", contextRefId: id, file: item.file });
        setGallery((prev) =>
          prev.map((g) => g.localId === item.localId ? { ...g, status: "done" } : g),
        );
      } catch {
        setGallery((prev) =>
          prev.map((g) => g.localId === item.localId ? { ...g, status: "error" } : g),
        );
      }
    }

    router.refresh();
  }

  function removeGalleryItem(localId: string) {
    setGallery((prev) => prev.filter((g) => g.localId !== localId));
  }

  async function handleSave(publishNow: boolean) {
    setError(null);
    setLoading(true);
    const result = await savePost({
      postId: postId || undefined,
      type,
      caption,
      contentWarning: contentWarning.trim() || null,
      visibility,
      planId: visibility === "tier" ? planId : null,
      ppvPriceNgn: visibility === "ppv" ? parseFloat(ppvPrice) || 0 : null,
      scheduledAt: !publishNow && scheduledAt ? new Date(scheduledAt).toISOString() : null,
      publishNow,
      poll: buildPollInput(),
    });
    setLoading(false);
    if (!result.success) { setError(result.error); return; }
    if (result.data?.postId) setPostId(result.data.postId);
    toast.success(publishNow ? "Post published!" : "Post saved.");
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

  const hasUploading = gallery.some((g) => g.status === "uploading");
  const doneImages = gallery.filter((g) => g.status === "done");

  return (
    <div className="mx-auto min-w-0 max-w-2xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">{post ? "Edit post" : "New post"}</h2>
        <Link href="/creator/content" className="text-sm underline">Back</Link>
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
              onChange={(e) => setVisibility(e.target.value as PostRow["visibility"])}
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
                <option key={p.id} value={p.id}>{p.name}</option>
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
          <Label htmlFor="contentWarning">Content warning (optional)</Label>
          <Input
            id="contentWarning"
            type="text"
            maxLength={100}
            placeholder="e.g. Adult content, Violence, Nudity…"
            value={contentWarning}
            onChange={(e) => setContentWarning(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Viewers will see this label and must tap to reveal the post.
          </p>
        </div>

        {/* ── Poll section ──────────────────────────────────────────── */}
        <div className="space-y-3 rounded-lg border p-4">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={pollEnabled}
              disabled={Boolean(existingPoll)}
              onChange={(e) => setPollEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            Add a poll
          </label>

          {existingPoll ? (
            <p className="text-xs text-muted-foreground">
              This post already has a poll. Polls can&apos;t be edited once created
              (votes may already exist).
            </p>
          ) : null}

          {pollEnabled ? (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="pollQuestion">Question</Label>
                <Input
                  id="pollQuestion"
                  value={pollQuestion}
                  disabled={Boolean(existingPoll)}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="Ask your audience something…"
                  maxLength={200}
                />
              </div>

              <div className="space-y-2">
                <Label>Options (2–5)</Label>
                {pollOptions.map((option, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Input
                      value={option}
                      disabled={Boolean(existingPoll)}
                      onChange={(e) => {
                        const next = [...pollOptions];
                        next[index] = e.target.value;
                        setPollOptions(next);
                      }}
                      placeholder={`Option ${index + 1}`}
                      maxLength={80}
                    />
                    {!existingPoll && pollOptions.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== index))}
                        className="shrink-0 rounded p-1.5 text-muted-foreground hover:text-foreground"
                        aria-label="Remove option"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
                {!existingPoll && pollOptions.length < 5 ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setPollOptions([...pollOptions, ""])}
                  >
                    Add option
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Media section ─────────────────────────────────────────── */}
        <div className="space-y-3">
          <Label>Media</Label>

          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept="image/*,video/mp4,video/webm"
            multiple
            onChange={(e) => {
              if (e.target.files?.length) void handleFilesSelected(e.target.files);
              e.target.value = "";
            }}
          />

          {/* Video thumbnail */}
          {thumbnailPreview && (
            <div className="relative overflow-hidden rounded-lg border bg-black">
              <Image
                src={thumbnailPreview}
                alt="Video thumbnail preview"
                width={640}
                height={360}
                className="w-full object-contain"
                unoptimized={thumbnailPreview.startsWith("data:")}
              />
              <span className="absolute bottom-2 left-2 rounded bg-black/70 px-2 py-0.5 text-xs text-white">
                Video preview
              </span>
            </div>
          )}

          {/* Image gallery grid */}
          {gallery.length > 0 && (
            <div className={`grid gap-2 ${gallery.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
              {gallery.map((item) => (
                <div key={item.localId} className="group relative aspect-square overflow-hidden rounded-lg border bg-muted">
                  <Image
                    src={item.dataUrl}
                    alt=""
                    fill
                    className="object-cover"
                    unoptimized={item.dataUrl.startsWith("data:")}
                  />
                  {/* Status overlay */}
                  {item.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                      <Loader2 className="h-6 w-6 animate-spin text-white" />
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/40">
                      <AlertCircle className="h-6 w-6 text-white" />
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="absolute bottom-1 right-1 rounded-full bg-black/50 p-0.5">
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    </div>
                  )}
                  {/* Remove button */}
                  {item.status !== "uploading" && (
                    <button
                      type="button"
                      onClick={() => removeGalleryItem(item.localId)}
                      className="absolute right-1 top-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                      aria-label="Remove image"
                    >
                      <X className="h-3.5 w-3.5 text-white" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={loading || hasUploading}
              onClick={() => fileRef.current?.click()}
            >
              {hasUploading
                ? "Uploading…"
                : doneImages.length > 0
                  ? `Add more images (${doneImages.length} attached)`
                  : "Upload image or video"}
            </Button>
            {gallery.some((g) => g.status === "error") && (
              <p className="text-xs text-destructive self-center">
                Some images failed — remove and re-add them.
              </p>
            )}
          </div>

          <p className="text-xs text-muted-foreground">
            Select multiple images for a gallery post. Videos are single-file only.
          </p>
        </div>

        {categories.length > 0 && (
          <div className="space-y-2">
            <Label>Collections</Label>
            <CategoryPicker
              postId={postId || null}
              categories={categories}
              initialCategoryIds={assignedCategoryIds}
            />
          </div>
        )}

        {error ? (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            disabled={loading || hasUploading}
            onClick={() => void handleSave(false)}
          >
            Save draft
          </Button>
          <Button
            type="button"
            disabled={loading || hasUploading}
            onClick={() => void handleSave(true)}
          >
            Publish now
          </Button>
          {scheduledAt ? (
            <Button
              type="button"
              variant="secondary"
              disabled={loading || hasUploading}
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
