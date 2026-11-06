/** A conservative preview formatter, not a full Markdown parser or HTML sanitizer.
 * Keeps code and escaped punctuation literal; unsupported/ambiguous markup stays
 * readable as written. Returns one whitespace-normalized line, without clipping.
 */
export function plainChatPreview(text: string): string {
  // Choose a sentinel absent from the input so user text cannot become a token.
  let sentinel = '\u0000preview';
  while (text.includes(sentinel)) sentinel += 'x';
  const literals: string[] = [];
  const protect = (value: string): string => {
    const token = `${sentinel}${literals.length}\u0000`;
    literals.push(value);
    return token;
  };

  let fence: { character: string; length: number } | undefined;
  const lines = text.replace(/\r\n?/g, '\n').split('\n').map((line) => {
    if (fence) {
      const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
      if (closing && closing[1][0] === fence.character && closing[1].length >= fence.length) {
        fence = undefined;
        return '';
      }
      return protect(line);
    }
    // Four-space/tab indents are code: list/heading syntax inside is literal.
    if (/^(?: {4}|\t)/.test(line)) return protect(line);
    let value = line.replace(/^ {0,3}(?:>[ \t]?)+/, '');
    if (/^ {0,3}(?:(?:\*[ \t]*){3,}|(?:-[ \t]*){3,}|(?:_[ \t]*){3,}|={3,}[ \t]*)$/.test(value)) return '';
    value = value.replace(/^ {0,3}(?:[-+*]|\d+[.)])[ \t]+/, '');
    value = value.replace(/^\[[ xX]\][ \t]+/, '');
    const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(value);
    if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
      fence = { character: opening[1][0], length: opening[1].length };
      return '';
    }
    value = value.replace(/^ {0,3}#{1,6}(?:[ \t]+|$)/, '');
    if (/^ {0,3}#{1,6}[ \t]+/.test(line)) value = value.replace(/[ \t]+#+[ \t]*$/, '');
    return value;
  });

  // Protect inline code before interpreting links or emphasis. Exact-length
  // backtick runs may enclose shorter runs, as in ``use ` here``.
  let value = lines.join('\n');
  let scanned = '';
  for (let i = 0; i < value.length;) {
    if (value[i] === '\\' && /[!"#$%&'()*+,\-./:;<=>?@[\]\\^_`{|}~]/.test(value[i + 1] ?? '')) {
      scanned += protect(value[i + 1]);
      i += 2;
    } else if (value[i] === '`') {
      let end = i + 1;
      while (value[end] === '`') end++;
      const run = value.slice(i, end);
      let close = value.indexOf(run, end);
      while (close !== -1 && (value[close - 1] === '`' || value[close + run.length] === '`')) {
        close = value.indexOf(run, close + run.length);
      }
      if (close === -1) {
        scanned += protect(run);
        i = end;
      } else {
        scanned += protect(value.slice(end, close));
        i = close + run.length;
      }
    } else {
      scanned += value[i++];
    }
  }

  // Inline links/images: balanced brackets and parentheses retain the label,
  // including nested emphasis. Incomplete links are left intact.
  value = '';
  for (let i = 0; i < scanned.length;) {
    const start = scanned[i] === '!' && scanned[i + 1] === '[' ? i + 1 : i;
    if (scanned[start] === '[') {
      let end = start + 1;
      let depth = 1;
      for (; end < scanned.length && depth; end++) {
        if (scanned[end] === '[') depth++;
        if (scanned[end] === ']') depth--;
      }
      if (depth) {
        value += scanned.slice(i);
        break;
      }
      if (!depth && scanned[end] === '(') {
        let destinationEnd = end + 1;
        depth = 1;
        let quote = '';
        for (; destinationEnd < scanned.length && depth; destinationEnd++) {
          const character = scanned[destinationEnd];
          if (quote) {
            if (character === quote) quote = '';
          } else if ((character === '"' || character === "'") && /\s/.test(scanned[destinationEnd - 1])) quote = character;
          else if (character === '(') depth++;
          else if (character === ')') depth--;
        }
        if (!depth) {
          value += scanned.slice(start + 1, end - 1);
          i = destinationEnd;
          continue;
        }
      }
    }
    value += scanned[i++];
  }

  // Require non-word outer boundaries and non-space inner edges. This leaves
  // multiplication, identifiers, unmatched delimiters and spaced stars alone.
  for (let pass = 0; pass < 3; pass++) {
    value = value.replace(/(^|[^\p{L}\p{N}_*])\*{3}(\S(?:[^*]*?\S)?)\*{3}(?=$|[^\p{L}\p{N}_*])/gu, '$1$2');
    value = value.replace(/(^|[^\p{L}\p{N}_*])\*{2}(\S(?:[^*]*?\S)?)\*{2}(?=$|[^\p{L}\p{N}_*])/gu, '$1$2');
    value = value.replace(/(^|[^\p{L}\p{N}_*])\*([^*\s](?:[^*]*?[^*\s])?)\*(?=$|[^\p{L}\p{N}_])/gu, '$1$2');
    value = value.replace(/(^|[^\p{L}\p{N}_])(_{1,3})([^_\s](?:[^_]*?[^_\s])?)\2(?=$|[^\p{L}\p{N}_])/gu, '$1$3');
    value = value.replace(/(^|[^~])~~([^~\s](?:[^~]*?[^~\s])?)~~(?=$|[^~])/g, '$1$2');
  }
  // Split/join avoids interpreting either user code or replacement '$' syntax.
  for (let i = literals.length - 1; i >= 0; i--) {
    value = value.split(`${sentinel}${i}\u0000`).join(literals[i]);
  }
  return value.replace(/\s+/g, ' ').trim();
}
