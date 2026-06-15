import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";

import type { OnboardingStatus } from "@/lib/onboarding/queries";

type Step = {
  id: keyof Pick<OnboardingStatus, "hasBio" | "hasAvatar" | "hasPlan" | "hasPost">;
  title: string;
  description: string;
  href: string;
  cta: string;
};

const STEPS: Step[] = [
  {
    id: "hasAvatar",
    title: "Upload your profile photo",
    description: "A clear photo builds trust with fans.",
    href: "/creator/profile",
    cta: "Edit profile",
  },
  {
    id: "hasBio",
    title: "Write your bio",
    description: "Tell fans what your content is about.",
    href: "/creator/profile",
    cta: "Edit profile",
  },
  {
    id: "hasPlan",
    title: "Create a subscription plan",
    description: "Set a price so fans can subscribe to your content.",
    href: "/creator/tiers",
    cta: "Create plan",
  },
  {
    id: "hasPost",
    title: "Publish your first post",
    description: "It will appear on your feed and public profile for fans to see.",
    href: "/creator/content/new",
    cta: "Create post",
  },
];

type Props = { status: OnboardingStatus };

export function OnboardingChecklist({ status }: Props) {
  if (status.allDone) return null;

  const pct = Math.round((status.completedCount / status.totalCount) * 100);

  return (
    <div className="rounded-xl border bg-card p-6 space-y-5">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-4">
          <h2 className="text-lg font-semibold">Get set up</h2>
          <span className="shrink-0 text-sm text-muted-foreground">
            {status.completedCount} of {status.totalCount} done
          </span>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Steps */}
      <ol className="space-y-2">
        {STEPS.map((step) => {
          const done = status[step.id];
          return (
            <li key={step.id}>
              {done ? (
                <div className="flex items-center gap-3 rounded-lg px-3 py-2.5 opacity-50">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white">
                    <Check className="h-3.5 w-3.5" aria-hidden />
                  </span>
                  <span className="text-sm line-through">{step.title}</span>
                </div>
              ) : (
                <Link
                  href={step.href}
                  className="group flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-muted"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground/30 text-xs font-semibold text-muted-foreground group-hover:border-primary group-hover:text-primary" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{step.title}</p>
                    <p className="text-xs text-muted-foreground">{step.description}</p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    {step.cta}
                  </span>
                  <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
