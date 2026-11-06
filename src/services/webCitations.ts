import type { WebSearchProvenance } from './webSearchTypes';

// Locate balanced Markdown labels/destinations without interpreting their contents.
function balancedEnd(text: string, start: number, open: string, close: string): number {
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '\\') { i++; continue; }
    if (text[i] === open) depth++;
    else if (text[i] === close && --depth === 0) return i + 1;
  }
  return -1;
}

/** Source cards provide attribution; preserve code/data and links when stripping prose citations. */
export function validateWebCitationMarkers(text: string, _provenance: WebSearchProvenance): string {
  const references = new Set(Array.from(text.matchAll(/^ {0,3}\[([^\]\n]+)\]:[ \t]*\S.*$/gm), match => match[1].trim().toLowerCase()));
  const removals: { start: number; end: number }[] = [];
  for (let i = 0; i < text.length;) {
    if (i === 0 || text[i - 1] === '\n') {
      const lineEnd = text.indexOf('\n', i);
      const end = lineEnd < 0 ? text.length : lineEnd + 1;
      const line = text.slice(i, end);
      const fence = /^ {0,3}(`{3,}|~{3,})/.exec(line);
      if (fence) {
        const close = new RegExp(`^ {0,3}${fence[1][0]}{${fence[1].length},}[ \\t]*\\r?$`, 'gm');
        close.lastIndex = end;
        const match = close.exec(text);
        i = match ? match.index + match[0].length : text.length;
        continue;
      }
      if (/^(?: {4}|\t)/.test(line) || /^ {0,3}\[[^\]\n]+\]:/.test(line)) { i = end; continue; }
    }
    if (text[i] === '\\') { i += 2; continue; }
    if (text[i] === '`') {
      const run = /^`+/.exec(text.slice(i))![0];
      const ticks = /`+/g;
      ticks.lastIndex = i + run.length;
      let match: RegExpExecArray | null;
      let end = text.length;
      while ((match = ticks.exec(text))) {
        if (match[0].length === run.length) { end = ticks.lastIndex; break; }
      }
      // Also protect an unfinished code span during streaming.
      i = end;
      continue;
    }
    if (text[i] !== '[') { i++; continue; }
    const labelEnd = balancedEnd(text, i, '[', ']');
    if (labelEnd < 0) { i++; continue; }
    const label = text.slice(i + 1, labelEnd - 1);
    if (text[labelEnd] === '(') {
      const end = balancedEnd(text, labelEnd, '(', ')');
      i = end < 0 ? text.length : end;
      continue;
    }
    if (text[labelEnd] === '[') {
      const end = balancedEnd(text, labelEnd, '[', ']');
      if (end > 0) {
        const reference = text.slice(labelEnd + 1, end - 1).trim().toLowerCase();
        // Adjacent numeric citations are ambiguous with reference links; a
        // numeric reference definition resolves that ambiguity in favor of links.
        if (!/^\d{1,3}$/.test(reference) || references.has(reference)) { i = end; continue; }
      }
    }
    if (!/^\d{1,3}$/.test(label) || references.has(label.toLowerCase())) { i = labelEnd; continue; }
    // Prefer preserving possible subscripts over guessing at unspaced citations.
    const previous = removals[removals.length - 1];
    const followsCitation = previous && previous.end >= i;
    if (!followsCitation && (/[\p{L}_$\])]/u.test(text[i - 1] || '') || /[\p{L}_$][\p{L}\p{N}_$]*$/u.test(text.slice(0, i)))) { i = labelEnd; continue; }
    let start = i;
    let end = labelEnd;
    while (start > 0 && /[ \t]/.test(text[start - 1])) start--;
    while (end < text.length && /[ \t]/.test(text[end])) end++;
    if (previous && start <= previous.end) previous.end = end;
    else removals.push({ start, end });
    i = labelEnd;
  }
  let result = '';
  let cursor = 0;
  for (const { start, end } of removals) {
    result += text.slice(cursor, start);
    const left = text[start - 1];
    const right = text[end];
    if (left && right && left !== '\n' && left !== '\r' && right !== '\n' && right !== '\r' && !/[([{]/.test(left) && !/[.,;:!?\])}]/.test(right) && /[ \t]/.test(text.slice(start, end))) result += ' ';
    cursor = end;
  }
  return result + text.slice(cursor);
}
