import type { UserRole } from "@/types/index";

/** Application roles (user-facing names). */
export type AppRole =
  | "user"
  | "creator"
  | "moderator"
  | "admin"
  | "super_admin";

export type ProfileAuthRow = {
  id: string;
  role: UserRole;
  status: string;
  username: string;
  display_name: string | null;
};

export type AuthContext = {
  userId: string;
  email: string | undefined;
  profile: ProfileAuthRow;
  appRole: AppRole;
  adminRoleSlug: string | null;
};
