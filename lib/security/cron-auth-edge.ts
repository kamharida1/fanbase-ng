/**
 * Edge-compatible cron bearer check (middleware runs on Edge runtime).
 * Uses a constant-time character comparison without Node `crypto`.
 */
export function verifyCronBearerEdge(authHeader: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  if (!authHeader?.startsWith("Bearer ")) return false;

  const provided = authHeader.slice(7);
  if (provided.length !== secret.length) return false;

  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  }
  return diff === 0;
}
