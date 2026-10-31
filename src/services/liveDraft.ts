/** Own only the dictated range; preserve edits before/after it. Editing inside
 * that range freezes those words and allows subsequent speech to append. */
export class LiveDraftEditor {
  private session = '';
  private range: { start: number; end: number } | null = null;
  private transcript = '';
  private protectedWords = 0;

  edit(previous: string, next: string) {
    if (!this.range || previous === next) return;
    let start = 0;
    while (start < previous.length && start < next.length && previous[start] === next[start]) start++;
    let suffix = 0;
    while (suffix < previous.length - start && suffix < next.length - start && previous[previous.length - 1 - suffix] === next[next.length - 1 - suffix]) suffix++;
    const end = previous.length - suffix;
    if (end <= this.range.start) {
      const shift = next.length - previous.length;
      this.range.start += shift; this.range.end += shift;
    } else if (start < this.range.end) {
      this.protectedWords = this.transcript.match(/\S+/g)?.length ?? 0;
      this.range = null;
    }
  }

  update(draft: string, session: string, transcript: string) {
    if (session !== this.session) {
      this.session = session; this.range = null; this.protectedWords = 0;
    }
    this.transcript = transcript;
    const words = [...transcript.matchAll(/\S+/g)];
    const text = this.protectedWords ? transcript.slice(words[this.protectedWords]?.index ?? transcript.length).trim() : transcript.trim();
    if (this.range) {
      const next = draft.slice(0, this.range.start) + text + draft.slice(this.range.end);
      this.range.end = this.range.start + text.length;
      return next;
    }
    if (!text) return draft;
    const separator = draft && !/\s$/.test(draft) ? ' ' : '';
    this.range = { start: draft.length + separator.length, end: draft.length + separator.length + text.length };
    return draft + separator + text;
  }
}
