import { headers } from "next/headers";

export const REQUEST_ID_HEADER = "x-request-id";

export function createRequestId(): string {
  return crypto.randomUUID();
}

export function requestIdFromHeaders(request: Request): string {
  return request.headers.get(REQUEST_ID_HEADER) ?? createRequestId();
}

/** Server Components / route handlers using next/headers */
export async function getRequestId(): Promise<string> {
  const h = await headers();
  return h.get(REQUEST_ID_HEADER) ?? createRequestId();
}
