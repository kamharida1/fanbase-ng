import { type NextRequest, NextResponse } from "next/server";

import { getDefaultPathForRole } from "@/lib/auth/rbac";
import {
  canAccessPath,
  getRequiredRoleForPath,
  isAuthPath,
  isPublicPath,
  isResetPasswordPath,
  sanitizeNextPath,
} from "@/lib/auth/paths";
import { createRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { verifyApiMutationOrigin } from "@/lib/security/api-origin";
import { verifyCronBearerEdge } from "@/lib/security/cron-auth-edge";
import { updateSession } from "@/lib/supabase/middleware";

function withRequestId(response: NextResponse, requestId: string): NextResponse {
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId =
    request.headers.get(REQUEST_ID_HEADER) ?? createRequestId();

  if (pathname.startsWith("/api/internal")) {
    if (!verifyCronBearerEdge(request.headers.get("authorization"))) {
      return withRequestId(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        requestId,
      );
    }
    return withRequestId(NextResponse.next(), requestId);
  }

  if (
    pathname.startsWith("/api/v1") &&
    !pathname.startsWith("/api/v1/webhooks")
  ) {
    if (!verifyApiMutationOrigin(request)) {
      return withRequestId(
        NextResponse.json({ error: "Forbidden" }, { status: 403 }),
        requestId,
      );
    }
  }

  const { response, user, auth } = await updateSession(request);

  if (isPublicPath(pathname) && !isAuthPath(pathname)) {
    return withRequestId(response, requestId);
  }

  if (isResetPasswordPath(pathname)) {
    return withRequestId(response, requestId);
  }

  if (isAuthPath(pathname)) {
    if (user && auth) {
      const safeNext = sanitizeNextPath(
        request.nextUrl.searchParams.get("next"),
      );
      const dest =
        safeNext && canAccessPath(safeNext, auth.appRole)
          ? safeNext
          : getDefaultPathForRole(auth.appRole);
      return withRequestId(
        NextResponse.redirect(new URL(dest, request.url)),
        requestId,
      );
    }
    return withRequestId(response, requestId);
  }

  const requiredRole = getRequiredRoleForPath(pathname);

  if (requiredRole) {
    if (!user || !auth) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return withRequestId(NextResponse.redirect(loginUrl), requestId);
    }

    if (
      auth.profile.status === "banned" ||
      auth.profile.status === "suspended"
    ) {
      return withRequestId(
        NextResponse.redirect(
          new URL("/login?error=account_disabled", request.url),
        ),
        requestId,
      );
    }

    if (!canAccessPath(pathname, auth.appRole)) {
      return withRequestId(
        NextResponse.redirect(
          new URL(getDefaultPathForRole(auth.appRole), request.url),
        ),
        requestId,
      );
    }
  }

  return withRequestId(response, requestId);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
