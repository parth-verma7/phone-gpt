import type { WhisperContext } from 'whisper.rn/index';
import { LIVE_TRANSCRIPTION_READINESS_MS } from '../config/voice';
import { cleanTranscript, type Recorder, type VoiceSnapshot } from './voice';

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
  private lastEnd = 0;
  private committed = '';
  private cancelled = false;
  private timer?: ReturnType<typeof setTimeout>;
  private pending?: Promise<unknown>;
  private abort?: () => Promise<void>;
  private running = false;

  constructor(private options: {
    context: WhisperContext;
    recorder: Recorder;
    uri: string;
    onText: (text: string) => void;
    onError: (error: unknown) => void;
    removeFile: (uri: string) => Promise<unknown>;
  }) {}

  start() {
    if (this.running || this.cancelled) return;
    this.running = true;
    this.scheduleReadinessCheck();
  }

  private scheduleReadinessCheck() {
    if (!this.running || this.cancelled) return;
    this.timer = setTimeout(() => { this.timer = undefined; this.run(); }, LIVE_TRANSCRIPTION_READINESS_MS);
  }

  private run() {
    if (!this.running || this.cancelled || this.pending) return;
    const job = this.process(false);
    this.pending = job;
    void job.then((advanced) => {
      if (this.pending === job) this.pending = undefined;
      if (!this.running || this.cancelled) return;
      if (advanced) this.run(); // Decode/file cleanup settled; check fresh audio now.
      else this.scheduleReadinessCheck();
    }, (error) => {
      if (this.pending === job) this.pending = undefined;
      this.running = false;
      if (!this.cancelled) this.options.onError(error);
    });
  }

  private async process(final: boolean) {
    while (!this.cancelled) {
      const snapshot: VoiceSnapshot = await this.options.recorder.snapshot!(this.options.uri, this.offset, WINDOW_SAMPLES);
      try {
        if (this.cancelled) return false;
        // Total window size alone is insufficient: overlapping windows can be
        // long while containing just a handful of samples newer than lastEnd.
        const newSamples = snapshot.endSample - this.lastEnd;
        if (!snapshot.uri || snapshot.sampleCount < MIN_SAMPLES || newSamples <= 0 || (!final && newSamples < MIN_SAMPLES)) return false;
        this.lastEnd = snapshot.endSample;
        let text = '';
        if (snapshot.hasSpeech) {
          const task = this.options.context.transcribe(snapshot.uri, {
            language: 'en', translate: false, maxThreads: 4, temperature: 0,
            prompt: this.committed.slice(-600) || undefined,
          });
          this.abort = task.stop;
          let result;
          try { result = await task.promise; } finally { this.abort = undefined; }
          if (this.cancelled || result.isAborted) return false;
          text = cleanTranscript(result.result);
        }
        if (this.cancelled) return false;
        const combined = joinOverlappingTranscript(this.committed, text);
        if (text && combined) this.options.onText(combined);
        if (snapshot.sampleCount < WINDOW_SAMPLES) return true;
        this.committed = combined;
        this.offset = snapshot.endSample - OVERLAP_SAMPLES;
        // Live work also drains ready windows, one serial job at a time.
        if (!final) return true;
      } finally {
        if (snapshot.uri) await this.options.removeFile(snapshot.uri).catch(() => undefined);
      }
    }
    return false;
  }

  async finish() {
    this.running = false;
    clearTimeout(this.timer);
    await this.pending;
    if (this.cancelled) return;
    const job = this.process(true);
    this.pending = job;
    try { await job; } finally { if (this.pending === job) this.pending = undefined; }
  }

  async cancel() {
    this.cancelled = true;
    this.running = false;
    clearTimeout(this.timer);
    await this.abort?.().catch(() => undefined);
    await this.pending?.catch(() => undefined);
  }
}
