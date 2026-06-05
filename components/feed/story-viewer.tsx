"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

import { markStoryViewed } from "@/lib/stories/actions";
import type { StoryGroup, StoryItem } from "@/lib/stories/queries";

function timeRemaining(expiresAt: string): string {
  const ms = new Date(expiresAt).getTime() - Date.now();
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h > 0) return `${h}h left`;
  if (m > 0) return `${m}m left`;
  return "Expiring soon";
}

const IMAGE_DURATION_MS = 5_000;

type Props = { group: StoryGroup; onClose: () => void };

export function StoryViewer({ group, onClose }: Props) {
  const [index, setIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const story: StoryItem = group.stories[index];

  const goNext = useCallback(() => {
    if (index < group.stories.length - 1) {
      setIndex((i) => i + 1);
      setProgress(0);
    } else {
      onClose();
    }
  }, [index, group.stories.length, onClose]);

  const goPrev = useCallback(() => {
    if (index > 0) {
      setIndex((i) => i - 1);
      setProgress(0);
    }
  }, [index]);

  // Mark story viewed
  useEffect(() => {
    void markStoryViewed(story.id);
  }, [story.id]);

  // Auto-advance images
  useEffect(() => {
    if (story.type === "video") return; // video auto-advances via onEnded

    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 100) {
          clearInterval(timerRef.current!);
          goNext();
          return 0;
        }
        return p + 100 / (IMAGE_DURATION_MS / 100);
      });
    }, 100);

    return () => clearInterval(timerRef.current!);
  }, [index, story.type, goNext]);

  // Keyboard nav
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, goNext, goPrev]);

  const label = group.creator.display_name ?? group.creator.username;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90"
      role="dialog"
      aria-label={`${label}'s story`}
    >
      <div className="relative flex h-full w-full max-w-sm flex-col sm:h-[90vh] sm:rounded-2xl sm:overflow-hidden">
        {/* Progress bars */}
        <div className="flex gap-1 px-3 pt-3 shrink-0">
          {group.stories.map((s, i) => (
            <div key={s.id} className="h-0.5 flex-1 overflow-hidden rounded-full bg-white/30">
              <div
                className="h-full bg-white transition-none"
                style={{
                  width: i < index ? "100%" : i === index ? `${progress}%` : "0%",
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex shrink-0 items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-white/20 text-xs font-semibold text-white">
            {group.creator.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={group.creator.avatar_url} alt="" className="h-full w-full object-cover" />
            ) : (
              label.charAt(0).toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-white">{label}</p>
            <p className="text-xs text-white/60">{timeRemaining(story.expires_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-white hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="relative min-h-0 flex-1 bg-black">
          {story.type === "image" && story.media_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={story.media_url}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : story.type === "video" && story.media_url ? (
            <video
              src={story.media_url}
              autoPlay
              playsInline
              className="h-full w-full object-contain"
              onEnded={goNext}
            />
          ) : (
            <div className="flex h-full items-center justify-center p-8">
              <p className="text-center text-xl font-medium leading-relaxed text-white">
                {story.caption}
              </p>
            </div>
          )}

          {/* Caption overlay for media stories */}
          {story.caption && story.type !== "text" && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 px-4 py-4">
              <p className="text-sm text-white">{story.caption}</p>
            </div>
          )}

          {/* Navigation hit areas */}
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-0 top-0 h-full w-1/3"
            aria-label="Previous story"
          />
          <button
            type="button"
            onClick={goNext}
            className="absolute right-0 top-0 h-full w-1/3"
            aria-label="Next story"
          />
        </div>

        {/* Arrow buttons on wider screens */}
        {index > 0 && (
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 -translate-y-1/2 hidden h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white sm:flex"
            aria-label="Previous"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        {index < group.stories.length - 1 && (
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 -translate-y-1/2 hidden h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white sm:flex"
            aria-label="Next"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        )}
      </div>
    </div>
  );
}
