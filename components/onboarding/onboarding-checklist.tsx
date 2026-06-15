"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, ChevronDown, ChevronRight, ChevronUp, X } from "lucide-react";

import type { OnboardingStatus } from "@/lib/onboarding/queries";

const DISMISS_KEY = "fanbase-onboarding-dismissed";

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
    description: "Optional — only needed if you want paid subscribers.",
    href: "/creator/tiers",
    cta: "Create plan",
  },
  {
    id: "hasPost",
    title: "Publish your first post",
    description: "Share something on your feed and public profile.",
    href: "/creator/content/new",
    cta: "Create post",
  },
];

type Props = { status: OnboardingStatus };

export function OnboardingChecklist({ status }: Props) {
  const [dismissed, setDismissed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  if (status.allDone || dismissed) return null;

  const pct = Math.round((status.completedCount / status.totalCount) * 100);
  const nextStep = STEPS.find((step) => !status[step.id]);

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  }

  return (
    <div className="rounded-xl border bg-card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Optional setup</h2>
          <p className="text-sm text-muted-foreground">
            Finish these when you are ready — you can post and browse without
            completing them.
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Dismiss setup checklist"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>

      {nextStep ? (
        <Link
          href={nextStep.href}
          className="group flex items-center gap-3 rounded-lg border px-3 py-3 transition-colors hover:bg-muted"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {status.completedCount + 1}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">Next: {nextStep.title}</p>
            <p className="text-xs text-muted-foreground">{nextStep.description}</p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        </Link>
      ) : null}

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 font-medium text-primary"
        >
          {expanded ? (
            <>
              Hide all steps <ChevronUp className="h-4 w-4" />
            </>
          ) : (
            <>
              Show all steps <ChevronDown className="h-4 w-4" />
            </>
          )}
        </button>
        <Link href="/feed" className="text-muted-foreground underline-offset-4 hover:underline">
          Just browse the feed
        </Link>
      </div>

      {expanded ? (
        <ol className="space-y-2 border-t pt-4">
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
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
}
