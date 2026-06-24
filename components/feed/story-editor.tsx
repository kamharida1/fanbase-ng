"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

import { createStory, deleteStory } from "@/lib/stories/actions";
import {
  humanizeUploadError,
  pollUploadUntilReady,
  uploadFileWithPresign,
} from "@/lib/media/client-upload";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

export function StoryEditor({ onPublished }: { onPublished: () => void }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [visibility, setVisibility] = useState<"public" | "subscribers">("subscribers");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFileSelected(selected: File) {
    setFile(selected);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(selected);
  }

  async function handlePublish() {
    if (!file) {
      setError("Add a photo or video first.");
      return;
    }

    setLoading(true);
    setError(null);

    const created = await createStory({ caption: caption.trim() || undefined, visibility });
    if (!created.success || !created.data) {
      setError(!created.success ? created.error : "Could not create story.");
      setLoading(false);
      return;
    }

    const storyId = created.data.storyId;

    try {
      let result = await uploadFileWithPresign({
        context: "post",
        contextRefId: storyId,
        file,
      });
      if (result.status === "scanning") {
        result = await pollUploadUntilReady(result.uploadId);
      }
      router.refresh();
      onPublished();
    } catch (err) {
      setError(humanizeUploadError(err));
      // Media failed — don't leave an empty story behind.
      await deleteStory(storyId);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.[0]) handleFileSelected(e.target.files[0]);
          e.target.value = "";
        }}
      />

      {preview ? (
        <div className="relative overflow-hidden rounded-lg border bg-black">
          {file?.type.startsWith("video/") ? (
            <video src={preview} className="max-h-80 w-full object-contain" controls />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="" className="max-h-80 w-full object-contain" />
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="flex h-48 w-full items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground hover:border-primary hover:text-primary"
        >
          Tap to add a photo or video
        </button>
      )}

      {preview ? (
        <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Choose a different file
        </Button>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="storyCaption">Caption (optional)</Label>
        <Textarea
          id="storyCaption"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          rows={2}
          maxLength={200}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="storyVisibility">Who can see this</Label>
        <select
          id="storyVisibility"
          className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          value={visibility}
          onChange={(e) => setVisibility(e.target.value as "public" | "subscribers")}
        >
          <option value="subscribers">Subscribers only</option>
          <option value="public">Public</option>
        </select>
        <p className="text-xs text-muted-foreground">Disappears after 24 hours.</p>
      </div>

      {error ? (
        <p className="text-sm text-destructive" role="alert">{error}</p>
      ) : null}

      <Button type="button" className="w-full" disabled={loading || !file} onClick={() => void handlePublish()}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        {loading ? "Posting…" : "Share to story"}
      </Button>
    </div>
  );
}
