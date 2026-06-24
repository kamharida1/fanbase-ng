"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  recordSession,
  resolvePostLoginPath,
  signUpWithEmail,
} from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN } from "@/lib/auth/constants";

// Latest DOB that still makes someone 18 today
function maxDob(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().split("T")[0]!;
}

export function SignupForm() {
  const router = useRouter();

  const refCode =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("ref") ?? ""
      : "";

  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (honeypot) {
      // Silently drop likely-bot submissions without tipping them off.
      return;
    }

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

    if (!dateOfBirth) {
      setError("Please enter your date of birth.");
      return;
    }

    if (!consentChecked) {
      setError(
        "You must agree to the Terms of Service and Privacy Policy to create an account.",
      );
      return;
    }

    setLoading(true);

    try {
      const result = await signUpWithEmail({
        email,
        password,
        displayName: displayName || undefined,
        username: normalizedUsername || undefined,
        dateOfBirth,
        refCode: refCode || undefined,
        honeypot: honeypot || undefined,
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (!result.requiresEmailVerification) {
        await recordSession(
          typeof navigator !== "undefined" ? navigator.userAgent : undefined,
        );
        const dest = await resolvePostLoginPath("/feed");
        router.push(dest);
        router.refresh();
        return;
      }

      router.push(
        `/verify?message=verify_email&email=${encodeURIComponent(email.trim().toLowerCase())}`,
      );
      router.refresh();
    } catch {
      setError("Something went wrong while creating your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {refCode ? (
        <p className="rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-sm text-primary">
          You were invited with code <span className="font-semibold">{refCode}</span> — sign up to claim your referral bonus.
        </p>
      ) : null}
      {/* Honeypot: hidden from real users, bots that fill every field trip this */}
      <div
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px", width: 1, height: 1, overflow: "hidden" }}
      >
        <Label htmlFor="company">Leave this field blank</Label>
        <Input
          id="company"
          name="company"
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
      </div>
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
        <PasswordInput
          id="password"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="confirmPassword">Confirm password</Label>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          required
          minLength={PASSWORD_MIN_LENGTH}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
      </div>

      {/* Age verification — validated server-side; max= enforces 18+ in browser too */}
      <div className="space-y-2">
        <Label htmlFor="dateOfBirth">Date of birth</Label>
        <Input
          id="dateOfBirth"
          type="date"
          required
          max={maxDob()}
          value={dateOfBirth}
          onChange={(e) => setDateOfBirth(e.target.value)}
        />
        <p className="text-xs text-muted-foreground">
          You must be at least 18 years old to use this platform.
        </p>
      </div>

      {/* NDPR consent */}
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
      <Button
        type="submit"
        className="w-full"
        disabled={loading || !consentChecked}
      >
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
