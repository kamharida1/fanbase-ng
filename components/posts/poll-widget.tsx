"use client";

import { useState } from "react";

import { votePoll } from "@/lib/posts/actions";
import type { PostPoll } from "@/types/posts";

function formatClosesLabel(closesAt: string | null, isClosed: boolean): string | null {
  if (!closesAt) return null;
  if (isClosed) return "Poll closed";

  const ms = new Date(closesAt).getTime() - Date.now();
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours <= 1) return "Closes in less than an hour";
  if (hours < 24) return `Closes in ${hours} hours`;
  return `Closes in ${Math.ceil(hours / 24)} days`;
}

export function PollWidget({ poll }: { poll: PostPoll }) {
  const [myVoteOptionId, setMyVoteOptionId] = useState(poll.my_vote_option_id);
  const [options, setOptions] = useState(poll.options);
  const [totalVotes, setTotalVotes] = useState(poll.total_votes);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isClosed = Boolean(poll.closes_at && new Date(poll.closes_at) <= new Date());
  const showResults = Boolean(myVoteOptionId) || isClosed;
  const closesLabel = formatClosesLabel(poll.closes_at, isClosed);

  async function handleVote(optionId: string) {
    if (loading || showResults) return;
    setError(null);
    setLoading(true);
    const result = await votePoll({ pollId: poll.id, optionId });
    setLoading(false);

    if (!result.success) {
      setError(result.error);
      return;
    }

    setMyVoteOptionId(optionId);
    setTotalVotes((t) => t + 1);
    setOptions((prev) =>
      prev.map((o) => (o.id === optionId ? { ...o, vote_count: o.vote_count + 1 } : o)),
    );
  }

  return (
    <div className="mt-3 space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">{poll.question}</p>

      <div className="space-y-1.5">
        {options.map((option) => {
          const pct = totalVotes > 0 ? Math.round((option.vote_count / totalVotes) * 100) : 0;
          const isMine = option.id === myVoteOptionId;

          if (showResults) {
            return (
              <div
                key={option.id}
                className={`relative overflow-hidden rounded-md border px-3 py-2 text-sm ${
                  isMine ? "border-primary" : ""
                }`}
              >
                <div
                  className="absolute inset-y-0 left-0 bg-primary/10"
                  style={{ width: `${pct}%` }}
                  aria-hidden
                />
                <div className="relative flex items-center justify-between gap-2">
                  <span className={isMine ? "font-medium" : ""}>
                    {option.label}
                    {isMine ? " · Your vote" : ""}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{pct}%</span>
                </div>
              </div>
            );
          }

          return (
            <button
              key={option.id}
              type="button"
              disabled={loading}
              onClick={() => void handleVote(option.id)}
              className="w-full rounded-md border px-3 py-2 text-left text-sm transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
            >
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground">
        {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
        {closesLabel ? ` · ${closesLabel}` : ""}
      </p>
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
