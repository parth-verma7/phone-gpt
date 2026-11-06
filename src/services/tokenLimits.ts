/** Editable fallback ceiling; not a verified model capacity or a default allocation. */
export const UNKNOWN_CONTEXT_LIMIT = 32768;
export const MIN_CONTEXT_TOKENS = 1024;
export const MIN_REPLY_TOKENS = 384;
export const CONTEXT_RESERVE = 256;
export function modelContextLimit(metadata: unknown): number | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const values = metadata as Record<string, unknown>;
  const architecture = values['general.architecture'];
  const raw = typeof architecture === 'string' ? values[`${architecture}.context_length`] : undefined;
  const number = typeof raw === 'number' || typeof raw === 'string' ? Number(raw) : NaN;
  return Number.isSafeInteger(number) && number >= MIN_CONTEXT_TOKENS ? number : null;
}
export function validTokenValue(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max;
}
export function replyLimit(context: number) { return Math.max(1, context - CONTEXT_RESERVE); }
export function normalizeTokenSettings<T extends { maxTokens: number; contextSize: number }>(settings: T, limit = UNKNOWN_CONTEXT_LIMIT): T {
  const contextSize = validTokenValue(settings.contextSize, MIN_CONTEXT_TOKENS, Number.MAX_SAFE_INTEGER)
    ? Math.min(settings.contextSize, limit) : Math.min(2048, limit);
  const maxTokens = validTokenValue(settings.maxTokens, 1, Number.MAX_SAFE_INTEGER)
    ? Math.max(MIN_REPLY_TOKENS, Math.min(settings.maxTokens, replyLimit(contextSize))) : Math.min(384, replyLimit(contextSize));
  return { ...settings, contextSize, maxTokens };
}

/** Reduce the ceiling per turn so a large requested reply never crowds out input. */
export function availableReplyTokens(contextSize: number, inputTokens: number, requested: number) {
  return Math.max(0, Math.min(requested, contextSize - inputTokens - CONTEXT_RESERVE));
}
