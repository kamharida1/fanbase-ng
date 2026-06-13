import { Suspense } from "react";

import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold">Choose a new password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter the 6-digit code we emailed you and your new password (at least 8 characters)
        </p>
      </div>
      <Suspense
        fallback={
          <p className="text-center text-sm text-muted-foreground">Loading…</p>
        }
      >
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
