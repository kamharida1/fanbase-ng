/**
 * Creator impersonation guard.
 *
 * Two checks:
 * 1. Reserved handle exact match (admin-managed blocklist).
 * 2. Levenshtein-distance fuzzy match against all verified creator
 *    usernames and display names — blocks confusingly similar handles.
 *
 * Normalisation strips leet substitutions so "paystack", "p4ystack",
 * and "p@ystack" all map to the same form before comparison.
 */

import { createAdminClient } from "@/lib/supabase/admin";

export type HandleGuardResult = { ok: true } | { ok: false; reason: string };

/**
 * Canonical normalization used for both storage and comparison.
 * Exported so callers can pre-compute before inserting into reserved_handles.
 */
export function normalizeHandle(str: string): string {
  return str
    .toLowerCase()
    .replace(/[\s_\-\.]+/g, "")
    .replace(/0/g, "o")
    .replace(/1/g, "i")
    .replace(/3/g, "e")
    .replace(/4/g, "a")
    .replace(/5/g, "s")
    .replace(/7/g, "t")
    .replace(/@/g, "a");
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  // Bail early on long strings to avoid O(m*n) in pathological cases
  if (Math.abs(m - n) > 2) return 3;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0)),
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/**
 * Checks both username and displayName for impersonation risk.
 * excludeUserId lets a user update their own profile without triggering on themselves.
 */
export async function checkHandleForImpersonation(input: {
  username?: string | null;
  displayName?: string | null;
  excludeUserId?: string;
}): Promise<HandleGuardResult> {
  const normUsername = input.username ? normalizeHandle(input.username) : null;
  const normDisplay = input.displayName ? normalizeHandle(input.displayName) : null;

  if (!normUsername && !normDisplay) return { ok: true };

  const admin = createAdminClient();

  // ── 1. Reserved handle check ──────────────────────────────────────────────
  if (normUsername) {
    const { count } = await admin
      .from("reserved_handles")
      .select("id", { count: "exact", head: true })
      .eq("normalized_handle", normUsername);

    if ((count ?? 0) > 0) {
      return {
        ok: false,
        reason: "This username is reserved and cannot be registered.",
      };
    }
  }

  // ── 2. Fuzzy match against verified creator handles ───────────────────────
  // Fetch verified creator user IDs first, then pull their usernames/display names.
  const { data: verifiedRows } = await admin
    .from("creator_profiles")
    .select("user_id")
    .eq("is_verified", true);

  const verifiedIds = (verifiedRows ?? []).map((r) => r.user_id);

  if (verifiedIds.length > 0) {
    const { data: profiles } = await admin
      .from("profiles")
      .select("id, username, display_name")
      .in("id", verifiedIds);

    for (const p of profiles ?? []) {
      if (input.excludeUserId && p.id === input.excludeUserId) continue;

      if (normUsername && p.username) {
        const dist = levenshtein(normUsername, normalizeHandle(p.username));
        if (dist <= 1) {
          return {
            ok: false,
            reason:
              "This username is too similar to a verified creator. Please choose a different one.",
          };
        }
      }

      // Only flag display-name collisions for names ≥ 4 characters to avoid
      // false positives on very common short names (e.g. "Ada", "Ugo").
      if (normDisplay && normDisplay.length >= 4 && p.display_name) {
        const dist = levenshtein(normDisplay, normalizeHandle(p.display_name));
        if (dist <= 1) {
          return {
            ok: false,
            reason:
              "This display name is too similar to a verified creator. Please choose a different one.",
          };
        }
      }
    }
  }

  return { ok: true };
}
