const APP_BASE = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(
  /\/$/,
  "",
);

function appOrigin(): string | null {
  try {
    return new URL(APP_BASE).origin;
  } catch {
    return null;
  }
}

/** Relative in-app paths only (stored in notifications). */
export function sanitizeAppPath(path: string): string | null {
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\") || path.includes("\0") || /[\r\n]/.test(path)) return null;
  if (/^\/[a-zA-Z][a-zA-Z0-9+.-]*:/.test(path)) return null;
  try {
    const u = new URL(path, APP_BASE);
    const base = new URL(APP_BASE);
    if (u.origin !== base.origin) return null;
    return `${u.pathname}${u.search}${u.hash}`;
  } catch {
    return null;
  }
}

export function buildAppActionUrl(path: string): string {
  const safe = sanitizeAppPath(path);
  return safe ? `${APP_BASE}${safe}` : `${APP_BASE}/feed`;
}

/** Safe href for notification links (relative or same-origin absolute). */
export function toSafeNotificationHref(
  actionUrl: string | null | undefined,
): string | null {
  if (!actionUrl?.trim()) return null;
  const trimmed = actionUrl.trim();
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
    return sanitizeAppPath(trimmed);
  }
  try {
    const u = new URL(trimmed);
    const origin = appOrigin();
    if (!origin || u.origin !== origin) return null;
    if (u.protocol !== "http:" && u.protocol !== "https:") return null;
    return sanitizeAppPath(`${u.pathname}${u.search}${u.hash}`);
  } catch {
    return null;
  }
}
