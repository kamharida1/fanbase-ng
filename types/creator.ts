export type SocialLinks = {
  website?: string;
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  youtube?: string;
};

import type { PlanBillingInterval } from "@/types/subscription";

export type SubscriptionPlanPublic = {
  id: string;
  name: string;
  description: string | null;
  price_kobo: number;
  currency: string;
  billing_interval: PlanBillingInterval;
  benefits: Record<string, unknown>;
  trial_days: number;
  sort_order: number;
};

export type CreatorProfilePublic = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  banner_url: string | null;
  is_verified: boolean;
  is_accepting_subscribers: boolean;
  social_links: SocialLinks;
  plans: SubscriptionPlanPublic[];
};

export type CreatorProfileRow = {
  user_id: string;
  bio: string | null;
  banner_url: string | null;
  is_verified: boolean;
  is_accepting_subscribers: boolean;
  social_links: SocialLinks;
  category: string[];
};

export type CreatorListItem = {
  user_id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  is_verified: boolean;
  plan_count: number;
  min_price_kobo: number | null;
  is_live?: boolean;
};
