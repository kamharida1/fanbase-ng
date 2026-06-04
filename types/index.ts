export type UserRole = "fan" | "creator" | "admin" | "moderator";
export type UserStatus =
  | "active"
  | "suspended"
  | "banned"
  | "pending_verification";
export type SubscriptionStatus =
  | "trialing"
  | "active"
  | "past_due"
  | "cancelled"
  | "expired";

export interface ApiResponse<T> {
  data?: T;
  error?: string;
  meta?: Record<string, unknown>;
}
