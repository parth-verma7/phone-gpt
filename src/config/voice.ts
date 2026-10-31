// Change to 'recording' to restore record-then-transcribe without deleting it.
export type VoiceTranscriptionMode = 'live' | 'recording';
export const VOICE_TRANSCRIPTION_MODE: VoiceTranscriptionMode = 'live';
export const LIVE_TRANSCRIPTION_INTERVAL_MS = 1000;
