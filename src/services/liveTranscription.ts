import type { WhisperContext } from 'whisper.rn/index';
import { LIVE_TRANSCRIPTION_INTERVAL_MS } from '../config/voice';
import type { Recorder, VoiceSnapshot } from './voice';

// Fixed-size overlapping windows bound inference cost as the recording grows.
const WINDOW_SAMPLES = 12 * 16000;
const OVERLAP_SAMPLES = 1 * 16000;
const MIN_SAMPLES = 0.3 * 16000;

export function joinOverlappingTranscript(previous: string, next: string) {
  const left = previous.trim(); const right = next.trim();
  if (!left) return right;
  if (!right) return left;
  const a = left.split(/\s+/); const b = right.split(/\s+/);
  const normalize = (word: string) => word.toLowerCase().replace(/[^a-z0-9']/g, '');
  for (let size = Math.min(a.length, b.length, 24); size > 0; size--) {
    if (a.slice(-size).every((word, index) => normalize(word) !== '' && normalize(word) === normalize(b[index]))) {
      return [left, ...b.slice(size)].join(' ');
    }
  }
  return `${left} ${right}`;
}

export class LiveTranscription {
  private offset = 0;
  private lastEnd = -1;
  private committed = '';
  private cancelled = false;
  private timer?: ReturnType<typeof setInterval>;
  private pending?: Promise<void>;
  private abort?: () => Promise<void>;

  constructor(private options: {
    context: WhisperContext;
    recorder: Recorder;
    uri: string;
    onText: (text: string) => void;
    onError: (error: unknown) => void;
    removeFile: (uri: string) => Promise<unknown>;
  }) {}

  start() {
    this.timer = setInterval(() => {
      // Coalesce ticks while busy, rather than queueing concurrent jobs.
      if (this.pending || this.cancelled) return;
      const job = this.process(false);
      this.pending = job;
      void job.catch((error) => { if (!this.cancelled) this.options.onError(error); })
        .finally(() => { if (this.pending === job) this.pending = undefined; });
    }, LIVE_TRANSCRIPTION_INTERVAL_MS);
  }

  private async process(final: boolean) {
    while (!this.cancelled) {
      const snapshot: VoiceSnapshot = await this.options.recorder.snapshot!(this.options.uri, this.offset, WINDOW_SAMPLES);
      try {
        if (this.cancelled) return;
        if (!snapshot.uri || snapshot.sampleCount < MIN_SAMPLES || snapshot.endSample === this.lastEnd) return;
        this.lastEnd = snapshot.endSample;
        let text = '';
        if (snapshot.hasSpeech) {
          const task = this.options.context.transcribe(snapshot.uri, {
            language: 'en', translate: false, maxThreads: 4, temperature: 0,
            prompt: this.committed.slice(-600) || undefined,
          });
          this.abort = task.stop;
          const result = await task.promise;
          this.abort = undefined;
          if (this.cancelled || result.isAborted) return;
          text = result.result.trim();
        }
        if (this.cancelled) return;
        const combined = joinOverlappingTranscript(this.committed, text);
        if (combined) this.options.onText(combined);
        if (snapshot.sampleCount < WINDOW_SAMPLES) return;
        this.committed = combined;
        this.offset = snapshot.endSample - OVERLAP_SAMPLES;
        // At most one window per live tick. Stop drains all remaining audio.
        if (!final) return;
      } finally {
        if (snapshot.uri) await this.options.removeFile(snapshot.uri).catch(() => undefined);
      }
    }
  }

  async finish() {
    clearInterval(this.timer);
    await this.pending;
    if (this.cancelled) return;
    const job = this.process(true);
    this.pending = job;
    try { await job; } finally { if (this.pending === job) this.pending = undefined; }
  }

  async cancel() {
    this.cancelled = true;
    clearInterval(this.timer);
    await this.abort?.().catch(() => undefined);
    await this.pending?.catch(() => undefined);
  }
}
