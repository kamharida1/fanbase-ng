"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { requestPasswordReset } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ForgotPasswordForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await requestPasswordReset(email);
    setLoading(false);

    if ("error" in result) {
      setError(result.error);
      return;
    }

    router.push(
      `/reset-password?email=${encodeURIComponent(email.trim().toLowerCase())}`,
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Sending…" : "Send reset code"}
      </Button>
      <p className="text-center text-sm">
        <Link href="/login" className="font-medium underline">
          Back to sign in
        </Link>
      </p>
    </form>
  );
}
