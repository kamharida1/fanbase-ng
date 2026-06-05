"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus } from "lucide-react";

import { uploadFileWithPresign } from "@/lib/media/client-upload";
import { createStory } from "@/lib/stories/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function NewStoryPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [storyId, setStoryId] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "subscribers">("subscribers");
  const [duration, setDuration] = useState("24");
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function ensureStory(): Promise<string | null> {
    if (storyId) return storyId;
    const result = await createStory({
      caption,
      visibility,
      durationHours: parseInt(duration, 10),
    });
    if (!result.success) {
      setError(result.error);
      return null;
    }
    const id = result.data!.storyId;
    setStoryId(id);
    return id;
  }

  async function handleFile(file: File) {
    setError(null);
    setLoading(true);

    const id = await ensureStory();
    if (!id) { setLoading(false); return; }

    setPreview(URL.createObjectURL(file));

    try {
      await uploadFileWithPresign({
        context: "post",
        contextRefId: id,
        file,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  async function handlePublish() {
    setError(null);
    setLoading(true);
    const id = storyId ?? (await ensureStory());
    setLoading(false);
    if (!id) return;
    router.push("/creator/content");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold">New story</h1>
        <p className="mt-2 text-muted-foreground">
          Stories disappear automatically — great for time-sensitive updates.
        </p>
      </div>

      {/* Media upload */}
      <div
        className="flex h-72 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-xl border-2 border-dashed transition-colors hover:border-primary"
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === "Enter" && fileRef.current?.click()}
      >
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-muted-foreground">
            <ImagePlus className="h-10 w-10" />
            <p className="text-sm">Tap to add photo or video</p>
          </div>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void handleFile(file);
        }}
      />

      <div className="space-y-2">
        <Label htmlFor="caption">Caption (optional)</Label>
        <Textarea
          id="caption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Add a caption…"
          maxLength={300}
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="visibility">Audience</Label>
          <select
            id="visibility"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={visibility}
            onChange={(e) => setVisibility(e.target.value as "public" | "subscribers")}
          >
            <option value="subscribers">Subscribers only</option>
            <option value="public">Everyone</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="duration">Duration</Label>
          <select
            id="duration"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="12">12 hours</option>
            <option value="24">24 hours</option>
            <option value="48">48 hours</option>
            <option value="72">72 hours</option>
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={handlePublish} disabled={loading}>
          {loading ? "Saving…" : "Post story"}
        </Button>
        <Button variant="outline" onClick={() => router.push("/creator/content")}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
