"use client";

import { useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { verifySignupOtp } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OTP_LENGTH } from "@/lib/auth/constants";
import { cn } from "@/lib/utils";

function OtpInput({
  value,
  onChange,
  length,
}: {
  value: string;
  onChange: (value: string) => void;
  length: number;
}) {
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length }, (_, i) => value[i] ?? "");

  function setDigit(index: number, digit: string) {
    const next = digits.slice();
    next[index] = digit;
    onChange(next.join(""));
  }

  function handleChange(index: number, raw: string) {
    const clean = raw.replace(/\D/g, "");
    if (!clean) {
      setDigit(index, "");
      return;
    }
    if (clean.length > 1) {
      // Pasted a multi-digit string into one box — distribute across remaining boxes.
      const next = digits.slice();
      for (let i = 0; i < clean.length && index + i < length; i++) {
        next[index + i] = clean[i]!;
      }
      onChange(next.join(""));
      const target = Math.min(index + clean.length, length - 1);
      inputRefs.current[target]?.focus();
      return;
    }
    setDigit(index, clean);
    if (index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div className="flex justify-center gap-2" role="group" aria-label="6-digit verification code">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el;
          }}
          type="text"
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          maxLength={length}
          value={digit}
          onChange={(e) => handleChange(index, e.target.value)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          className={cn(
            "h-12 w-10 rounded-lg border border-input bg-background text-center text-lg font-semibold",
            "focus:border-primary focus:outline-none focus:ring-2 focus:ring-ring",
          )}
        />
      ))}
    </div>
  );
}

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

    try {
      const result = await verifySignupOtp(
        email,
        code,
        typeof navigator !== "undefined" ? navigator.userAgent : undefined,
      );

      if (!result.success) {
        setError(result.error);
        return;
      }

      router.push(result.redirectTo);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-sm space-y-4 text-left">
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
        <Label className="block text-center">Enter the 6-digit code</Label>
        <OtpInput value={code} onChange={setCode} length={OTP_LENGTH} />
      </div>
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <Button
        type="submit"
        className="w-full"
        disabled={loading || code.length !== OTP_LENGTH}
      >
        {loading ? "Verifying…" : "Verify and continue"}
      </Button>
    </form>
  );
}
