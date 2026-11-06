// Change to 'recording' to restore record-then-transcribe without deleting it.
export type VoiceTranscriptionMode = 'live' | 'recording';
export const VOICE_TRANSCRIPTION_MODE: VoiceTranscriptionMode = 'live';
// Native recorders expose WAV snapshots, not push notifications with sample
// counts. Only wait when a snapshot lacks enough new audio; never after decode.
export const LIVE_TRANSCRIPTION_READINESS_MS = 200;
