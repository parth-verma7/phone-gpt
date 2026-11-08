import type { SearchRateLimitDetails } from './webSearch';

export const SEARCH_LIMIT_FALLBACK_PROMPT = 'Web search was unavailable because a search limit was reached. No fresh web evidence was retrieved for this turn. Answer from existing conversation and general knowledge where useful. Do not claim to have searched, invent sources or claim to verify current facts, prices or changing values. If the request needs current information, briefly explain you cannot verify it now and give relevant general context.';

export function searchLimitNotice(details: SearchRateLimitDetails) {
  const format = (iso?: string) => iso && Number.isFinite(Date.parse(iso)) ? new Date(iso).toLocaleString() : undefined;
  const reset = format(details.resetAt);
  const start = format(details.windowStartedAt);
  return `${details.kind === 'daily_quota' ? 'Today’s shared web-search limit has been reached.' : (details.limit ? `Your network has used its ${details.limit} web searches for this hour.` : 'Your network’s hourly web-search limit has been reached.')}${start ? ` Search window started: ${start}.` : ''}${reset ? ` Search available again after ${reset}.` : ' Please try searching again later.'} Answering on your phone without a fresh web search. No automatic retry.`;
}
