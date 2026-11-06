import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';
import type { WhisperContext } from 'whisper.rn/index';
import voiceCatalog from '../data/voiceModels.json';

export const voiceModels = voiceCatalog;
export type VoiceModel = (typeof voiceModels)[number];
export type VoiceSnapshot = { uri: string | null; sampleCount: number; endSample: number; hasSpeech: boolean };
export type Recorder = {
  start(): Promise<string>; stop(): Promise<string>; cancel(): Promise<boolean>;
  requestPermission?(): Promise<boolean>;
  addListener?(name: string, listener: (event: { level?: number }) => void): { remove(): void };
  snapshot?(uri: string, startSample: number, maxSamples: number): Promise<VoiceSnapshot>;
};

export function getVoiceRecorder(): Recorder {
  if (Platform.OS === 'ios') {
    const { requireOptionalNativeModule } = require('expo') as typeof import('expo');
    const recorder = requireOptionalNativeModule<Recorder>('PhoneGptRecorder');
    if (!recorder || !TurboModuleRegistry.get('RNWhisper')) throw new Error('Install an updated native PhoneGPT iOS build with the microphone and Whisper modules. Expo Go cannot run them.');
    return recorder;
  }
  if (Platform.OS !== 'android') throw new Error('Voice typing requires the native PhoneGPT mobile app.');
  if (!NativeModules.PhoneGptRecorder || !TurboModuleRegistry.get('RNWhisper')) {
    throw new Error('Install the new PhoneGPT voice APK. The currently installed build does not include the microphone and Whisper runtime.');
  }
  return NativeModules.PhoneGptRecorder as Recorder;
}

export async function requestMicrophonePermission() {
  if (Platform.OS === 'ios') {
    if (!await getVoiceRecorder().requestPermission?.()) throw new Error('Microphone permission was denied. Enable it in iPhone Settings → Apps → PhoneGPT → Microphone.');
    return;
  }
  const granted = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.RECORD_AUDIO, {
    title: 'Voice typing', message: 'Allow PhoneGPT to record your voice for on-device English transcription.',
    buttonPositive: 'Allow', buttonNegative: 'Cancel',
  });
  if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
    throw new Error('Microphone permission was denied. You can enable it in Android Settings → Apps → PhoneGPT → Permissions.');
  }
}

export async function createVoiceContext(path: string): Promise<WhisperContext> {
  // Lazy import: an older installed native APK must still be able to open chat.
  const { initWhisper } = require('whisper.rn/index') as typeof import('whisper.rn/index');
  return initWhisper({ filePath: path, useGpu: false, useCoreMLIos: false });
}

/** Remove known non-speech/control tokens without discarding surrounding speech
 * or arbitrary bracketed words that the user may actually have dictated. */
export function cleanTranscript(transcript: string) {
  return transcript
    .replace(/\[\s*(?:blank[\s_-]*audio|silence|silent|no[\s_-]*(?:speech|audio)|inaudible|music|applause|laughter|noise|background[\s_-]*noise)\s*\]/gi, ' ')
    .replace(/<\|(?:blank_audio|silence|nospeech|endoftext|startoftranscript|endoftranscript|notimestamps|startofprev|startoflm|en|transcribe|translate|\d+(?:\.\d+)?)\|>/gi, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function appendTranscript(draft: string, transcript: string) {
  const text = cleanTranscript(transcript);
  if (!text) return draft;
  return draft.trimEnd() ? `${draft.trimEnd()} ${text}` : text;
}
