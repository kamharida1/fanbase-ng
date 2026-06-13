"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { recordSession, resolvePostLoginPath } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { mapAuthError } from "@/lib/auth/errors";
import { createClient } from "@/lib/supabase/client";

export function VerifyOtpForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [email, setEmail] = useState(searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error: otpError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: code.trim(),
      type: "signup",
    });

    if (otpError) {
      setLoading(false);
      setError(mapAuthError(otpError.message));
      return;
    }

    await recordSession(
      typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    );
    const dest = await resolvePostLoginPath("/feed");
    setLoading(false);
    router.push(dest);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-3 text-left">
      <div className="space-y-2">
        <Label htmlFor="verifyEmail">Email</Label>
        <Input
          id="verifyEmail"
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="verifyCode">6-digit code</Label>
        <Input
          id="verifyCode"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          maxLength={OTP_LENGTH}
          pattern="[0-9]{6}"
          placeholder="123456"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Verifying…" : "Verify and continue"}
      </Button>
    </form>
  );
}
