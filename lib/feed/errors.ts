export class FeedUnavailableError extends Error {
  readonly code = "feed_unavailable";

  constructor(message = "Feed is temporarily unavailable.") {
    super(message);
    this.name = "FeedUnavailableError";
  }
}
