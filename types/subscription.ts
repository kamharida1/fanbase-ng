export type PlanBillingInterval = "monthly" | "annual" | "free";

export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired"
  | "paused";

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

export type SubscriptionPlanBundleRow = {
  id: string;
  plan_id: string;
  months: 3 | 6 | 12;
  discount_pct: number;
  is_active: boolean;
};

export type SubscriptionGiftStatus = "pending" | "fulfilled" | "failed";

export type SubscriptionGiftRow = {
  id: string;
  gifter_id: string;
  recipient_id: string;
  creator_id: string;
  plan_id: string;
  months: 1 | 3 | 6 | 12;
  amount_kobo: number;
  message: string | null;
  status: SubscriptionGiftStatus;
  fulfilled_at: string | null;
  created_at: string;
  plan?: {
    id: string;
    name: string;
    billing_interval: PlanBillingInterval;
  };
  recipient?: {
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
  creator?: {
    username: string;
    display_name: string | null;
  };
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
  paused_at: string | null;
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
