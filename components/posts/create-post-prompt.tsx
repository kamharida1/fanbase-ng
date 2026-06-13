import Link from "next/link";
import { ImageIcon, Video, Smile } from "lucide-react";

/** Facebook-style "what's on your mind" prompt that links to the post composer. */
export function CreatePostPrompt() {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <Link
        href="/creator/content/new"
        className="block rounded-full border bg-muted/50 px-4 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
      >
        What&apos;s on your mind?
      </Link>
      <div className="mt-3 flex items-center justify-around border-t pt-3">
        <Link
          href="/creator/content/new"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <ImageIcon className="h-5 w-5 text-emerald-500" />
          Photo
        </Link>
        <Link
          href="/creator/content/new"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Video className="h-5 w-5 text-blue-500" />
          Video
        </Link>
        <Link
          href="/creator/content/new"
          className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          <Smile className="h-5 w-5 text-amber-500" />
          Post
        </Link>
      </div>
    </div>
  );
}
