import Link from "next/link";
import { AlertCircle, CheckCircle2, Clock } from "lucide-react";

import {
  EARNINGS_CLEARANCE_DAYS,
  MIN_WITHDRAWAL_KOBO,
  PLATFORM_FEE_BPS,
} from "@/lib/wallets/constants";
import { formatNgnFromKobo } from "@/lib/wallets/format";

type KycStatus = "none" | "pending" | "verified" | "rejected";

const KYC_COPY: Record<
  KycStatus,
  { title: string; detail: string; tone: "ok" | "warn" | "neutral" }
> = {
  verified: {
    title: "Identity verified",
    detail: "You can request withdrawals once funds clear.",
    tone: "ok",
  },
  pending: {
    title: "Verification under review",
    detail: "Withdrawals unlock after admin approval. This usually takes 1–2 business days.",
    tone: "neutral",
  },
  rejected: {
    title: "Verification needed",
    detail: "Your last request was not approved. Submit updated details on your profile.",
    tone: "warn",
  },
  none: {
    title: "Verify your identity",
    detail: "Complete creator verification before your first withdrawal.",
    tone: "warn",
  },
};

export function PayoutRequirementsNotice({
  kycStatus,
}: {
  kycStatus: KycStatus;
}) {
  const kyc = KYC_COPY[kycStatus];
  const feePct = PLATFORM_FEE_BPS / 100;

  return (
    <div className="rounded-xl border bg-muted/30 p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold">How payouts work</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Earnings move through a short clearance period before you can withdraw.
        </p>
      </div>

      <ul className="space-y-3 text-sm">
        <li className="flex gap-3">
          <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">Clearance:</span> new earnings stay in
            pending for {EARNINGS_CLEARANCE_DAYS} days, then move to available.
          </span>
        </li>
        <li className="flex gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">Minimum withdrawal:</span>{" "}
            {formatNgnFromKobo(MIN_WITHDRAWAL_KOBO)} per request.
          </span>
        </li>
        <li className="flex gap-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            <span className="font-medium">Platform fee:</span> {feePct}% is
            deducted from fan payments before they credit your wallet.
          </span>
        </li>
        <li className="flex gap-3">
          {kyc.tone === "ok" ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-600" aria-hidden />
          ) : (
            <AlertCircle
              className={`mt-0.5 h-4 w-4 shrink-0 ${kyc.tone === "warn" ? "text-amber-600" : "text-muted-foreground"}`}
              aria-hidden
            />
          )}
          <span>
            <span className="font-medium">{kyc.title}:</span> {kyc.detail}{" "}
            {kycStatus !== "verified" ? (
              <Link href="/creator/profile" className="font-medium underline">
                Go to profile
              </Link>
            ) : null}
          </span>
        </li>
      </ul>
    </div>
  );
}
