import { apiError } from "@/lib/api/response";
import {
  checkRateLimit,
  RATE_LIMITS,
  type RateLimitResult,
} from "@/lib/rate-limit";
import { requestIdFromHeaders } from "@/lib/request-id";

type LimitName = keyof typeof RATE_LIMITS;

export async function enforceRateLimit(
  request: Request,
  name: LimitName,
  keySuffix: string,
): Promise<Response | null> {
  const config = RATE_LIMITS[name];
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const key = `${name}:${keySuffix}:${ip}`;
  const result = await checkRateLimit(key, config);
  return rateLimitToResponse(request, result);
}

export function rateLimitToResponse(
  request: Request,
  result: RateLimitResult,
): Response | null {
  if (result.ok) return null;
  return apiError("Too many requests.", 429, {
    requestId: requestIdFromHeaders(request),
    retryAfter: result.retryAfterSeconds,
  });
}
