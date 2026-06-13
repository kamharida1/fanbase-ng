"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  auth_callback: "Sign-in link expired or invalid. Please try again.",
  auth_callback_pkce:
    "This link must be opened in the same browser where you requested it. Request a new link and try again.",
  password_updated: "Your password has been updated. You can sign in now.",
  check_email_reset: "If that email exists, we sent a password reset link.",
  verify_email: "Check your email to verify your account before signing in.",
  creator_required:
    "Creator studio requires a creator account. Apply from your settings page.",
};

export function AuthAlert() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  const key = error ?? message;
  if (!key) return null;

  const isError = Boolean(error);
  const className = isError
    ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    : "rounded-md border px-3 py-2 text-sm text-muted-foreground";

  if (key === "account_disabled") {
    return (
      <p role="alert" className={className}>
        Your account is suspended or banned.{" "}
        <Link href="/appeal" className="font-medium underline underline-offset-2">
          Submit an appeal
        </Link>{" "}
        if you think this is a mistake.
      </p>
    );
  }

  if (key === "account_deleted") {
    return (
      <p role="alert" className={className}>
        This account has been deleted and can no longer be accessed.
      </p>
    );
  }

  const text = MESSAGES[key] ?? decodeURIComponent(key);

  return (
    <p role="alert" className={className}>
      {text}
    </p>
  );
}
