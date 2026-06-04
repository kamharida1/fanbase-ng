export type PlanBillingInterval = "monthly" | "annual" | "free";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export type SubscriptionPlanRow = {
  id: string;
  creator_id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  currency: string;
  billing_interval: PlanBillingInterval;
  paystack_plan_code: string | null;
  benefits: Record<string, unknown>;
  sort_order: number;
  is_active: boolean;
  trial_days: number;
};

export type FanSubscriptionRow = {
  id: string;
  fan_id: string;
  creator_id: string;
  plan_id: string;
  status: SubscriptionStatus;
  billing_interval: PlanBillingInterval;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  cancelled_at: string | null;
  ended_at: string | null;
  created_at: string;
  plan?: {
    id: string;
    name: string;
    price_kobo: number;
    billing_interval: PlanBillingInterval;
  };
  creator?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
};
