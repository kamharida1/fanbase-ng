"use client";

import { useState } from "react";

import { resendVerificationEmail } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mapAuthError } from "@/lib/auth/errors";

export function ResendVerificationForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await resendVerificationEmail(email.trim().toLowerCase());
    setLoading(false);

    if (result.error) {
      setError(mapAuthError(result.error));
      return;
    }

    setSent(true);
  }

  if (sent) {
    return (
      <p className="text-sm text-muted-foreground">
        If an account exists, a new verification email was sent.
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-3 text-left">
      <div className="space-y-2">
        <Label htmlFor="resendEmail">Email</Label>
        <Input
          id="resendEmail"
          type="email"
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
      <Button type="submit" variant="outline" size="sm" disabled={loading}>
        {loading ? "Sending…" : "Resend verification email"}
      </Button>
    </form>
  );
}
