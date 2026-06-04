/**
 * Content access checks — delegates to subscription RLS helpers and RPCs.
 */
export {
  canViewPost,
  hasActiveSubscription,
  hasPlanAccess,
  isPeriodValid,
  isSubscriptionAccessActive,
} from "@/lib/subscriptions/access";
