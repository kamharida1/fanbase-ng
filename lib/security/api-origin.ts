const MUTATING = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function allowedOrigins(): Set<string> {
  const origins = new Set<string>();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) {
    try {
      origins.add(new URL(appUrl).origin);
    } catch {
      // ignore invalid env
    }
  }
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) {
    origins.add(`https://${vercel}`);
  }
  return origins;
}

export function verifyApiMutationOrigin(request: Request): boolean {
  if (!MUTATING.has(request.method)) return true;

  const origin = request.headers.get("origin");
  const secFetchSite = request.headers.get("sec-fetch-site");

  if (!origin) {
    if (secFetchSite === "same-origin" || secFetchSite === "same-site") {
      return true;
    }
    return process.env.NODE_ENV !== "production";
  }

  let originUrl: URL;
  try {
    originUrl = new URL(origin);
  } catch {
    return false;
  }

  // Same-origin requests (the normal case for browser fetches from our own
  // pages) are always allowed — checked first so this works for any custom
  // domain pointed at this deployment, regardless of NEXT_PUBLIC_APP_URL.
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const requestHost = host?.split(",")[0]?.trim().toLowerCase();
  if (requestHost && originUrl.host.toLowerCase() === requestHost) {
    return true;
  }

  return allowedOrigins().has(originUrl.origin);
}
