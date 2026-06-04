"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { applyAsCreator } from "@/lib/creators/actions";
import { Button } from "@/components/ui/button";

export function BecomeCreatorCard() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleApply() {
    setLoading(true);
    setError(null);
    const result = await applyAsCreator();
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    router.push("/creator/profile");
    router.refresh();
  }

  return (
    <div className="rounded-xl border p-6">
      <h2 className="text-lg font-semibold">Become a creator</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Set up your public profile, bio, photos, and subscription plans.
      </p>
      {error ? (
        <p className="mt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="button"
        className="mt-4"
        onClick={handleApply}
        disabled={loading}
      >
        {loading ? "Setting up…" : "Start creator setup"}
      </Button>
    </div>
  );
}

export function CreatorStudioLinks({ username }: { username: string }) {
  return (
    <div className="rounded-xl border p-6">
      <h2 className="text-lg font-semibold">Creator studio</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Manage your public profile and subscription plans.
      </p>
      <div className="mt-4 flex flex-wrap gap-3">
        <Button asChild variant="default" size="sm">
          <Link href="/creator/profile">Edit profile</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/creator/tiers">Plans</Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/creators/${username}`}>Public page</Link>
        </Button>
      </div>
    </div>
  );
}
