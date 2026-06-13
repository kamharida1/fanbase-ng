import Link from "next/link";
import { Suspense } from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { ResendVerificationForm } from "@/components/auth/resend-verification-form";
import { VerifyOtpForm } from "@/components/auth/verify-otp-form";

export default function VerifyPage() {
  return (
    <div className="space-y-4 text-center">
      <h1 className="text-2xl font-bold">Verify your email</h1>
      <Suspense fallback={null}>
        <AuthAlert />
      </Suspense>
      <p className="text-sm text-muted-foreground">
        Enter the 6-digit code we emailed you to activate your account.
      </p>
      <Suspense fallback={null}>
        <VerifyOtpForm />
      </Suspense>
      <ResendVerificationForm />
      <Link href="/login" className="text-sm font-medium underline">
        Back to sign in
      </Link>
    </div>
  );
}
