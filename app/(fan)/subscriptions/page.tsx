import { SubscriptionsManager } from "@/components/subscriptions/subscriptions-manager";
import { VerifyCheckout } from "@/components/subscriptions/verify-checkout";
import { getAuthContext } from "@/lib/auth/get-auth-context";
import { listFanSubscriptions } from "@/lib/subscriptions/queries";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

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

  const subscriptions = await listFanSubscriptions(supabase, auth.userId);
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
    </div>
  );
}
