import { formatNgnFromKobo } from "@/lib/creators/format";
import type { PlanBillingInterval } from "@/types/subscription";

export function billingIntervalLabel(interval: PlanBillingInterval): string {
  switch (interval) {
    case "monthly":
      return "month";
    case "annual":
      return "year";
    case "free":
      return "free";
  }
}

export function formatPlanPrice(
  priceKobo: number,
  interval: PlanBillingInterval,
): string {
  if (interval === "free") return "Free";
  const amount = formatNgnFromKobo(priceKobo);
  if (interval === "annual") return `${amount}/year`;
  return `${amount}/month`;
}
