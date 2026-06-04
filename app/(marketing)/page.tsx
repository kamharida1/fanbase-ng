import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Lock,
  MessageCircle,
  Shield,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { CreatorCard } from "@/components/creator/creator-card";
import { APP_DESCRIPTION, APP_NAME, PLATFORM_FEE_BPS } from "@/config/constants";
import { listCreators } from "@/lib/creators/queries";
import {
  createPublicClient,
  hasPublicSupabaseEnv,
} from "@/lib/supabase/public";

export const revalidate = 3600;

const CREATOR_KEEP_PCT = 100 - PLATFORM_FEE_BPS / 100;

const FEATURES = [
  {
    Icon: Lock,
    title: "Exclusive content",
    description:
      "Subscribers unlock posts, videos, and behind-the-scenes content that fans can't see anywhere else.",
  },
  {
    Icon: MessageCircle,
    title: "Direct messaging",
    description:
      "Fans can message creators directly. Creators can charge per message for premium conversations.",
  },
  {
    Icon: Wallet,
    title: "Naira wallet",
    description:
      "Earnings land in your Naira wallet in real time. Withdraw to any Nigerian bank account at any time.",
  },
  {
    Icon: TrendingUp,
    title: "Flexible tiers",
    description:
      "Set your own subscription prices and benefits. Offer monthly plans, free tiers, or one-time pay-per-view posts.",
  },
  {
    Icon: BadgeCheck,
    title: "Verified creators",
    description:
      "Verified badges on genuine accounts so fans always know they're supporting the real creator.",
  },
  {
    Icon: Shield,
    title: "Moderated platform",
    description:
      "Content goes through review before it goes live. A safe, respectful environment for everyone.",
  },
] as const;

const FAN_STEPS = [
  {
    n: "01",
    title: "Find creators you love",
    desc: "Browse verified Nigerian creators across music, comedy, fashion, fitness, and more.",
  },
  {
    n: "02",
    title: "Subscribe with your card",
    desc: "Pay securely in Naira via Paystack — debit card, bank transfer, or USSD.",
  },
  {
    n: "03",
    title: "Unlock exclusive access",
    desc: "See subscriber-only posts, message your favourite creators, and unlock pay-per-view content.",
  },
];

const CREATOR_STEPS = [
  {
    n: "01",
    title: "Set up your profile",
    desc: "Create your public page, write your bio, upload a banner, and connect your social links.",
  },
  {
    n: "02",
    title: "Publish exclusive content",
    desc: "Post photos, videos, and text — visible only to subscribers or pay-per-view buyers.",
  },
  {
    n: "03",
    title: "Earn and withdraw",
    desc: `Keep ${CREATOR_KEEP_PCT}% of every payment. Withdraw to your Nigerian bank in minutes.`,
  },
];

export default async function HomePage() {
  const featured = hasPublicSupabaseEnv()
    ? await listCreators(createPublicClient(), { limit: 6 })
    : [];

  return (
    <main>
      {/* ── Hero ──────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-slate-950 px-4 py-20 text-white sm:px-6 sm:py-36">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              "radial-gradient(ellipse 90% 60% at 50% -5%, oklch(0.45 0.18 260 / 0.6), transparent)",
          }}
        />
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-sm font-semibold uppercase tracking-widest text-slate-400">
            The Nigerian creator economy
          </p>
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-6xl">
            Support Nigerian creators{" "}
            <span className="text-slate-300">you love</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-300">
            {APP_DESCRIPTION} Subscribe monthly, unlock pay-per-view posts, and
            message your favourite creators — all in Naira.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/signup"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-white px-8 text-base font-semibold text-slate-950 transition-colors hover:bg-slate-100"
            >
              Get started free
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Link>
            <Link
              href="/creators"
              className="inline-flex h-12 items-center rounded-lg border border-white/20 px-8 text-base font-medium text-white transition-colors hover:bg-white/10"
            >
              Explore creators
            </Link>
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            How it works
          </h2>
          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {/* For fans */}
            <div className="rounded-2xl border p-8">
              <p className="mb-8 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium">
                <Users className="h-4 w-4 text-muted-foreground" aria-hidden />
                For fans
              </p>
              <ol className="space-y-8">
                {FAN_STEPS.map((step) => (
                  <li key={step.n} className="flex gap-5">
                    <span className="shrink-0 text-3xl font-black tabular-nums text-muted-foreground/25">
                      {step.n}
                    </span>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/signup"
                className="mt-10 inline-flex h-10 items-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
              >
                Join as a fan
              </Link>
            </div>

            {/* For creators */}
            <div className="rounded-2xl bg-muted/50 p-8">
              <p className="mb-8 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm font-medium">
                <TrendingUp
                  className="h-4 w-4 text-muted-foreground"
                  aria-hidden
                />
                For creators
              </p>
              <ol className="space-y-8">
                {CREATOR_STEPS.map((step) => (
                  <li key={step.n} className="flex gap-5">
                    <span className="shrink-0 text-3xl font-black tabular-nums text-muted-foreground/25">
                      {step.n}
                    </span>
                    <div>
                      <h3 className="font-semibold">{step.title}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {step.desc}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
              <Link
                href="/signup"
                className="mt-10 inline-flex h-10 items-center rounded-md border bg-background px-5 text-sm font-medium"
              >
                Start as a creator
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────────────────── */}
      <section className="border-y bg-muted/30 px-4 py-16 sm:px-6 sm:py-20">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Everything you need
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-center text-muted-foreground">
            Built specifically for Nigerian creators and their fans, with tools
            that just work.
          </p>
          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ Icon, title, description }) => (
              <div key={title} className="rounded-xl border bg-background p-6">
                <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <Icon className="h-5 w-5" aria-hidden />
                </div>
                <h3 className="font-semibold">{title}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  {description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured creators ─────────────────────────────────────────────── */}
      {featured.length > 0 && (
        <section className="px-4 py-16 sm:px-6 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
                Featured creators
              </h2>
              <Link
                href="/creators"
                className="inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
              >
                View all
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((creator) => (
                <CreatorCard key={creator.user_id} creator={creator} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── Creator CTA ───────────────────────────────────────────────────── */}
      <section className="bg-slate-950 px-4 py-20 text-white sm:px-6 sm:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Ready to start earning?
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-slate-300">
            Join {APP_NAME} today. Set up your creator page in minutes and start
            monetising your audience — withdraw earnings to your Nigerian bank
            account whenever you want.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-8 text-base font-semibold text-slate-950 transition-colors hover:bg-slate-100"
          >
            Create your page
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
          <p className="mt-4 text-sm text-slate-500">
            Free to join. Keep {CREATOR_KEEP_PCT}% of everything you earn.
          </p>
        </div>
      </section>
    </main>
  );
}
