"use client";

import { useState } from "react";
import { CheckCircle, Clock, XCircle } from "lucide-react";

import { requestVerification } from "@/lib/creators/verification-actions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

type Props = {
  kycStatus: "none" | "pending" | "verified" | "rejected";
  rejectedReason?: string | null;
  existingNote?: string | null;
};

export function VerificationRequestCard({ kycStatus, rejectedReason, existingNote }: Props) {
  const [note, setNote] = useState(existingNote ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  if (kycStatus === "verified") {
    return (
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <CheckCircle className="h-6 w-6 shrink-0 text-green-500" />
          <div>
            <h2 className="font-semibold">Verified creator</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your account has been verified. The checkmark is shown on your public profile.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (kycStatus === "pending" || submitted) {
    return (
      <div className="rounded-xl border p-6">
        <div className="flex items-center gap-3">
          <Clock className="h-6 w-6 shrink-0 text-amber-500" />
          <div>
            <h2 className="font-semibold">Verification under review</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              We received your request and will review it within 3–5 business days.
            </p>
          </div>
        </div>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const result = await requestVerification({ note });
    setLoading(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setSubmitted(true);
  }

  return (
    <div className="rounded-xl border p-6 space-y-4">
      <div>
        <h2 className="font-semibold">Request verification</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Get a verified badge on your profile. Tell us who you are and why you should be verified.
        </p>
      </div>

      {kycStatus === "rejected" && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <div className="text-sm text-destructive">
            <p className="font-medium">Previous request was not approved.</p>
            {rejectedReason && <p className="mt-0.5">{rejectedReason}</p>}
            <p className="mt-1">You may submit a new request below.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="verif-note">About you</Label>
          <Textarea
            id="verif-note"
            rows={4}
            placeholder="Describe who you are — your profession, social media presence, website, or why you're a notable creator…"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
          />
          <p className="text-xs text-muted-foreground text-right">{note.length}/500</p>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <Button type="submit" disabled={loading || note.trim().length < 10}>
          {loading ? "Submitting…" : "Submit request"}
        </Button>
      </form>
    </div>
  );
}
