import { Suspense } from "react";

import { AuthAlert } from "@/components/auth/auth-alert";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-center">Create account</h1>
      <Suspense fallback={null}>
        <AuthAlert />
      </Suspense>
      <SignupForm />
    </div>
  );
}
