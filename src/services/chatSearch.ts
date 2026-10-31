import { chatHistoryLabels, restoreChatMetadata } from './chatHistory';

/** Structural input: callers retain their own Chat type and extra fields. */
export type SearchableChat = {
  id: string;
  title: string;
  createdAt?: number;
  updatedAt?: number;
  origin?: 'dev' | 'production';
  messages: readonly { id: string; role: string; content: string; attachments?: { name: string }[] }[];
};

export type HighlightPart = { text: string; match: boolean };
export type SearchResult<T extends SearchableChat = SearchableChat> = {
  chat: T;
  title: string;
  date: string;
  time: string;
  createdAt?: number;
  snippet: string;
};

/** Literal, non-overlapping matches with offsets into the original string.
 * Map lowercase expansion (e.g. İ) back to original UTF-16 boundaries so that
 * highlighting never slices the wrong character or splits a surrogate pair.
 */
export function findLiteralMatches(text: string, query: string): { start: number; end: number }[] {
  if (!query) return [];
  const folded = text.toLowerCase();
  const needle = query.toLowerCase();
  let index = folded.indexOf(needle);
  if (index === -1) return [];
  const starts: number[] = [];
  const ends: number[] = [];
  let offset = 0;
  for (const character of text) {
    const lower = character.toLowerCase();
    for (let i = 0; i < lower.length; i++) {
      starts.push(offset);
      ends.push(offset + character.length);
    }
    offset += character.length;
  }
  const matches: { start: number; end: number }[] = [];
  while (index !== -1) {
    const start = starts[index];
    const end = ends[index + needle.length - 1];
    const previous = matches[matches.length - 1];
    if (previous && start < previous.end) previous.end = Math.max(previous.end, end);
    else matches.push({ start, end });
    index = folded.indexOf(needle, index + needle.length);
  }
  return matches;
}

export function highlightMatches(text: string, query: string): HighlightPart[] {
  const parts: HighlightPart[] = [];
  let cursor = 0;
  for (const { start, end } of findLiteralMatches(text, query)) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false });
    parts.push({ text: text.slice(start, end), match: true });
    cursor = end;
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false });
  return parts;
}

/** Map only the first folded hit back to source boundaries, without offset arrays. */
function firstLiteralMatch(text: string, query: string): { start: number; end: number } | undefined {
  if (!query) return undefined;
  const needle = query.toLowerCase();
  const index = text.toLowerCase().indexOf(needle);
  if (index === -1) return undefined;
  const foldedEnd = index + needle.length;
  let foldedOffset = 0;
  let offset = 0;
  let start: number | undefined;
  for (const character of text) {
    const nextFoldedOffset = foldedOffset + character.toLowerCase().length;
    if (start === undefined && nextFoldedOffset > index) start = offset;
    offset += character.length;
    if (nextFoldedOffset >= foldedEnd) return { start: start ?? 0, end: offset };
    foldedOffset = nextFoldedOffset;
  }
  return undefined;
}

/** Keep the first hit visible even when it occurs deep inside a long message. */
export function searchSnippet(text: string, query: string, context = 60): string {
  const hit = firstLiteralMatch(text, query);
  let start = Math.max(0, (hit?.start ?? 0) - context);
  let end = Math.min(text.length, (hit?.end ?? 0) + context * 2);
  // Do not split emoji at the excerpt boundaries.
  if (start > 0 && /[\uDC00-\uDFFF]/.test(text[start])) start--;
  if (end < text.length && /[\uDC00-\uDFFF]/.test(text[end])) end++;
  return `${start > 0 ? '…' : ''}${text.slice(start, end)}${end < text.length ? '…' : ''}`;
}

/** Pure local search; no storage, network, mutation, or relevance reordering.
 * Only the empty string means "all"; spaces remain literal search characters.
 */
export function searchChats<T extends SearchableChat>(chats: readonly T[], query: string): SearchResult<T>[] {
  const results: SearchResult<T>[] = [];
  const needle = query.toLowerCase();
  const contains = (text: string) => text.toLowerCase().includes(needle);
  for (const chat of chats) {
    const metadata = restoreChatMetadata({ ...chat, messages: [...chat.messages] });
    const labels = chatHistoryLabels(metadata);
    const titleHit = !!query && contains(chat.title);
    const labelHit = !!query && contains(labels.title);
    const messageHit = query ? chat.messages.find((message) => contains(message.content)) : undefined;
    if (query && !titleHit && !labelHit && !messageHit) continue;
    const preview = messageHit?.content ?? (titleHit && !labelHit ? chat.title : chat.messages.find((message) => message.role === 'user')?.content ?? '');
    results.push({
      chat,
      title: titleHit ? chat.title : labels.title,
      date: labels.date,
      time: labels.time,
      createdAt: metadata.createdAt,
      snippet: searchSnippet(preview, query),
    });
  }
  // Stable ties preserve input order; missing dates follow known start times.
  return results.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));
}
