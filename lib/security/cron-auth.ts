import { timingSafeEqual } from "crypto";

export function verifyCronBearer(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;

  const provided = authHeader.slice(7);
  if (provided.length !== secret.length) return false;

  try {
    return timingSafeEqual(
      Buffer.from(provided, "utf8"),
      Buffer.from(secret, "utf8"),
    );
  } catch {
    return false;
  }
}
