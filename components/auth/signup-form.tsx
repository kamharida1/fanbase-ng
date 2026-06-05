"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { recordSession, resolvePostLoginPath } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from "@/lib/auth/constants";
import { mapAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

export function SignupForm() {
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalizedUsername = username.trim().toLowerCase();
    if (normalizedUsername && !USERNAME_PATTERN.test(normalizedUsername)) {
      setError(
        "Username must be 3–30 characters: lowercase letters, numbers, underscore.",
      );
      return;
    }

    if (password.length < PASSWORD_MIN_LENGTH) {
      setError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    if (!consentChecked) {
      setError("You must agree to the Terms of Service and Privacy Policy to create an account.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const appUrl =
      process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;

    const { data, error: signUpError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          display_name: displayName.trim() || undefined,
          username: normalizedUsername || undefined,
        },
        emailRedirectTo: `${appUrl}/callback?next=/feed`,
      },
    });

    if (signUpError) {
      setLoading(false);
      setError(mapAuthError(signUpError.message));
      return;
    }

    if (data.session) {
      await recordSession(
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      );
      const dest = await resolvePostLoginPath("/feed");
      setLoading(false);
      router.push(dest);
      router.refresh();
      return;
    }

    setLoading(false);
    router.push("/verify?message=verify_email");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="displayName">Display name</Label>
        <Input
          id="displayName"
          type="text"
          autoComplete="name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="username">Username (optional)</Label>
        <Input
          id="username"
          type="text"
          autoComplete="username"
          pattern="[a-z0-9_]{3,30}"
          title="3–30 characters: lowercase letters, numbers, underscore"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
        />
      </div>
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
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <Input
          id="confirmPassword"
          type="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>
      {/* NDPR consent — required before account creation */}
      <label className="flex items-start gap-3 rounded-lg border p-3 text-sm">
        <input
          type="checkbox"
          required
          checked={consentChecked}
          onChange={(e) => setConsentChecked(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border"
          aria-describedby="consent-text"
        />
        <span id="consent-text" className="leading-relaxed text-muted-foreground">
          I am at least 18 years old and I agree to the{" "}
          <Link
            href="/legal/terms"
            target="_blank"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link
            href="/legal/privacy"
            target="_blank"
            className="font-medium text-foreground underline underline-offset-2"
          >
            Privacy Policy
          </Link>
          . I consent to Fanbase NG collecting and processing my personal data
          in accordance with the Nigeria Data Protection Regulation (NDPR) 2019.
        </span>
      </label>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={loading || !consentChecked}>
        {loading ? "Creating account…" : "Create account"}
      </Button>
      <p className="text-center text-sm">
        Already have an account?{" "}
        <Link href="/login" className="font-medium underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
