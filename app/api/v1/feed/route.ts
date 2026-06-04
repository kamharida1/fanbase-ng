import { NextResponse } from "next/server";

import { apiError, apiOk } from "@/lib/api/response";
import { requireApiAuth } from "@/lib/auth/api";
import { FeedUnavailableError } from "@/lib/feed/errors";
import {
  FEED_CACHE_SECONDS,
  FEED_MAX_PAGE_SIZE,
  FEED_STALE_WHILE_REVALIDATE,
} from "@/lib/feed/constants";
import { getHomeFeedPage } from "@/lib/feed/queries";
import { logger } from "@/lib/logger";
import { enforceRateLimit } from "@/lib/rate-limit-http";
import { requestIdFromHeaders } from "@/lib/request-id";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestId = requestIdFromHeaders(request);
  const authResult = await requireApiAuth("user");
  if (authResult instanceof NextResponse) return authResult;

  const { searchParams } = new URL(request.url);
  const isFresh = searchParams.get("fresh") === "1";

  if (isFresh) {
    const limited = await enforceRateLimit(
      request,
      "feedFresh",
      authResult.ctx.userId,
    );
    if (limited) return limited;
  }

  const cursor = searchParams.get("cursor");
  const limit = Math.min(
    parseInt(searchParams.get("limit") ?? "15", 10) || 15,
    FEED_MAX_PAGE_SIZE,
  );

  try {
    const supabase = await createClient();
    const page = await getHomeFeedPage(supabase, authResult.ctx.userId, {
      cursor,
      limit,
      skipCache: isFresh,
    });

    return apiOk(
      {
        posts: page.posts,
        nextCursor: page.nextCursor,
        hasMore: page.hasMore,
      },
      {
        requestId,
        headers: {
          "Cache-Control": `private, max-age=${FEED_CACHE_SECONDS}, stale-while-revalidate=${FEED_STALE_WHILE_REVALIDATE}`,
        },
      },
    );
  } catch (err) {
    if (err instanceof FeedUnavailableError) {
      return apiError(err.message, 503, { requestId });
    }
    logger.error("feed.api_unhandled", {
      requestId,
      error: err instanceof Error ? err.message : "unknown",
    });
    return apiError("Could not load feed.", 500, { requestId });
  }
}
