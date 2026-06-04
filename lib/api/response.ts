import { NextResponse } from "next/server";

import { REQUEST_ID_HEADER } from "@/lib/request-id";

export function apiOk<T>(
  data: T,
  init?: ResponseInit & { requestId?: string },
): NextResponse {
  const headers = new Headers(init?.headers);
  if (init?.requestId) {
    headers.set(REQUEST_ID_HEADER, init.requestId);
  }
  return NextResponse.json({ data }, { ...init, headers });
}

export function apiError(
  error: string,
  status: number,
  init?: { requestId?: string; retryAfter?: number },
): NextResponse {
  const headers = new Headers();
  if (init?.requestId) {
    headers.set(REQUEST_ID_HEADER, init.requestId);
  }
  if (init?.retryAfter != null) {
    headers.set("Retry-After", String(init.retryAfter));
  }
  return NextResponse.json({ error }, { status, headers });
}
