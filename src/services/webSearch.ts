import { WEB_SEARCH_API_URL, WEB_SEARCH_FEATURE_ENABLED, WEB_SEARCH_RESULT_LIMIT } from '../config/webSearch';
import type { WebSearchResult, WebSource } from './webSearchTypes';

export type WebSearchErrorCode = 'disabled' | 'invalid_query' | 'invalid_endpoint' | 'aborted' | 'timeout' | 'network' | 'provider' | 'invalid_response' | 'context_overflow';
export class WebSearchError extends Error {
  constructor(public code: WebSearchErrorCode, message: string) { super(message); this.name = 'WebSearchError'; }
}

/** Explicit per-message choices take priority over automatic routing. */
export function forbidsWebSearch(text: string): boolean {
  return /\b(?:don't|dont|do not|never|avoid|skip|without)\s+(?:(?:use|using|a|any|the)\s+)*(?:web|internet|online)(?:\s+search)?\b|\b(?:don't|dont|do not|never)\s+(?:search|look\s+up)\b|\bno\s+(?:web|internet|online)\s+search\b/i.test(text);
}
export function explicitlyRequestsWebSearch(text: string): boolean {
  if (forbidsWebSearch(text)) return false;
  return /(?:^|[.!?]\s+)(?:(?:please|can you|could you|would you)\s+)?(?:use\s+(?:a\s+|the\s+)?(?:web|internet|online)\s+search|(?:web|internet)\s+search\b|(?:do|perform|run)\s+(?:a\s+)?(?:web|internet|online)\s+search|search\s+(?:the\s+)?(?:web|internet|online)|look\s+(?:it|this|that)\s+up\s+(?:on\s+(?:the\s+)?)?(?:web|internet|online))|\b(?:using|with)\s+(?:a\s+|the\s+)?(?:web|internet|online)\s+search\b/i.test(text.trim());
}

/** Deterministic requests bypass the small model; ambiguous queries use its routing prompt. */
export function classifyWebQuery(text: string): 'search' | 'local' | 'ask-model' {
  const q = text.toLowerCase().trim();
  if (!q) return 'ask-model';
  if (forbidsWebSearch(q)) return 'local';
  if (explicitlyRequestsWebSearch(q)) return 'search';
  // Definitions remain local even when they contain words such as current/president.
  if (/\b(define|definition of|meaning of|what does .+ mean)\b/.test(q) || /^(?:explain|what is|what are|how does) (?:an? |the )?electric(?:al)? current\??$/.test(q) || /^(?:what is|calculate|solve)\s+[\d\s.+*/()%^-]+\??$/.test(q)) return 'local';
  const office = '(?:prime minister|president|chief minister|governor|chancellor|monarch|king|queen|ceo|chief executive|mayor)';
  if (new RegExp('\\b(?:who|name|identify|list)\\b.{0,100}\\b' + office + '\\b').test(q)
    || new RegExp('\\b' + office + '\\b.{0,80}\\b(?:in|during)\\s+\\d{4}\\b').test(q)) return 'search';
  if (/\b(latest|newest|today|tonight|tomorrow|yesterday|recent|currently|right now|up[- ]to[- ]date|this (?:week|month|year)|breaking news|live (?:score|price|weather|ceo)|current (?:prices?|rates?|news|weather|events?|president|ceo|version|stock|exchange))\b/.test(q) || /\b(weather|forecast|stock price|exchange rate|news headlines|election results|sports scores?)\b/.test(q)) return 'search';
  if (/\b(?:what|how much)\b.{0,100}\b(?:prices?|cost|population|exchange rate)\b/.test(q)) return 'search';
  return 'ask-model';
}

// Reject literal IPs except public IPv4. All IPv6 literals are rejected conservatively.
export function isPublicHttpsUrl(value: string): boolean {
  try {
    const u = new URL(value);
    if (u.protocol !== 'https:' || u.username || u.password || !u.hostname || u.hostname.endsWith('.')) return false;
    const h = u.hostname.toLowerCase();
    if (h.includes(':') || h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || !h.includes('.')) return false;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
      const [a,b,c] = h.split('.').map(Number);
      if (a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) || (a === 198 && (b === 18 || b === 19))) return false;
    }
    return true;
  } catch { return false; }
}

