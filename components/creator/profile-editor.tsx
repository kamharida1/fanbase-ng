"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { uploadFileWithPresign } from "@/lib/media/client-upload";
import {
  updateCreatorProfile,
  updateProfileBasics,
  updateProfileImageUrl,
} from "@/lib/creators/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { CreatorProfileRow, SocialLinks } from "@/types/creator";

type ProfileEditorProps = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  creator: CreatorProfileRow | null;
};

export function ProfileEditor({
  userId,
  username: initialUsername,
  displayName: initialDisplayName,
  avatarUrl: initialAvatarUrl,
  creator,
}: ProfileEditorProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(creator?.bio ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl ?? "");
  const [bannerUrl, setBannerUrl] = useState(creator?.banner_url ?? "");
  const [accepting, setAccepting] = useState(
    creator?.is_accepting_subscribers ?? true,
  );
  const [social, setSocial] = useState<SocialLinks>({
    website: creator?.social_links?.website ?? "",
    twitter: creator?.social_links?.twitter ?? "",
    instagram: creator?.social_links?.instagram ?? "",
    tiktok: creator?.social_links?.tiktok ?? "",
    youtube: creator?.social_links?.youtube ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function saveBasics() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await updateProfileBasics({ display_name: displayName, username });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess("Profile updated.");
    router.refresh();
  }

  async function saveCreator() {
    setLoading(true);
    setError(null);
    setSuccess(null);
    const result = await updateCreatorProfile({
      bio,
      is_accepting_subscribers: accepting,
      social_links: social,
    });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess("Creator profile updated.");
    router.refresh();
  }

  async function saveImageUrl(type: "avatar" | "banner") {
    setLoading(true);
    setError(null);
    const result = await updateProfileImageUrl(
      type,
      type === "avatar" ? avatarUrl : bannerUrl,
    );
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSuccess(`${type === "avatar" ? "Profile photo" : "Banner"} updated.`);
    router.refresh();
  }

  async function handleUpload(type: "avatar" | "banner", file: File) {
    setLoading(true);
    setError(null);
    try {
      const uploaded = await uploadFileWithPresign({
        context: "profile",
        contextRefId: userId,
        file: new File(
          [file],
          `${type}-${file.name}`,
          { type: file.type },
        ),
      });
      if (uploaded.status !== "ready") {
        setError("Image is still processing. Refresh in a moment.");
        return;
      }
      const url = `/api/v1/media/delivery?uploadId=${uploaded.uploadId}&redirect=1`;
      if (type === "avatar") setAvatarUrl(url);
      else setBannerUrl(url);
      setSuccess("Image uploaded.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-w-0 max-w-2xl space-y-10">
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="text-sm text-muted-foreground">{success}</p>
      ) : null}

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Basics</h2>
        <div className="space-y-2">
          <Label htmlFor="displayName">Display name</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
          />
          <p className="text-xs text-muted-foreground">
            Public URL: /creators/{username}
          </p>
        </div>
        <Button type="button" onClick={saveBasics} disabled={loading}>
          Save basics
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Profile photo</h2>
        <div className="space-y-2">
          <Label htmlFor="avatarUrl">Image URL</Label>
          <Input
            id="avatarUrl"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="text-sm"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleUpload("avatar", file);
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={() => saveImageUrl("avatar")}
          disabled={loading}
        >
          Save photo URL
        </Button>
      </section>

      {creator ? (
        <>
          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Banner</h2>
            <div className="space-y-2">
              <Label htmlFor="bannerUrl">Banner URL</Label>
              <Input
                id="bannerUrl"
                value={bannerUrl}
                onChange={(e) => setBannerUrl(e.target.value)}
                placeholder="https://..."
              />
            </div>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleUpload("banner", file);
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => saveImageUrl("banner")}
              disabled={loading}
            >
              Save banner URL
            </Button>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Bio & availability</h2>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                maxLength={2000}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={accepting}
                onChange={(e) => setAccepting(e.target.checked)}
              />
              Accepting new subscribers
            </label>
            <Button type="button" onClick={saveCreator} disabled={loading}>
              Save bio & links
            </Button>
          </section>

          <section className="space-y-4">
            <h2 className="text-lg font-semibold">Social links</h2>
            {(
              [
                ["website", "Website"],
                ["twitter", "X / Twitter"],
                ["instagram", "Instagram"],
                ["tiktok", "TikTok"],
                ["youtube", "YouTube"],
              ] as const
            ).map(([key, labelText]) => (
              <div key={key} className="space-y-2">
                <Label htmlFor={key}>{labelText}</Label>
                <Input
                  id={key}
                  value={social[key] ?? ""}
                  onChange={(e) =>
                    setSocial((s) => ({ ...s, [key]: e.target.value }))
                  }
                  placeholder="https://"
                />
              </div>
            ))}
          </section>
        </>
      ) : null}

      <p className="text-sm text-muted-foreground">
        <Link href={`/creators/${initialUsername}`} className="underline">
          View public profile
        </Link>
        {" · "}
        <Link href="/creator/tiers" className="underline">
          Manage subscription plans
        </Link>
      </p>
    </div>
  );
}
