import { SubscriptionsManager } from "@/components/subscriptions/subscriptions-manager";
import { VerifyCheckout } from "@/components/subscriptions/verify-checkout";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { formatNgnFromKobo } from "@/lib/creators/format";
import { listGiftsSentByUser } from "@/lib/subscriptions/gifting";
import { listFanSubscriptions } from "@/lib/subscriptions/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

const GIFT_STATUS_LABELS: Record<string, string> = {
  pending: "Processing",
  fulfilled: "Delivered",
  failed: "Failed",
};

type PageProps = {
  searchParams: Promise<{
    checkout?: string;
    subscribed?: string;
    reference?: string;
  }>;
};

export default async function SubscriptionsPage({ searchParams }: PageProps) {
  const supabase = await createClient();
  const auth = await getAuthContext(supabase);
  if (!auth) redirect("/login?next=/subscriptions");

  const [subscriptions, gifts] = await Promise.all([
    listFanSubscriptions(supabase, auth.userId),
    listGiftsSentByUser(supabase, auth.userId),
  ]);
  const params = await searchParams;

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-2xl font-bold">Subscriptions</h1>
      <p className="mt-2 text-muted-foreground">
        Manage active subscriptions and billing.
      </p>
      {params.checkout === "success" ? (
        <VerifyCheckout reference={params.reference ?? null} />
      ) : null}
      {params.subscribed === "1" ? (
        <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-900 dark:bg-green-950 dark:text-green-100">
          You are now subscribed.
        </p>
      ) : null}
      <SubscriptionsManager subscriptions={subscriptions} />

      {gifts.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-lg font-semibold">Gifts you&apos;ve sent</h2>
          <ul className="mt-3 space-y-2">
            {gifts.map((gift) => (
              <li
                key={gift.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-medium">
                    {gift.months} {gift.months === 1 ? "month" : "months"} of{" "}
                    {gift.plan?.name ?? "a plan"} for{" "}
                    {gift.recipient?.display_name ?? `@${gift.recipient?.username ?? "user"}`}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatNgnFromKobo(gift.amount_kobo)} ·{" "}
                    {new Intl.DateTimeFormat("en-NG", { dateStyle: "medium" }).format(
                      new Date(gift.created_at),
                    )}
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                    gift.status === "fulfilled"
                      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                      : gift.status === "failed"
                        ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {GIFT_STATUS_LABELS[gift.status] ?? gift.status}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
