import { NativeModules, PermissionsAndroid, Platform, TurboModuleRegistry } from 'react-native';
import type { WhisperContext } from 'whisper.rn/index';
import voiceCatalog from '../data/voiceModels.json';

export const voiceModels = voiceCatalog;
export type VoiceModel = (typeof voiceModels)[number];
export type VoiceSnapshot = { uri: string | null; sampleCount: number; endSample: number; hasSpeech: boolean };
export type Recorder = {
  start(): Promise<string>; stop(): Promise<string>; cancel(): Promise<boolean>;
  snapshot?(uri: string, startSample: number, maxSamples: number): Promise<VoiceSnapshot>;
};

export function getVoiceRecorder(): Recorder {
  if (Platform.OS !== 'android') throw new Error('Voice typing is currently available in the Android PhoneGPT build.');
  if (!NativeModules.PhoneGptRecorder || !TurboModuleRegistry.get('RNWhisper')) {
    throw new Error('Install the new PhoneGPT voice APK. The currently installed build does not include the microphone and Whisper runtime.');
  }
  return NativeModules.PhoneGptRecorder as Recorder;
}

export async function requestMicrophonePermission() {
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

export function appendTranscript(draft: string, transcript: string) {
  const text = transcript.trim();
  if (!text) return draft;
  return draft.trimEnd() ? `${draft.trimEnd()} ${text}` : text;
}