const MAX_RESPONSE_BYTES = 65536;
const MAX_QUERY = 500;
function bytes(s: string): number {
  let n = 0;
  for (const ch of s) { const cp = ch.codePointAt(0)!; n += cp < 128 ? 1 : cp < 2048 ? 2 : cp < 65536 ? 3 : 4; }
  return n;
}
function clean(s: string, max: number): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max).trim();
}
function validDate(value: unknown): value is string { return typeof value === 'string' && value.length <= 40 && /^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))?$/.test(value) && Number.isFinite(Date.parse(value)); }
function normalize(data: unknown, query: string): WebSearchResult {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw new WebSearchError('invalid_response', 'Invalid search response.');
  const d = data as Record<string, unknown>;
  if (d.schemaVersion !== 1 || d.provider !== 'brave' || typeof d.requestId !== 'string' || !clean(d.requestId, 100) || typeof d.query !== 'string' || d.query !== query || !validDate(d.retrievedAt) || !Array.isArray(d.sources) || d.sources.length === 0 || d.sources.length > WEB_SEARCH_RESULT_LIMIT) throw new WebSearchError('invalid_response', 'Invalid or empty search response.');
  const sources: WebSource[] = [];
  const ids = new Set<string>();
  for (const item of d.sources) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw new WebSearchError('invalid_response', 'Invalid source.');
    const s = item as Record<string, unknown>;
    if (typeof s.id !== 'string' || typeof s.title !== 'string' || typeof s.url !== 'string' || typeof s.snippet !== 'string' || (s.publishedAt !== undefined && !validDate(s.publishedAt))) throw new WebSearchError('invalid_response', 'Invalid source.');
    const id = clean(s.id, 100), title = clean(s.title, 200), snippet = clean(s.snippet, 1200);
    if (!id || !title || !snippet || ids.has(id) || s.url.length > 2048 || !isPublicHttpsUrl(s.url)) throw new WebSearchError('invalid_response', 'Invalid source.');
    ids.add(id);
    sources.push({ id, title, url: s.url, snippet, ...(s.publishedAt === undefined ? {} : { publishedAt: s.publishedAt as string }) });
  }
  return { schemaVersion: 1, requestId: clean(d.requestId as string, 100), query, provider: 'brave', retrievedAt: d.retrievedAt as string, sources };
}

export async function searchWeb(query: string, options: { signal?: AbortSignal; endpoint?: string; enabled?: boolean } = {}): Promise<WebSearchResult> {
  if (!(options.enabled ?? WEB_SEARCH_FEATURE_ENABLED)) throw new WebSearchError('disabled', 'Web search is disabled.');
  if (options.signal?.aborted) throw new WebSearchError('aborted', 'Web search was cancelled.');
  if (typeof query !== 'string' || !query.trim() || query.length > MAX_QUERY || bytes(query) > MAX_QUERY * 4) throw new WebSearchError('invalid_query', 'Invalid search query.');
  query = query.trim();
  const base = (options.endpoint ?? WEB_SEARCH_API_URL).replace(/\/+$/, '');
  if (!isPublicHttpsUrl(base) || new URL(base).search || new URL(base).hash) throw new WebSearchError('invalid_endpoint', 'A public HTTPS search endpoint is required.');
  const controller = new AbortController();
  let timedOut = false;
  let rejectAbort: (reason: WebSearchError) => void = () => {};
  const interrupted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const abort = () => { controller.abort(); rejectAbort(new WebSearchError('aborted', 'Web search was cancelled.')); };
  options.signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(() => { timedOut = true; controller.abort(); rejectAbort(new WebSearchError('timeout', 'Web search timed out.')); }, 12000);
  try {
    const task = async () => {
      const response = await fetch(`${base}/v1/search`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' }, body: JSON.stringify({ query, limit: WEB_SEARCH_RESULT_LIMIT }), signal: controller.signal, redirect: 'error' });
      if (!response.ok) throw new WebSearchError('provider', `Search service returned HTTP ${response.status}.`);
      const length = response.headers.get('content-length');
      if (length && (!/^\d+$/.test(length) || Number(length) > MAX_RESPONSE_BYTES)) throw new WebSearchError('invalid_response', 'Search response is too large.');
      let raw: string;
      if (response.body && typeof response.body.getReader === 'function' && typeof TextDecoder !== 'undefined') {
        const reader = response.body.getReader(); const decoder = new TextDecoder(); let size = 0; raw = '';
        try { while (true) { const part = await reader.read(); if (part.done) break; size += part.value.byteLength; if (size > MAX_RESPONSE_BYTES) { void reader.cancel(); throw new WebSearchError('invalid_response', 'Search response is too large.'); } raw += decoder.decode(part.value, { stream: true }); } raw += decoder.decode(); } finally { reader.releaseLock(); }
      } else { raw = await response.text(); if (bytes(raw) > MAX_RESPONSE_BYTES) throw new WebSearchError('invalid_response', 'Search response is too large.'); }
      let data: unknown; try { data = JSON.parse(raw); } catch { throw new WebSearchError('invalid_response', 'Invalid search response JSON.'); }
      return normalize(data, query);
    };
    return await Promise.race([task(), interrupted]);
  } catch (error) {
    if (error instanceof WebSearchError) throw error;
    if (timedOut) throw new WebSearchError('timeout', 'Web search timed out.');
    if (options.signal?.aborted) throw new WebSearchError('aborted', 'Web search was cancelled.');
    throw new WebSearchError('network', 'Web search could not be completed.');
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort); }
}
