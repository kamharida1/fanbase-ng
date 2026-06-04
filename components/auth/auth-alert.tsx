"use client";

import { useSearchParams } from "next/navigation";

const MESSAGES: Record<string, string> = {
  auth_callback: "Sign-in link expired or invalid. Please try again.",
  account_disabled:
    "Your account is suspended or banned. Contact support if you think this is a mistake.",
  password_updated: "Your password has been updated. You can sign in now.",
  check_email_reset: "If that email exists, we sent a password reset link.",
  verify_email: "Check your email to verify your account before signing in.",
  creator_required:
    "Creator studio requires a creator account. Apply from settings (coming soon).",
};

export function AuthAlert() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");
  const message = searchParams.get("message");

  const key = error ?? message;
  if (!key) return null;

  const text = MESSAGES[key] ?? decodeURIComponent(key);
  const isError = Boolean(error);

  return (
    <p
      role="alert"
      className={
        isError
          ? "rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          : "rounded-md border px-3 py-2 text-sm text-muted-foreground"
      }
    >
      {text}
    </p>
  );
}
