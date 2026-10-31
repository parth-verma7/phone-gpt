import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, DeviceEventEmitter } from 'react-native';
import type { WhisperContext } from 'whisper.rn/index';
import { getInstalledModelPath, getModelDownloadState } from '../services/models';
import { createVoiceContext, getVoiceRecorder, requestMicrophonePermission, voiceModels, type Recorder } from '../services/voice';
import { VOICE_TRANSCRIPTION_MODE, type VoiceTranscriptionMode } from '../config/voice';
import { LiveTranscription } from '../services/liveTranscription';

const KEY = '@phone-gpt/voice-model';
type Status = 'idle' | 'starting' | 'recording' | 'transcribing' | 'cancelling';
type Session = { chatKey: string; cancelled: boolean; recorder: Recorder; uri?: string; context?: WhisperContext; stop?: () => Promise<void>; live?: LiveTranscription; liveId: string };

export function useVoiceTyping(chatKey: string, onTranscript: (text: string, liveId?: string) => void, mode: VoiceTranscriptionMode = VOICE_TRANSCRIPTION_MODE) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<Status>('idle');
  const [progress, setProgress] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const session = useRef<Session | null>(null);
  const sessionSequence = useRef(0);
  const mounted = useRef(true);
  const onText = useRef(onTranscript);
  onText.current = onTranscript;
  const latestChatKey = useRef(chatKey);
  latestChatKey.current = chatKey;
  const model = voiceModels.find((item) => item.id === selectedId);
  const phase = useRef<Status>('idle');
  useEffect(() => {
    setAudioLevel(0);
    if (status !== 'recording') return;
    let lastSample = 0;
    const subscription = DeviceEventEmitter.addListener('PhoneGptAudioLevel', (event: { level?: number }) => {
      if (phase.current !== 'recording') return;
      const level = event?.level;
      if (typeof level !== 'number' || !Number.isFinite(level)) return;
      lastSample = Date.now();
      setAudioLevel(Math.max(0, Math.min(1, level)));
    });
    const timer = setInterval(() => {
      if (Date.now() - lastSample > 350) setAudioLevel(0);
    }, 100);
    return () => { subscription.remove(); clearInterval(timer); };
  }, [status]);
  const changeStatus = useCallback((next: Status) => { phase.current = next; if (mounted.current) setStatus(next); }, []);
  const clear = useCallback(async (current: Session) => {
    await current.live?.cancel();
    if (current.context) await current.context.release().catch(() => undefined);
    if (current.uri) await FileSystem.deleteAsync(current.uri, { idempotent: true }).catch(() => undefined);
    if (session.current === current) { session.current = null; changeStatus('idle'); }
  }, [changeStatus]);

  useEffect(() => {
    void AsyncStorage.getItem(KEY).then((value) => {
      if (mounted.current && voiceModels.some((item) => item.id === value)) setSelectedId(value);
    }).catch(() => undefined).finally(() => { if (mounted.current) setReady(true); });
  }, []);

  const select = async (id: string | null) => {
    if (session.current || !ready) return;
    if (id) await AsyncStorage.setItem(KEY, id); else await AsyncStorage.removeItem(KEY);
    setSelectedId(id);
  };

  const cancel = useCallback(async () => {
    const current = session.current;
    if (!current || current.cancelled) return;
    current.cancelled = true;
    const previous = phase.current;
    changeStatus('cancelling');
    await current.recorder.cancel().catch(() => undefined);
    await current.stop?.().catch(() => undefined);
    await current.live?.cancel();
    // Starting/transcribing operations own their cleanup; do not release a
    // context while its native transcription or initialization is running.
    if (previous === 'recording') await clear(current);
  }, [changeStatus, clear]);

  const stop = useCallback(async () => {
    const current = session.current;
    if (!current || current.cancelled || phase.current !== 'recording') return;
    changeStatus('transcribing'); setProgress(0);
    try {
      current.uri = await current.recorder.stop();
      if (current.cancelled) return;
      if (current.live) {
        await current.live.finish();
        return;
      }
      // Kept intact for the 'recording' feature-flag mode.
      if (!model) throw new Error('Choose a voice model in Models → Voice.');
      const path = await getInstalledModelPath(model);
      if (!path) throw new Error('Your voice model is missing. Download it again from Models → Voice.');
      current.context = await createVoiceContext(path);
      if (current.cancelled) return;
      const task = current.context.transcribe(current.uri, {
        language: 'en', translate: false, maxThreads: 4, temperature: 0,
        onProgress: (value) => { if (!current.cancelled && mounted.current) setProgress(Math.max(0, Math.min(100, value))); },
      });
      current.stop = task.stop;
      const result = await task.promise;
      if (!current.cancelled && mounted.current && latestChatKey.current === current.chatKey && !result.isAborted) {
        const text = result.result.trim();
        if (text) onText.current(text);
        else Alert.alert('No speech detected', 'Please try recording again.');
      }
    } catch (error) {
      if (!current.cancelled && mounted.current) Alert.alert('Voice typing failed', error instanceof Error ? error.message : 'Please try again.');
    } finally { await clear(current); }
  }, [model, changeStatus, clear]);

  const start = async () => {
    if (session.current || !ready) return;
    if (!model) { Alert.alert('Choose a voice model', 'Download and select an English model in Models → Voice first.'); return; }
    let current: Session;
    try { current = { chatKey, cancelled: false, recorder: getVoiceRecorder(), liveId: `${Date.now()}-${++sessionSequence.current}` }; }
    catch (error) { Alert.alert('Voice typing unavailable', (error as Error).message); return; }
    session.current = current; changeStatus('starting');
    try {
      const state = await getModelDownloadState(model);
      const path = await getInstalledModelPath(model);
      if (['pending', 'running', 'paused', 'failed'].includes(state.status) || !path) {
        throw new Error('Download this voice model completely in Models → Voice first.');
      }
      if (current.cancelled) { await clear(current); return; }
      await requestMicrophonePermission();
      if (current.cancelled || AppState.currentState !== 'active') { await clear(current); return; }
      if (mode === 'live') {
        if (typeof current.recorder.snapshot !== 'function') throw new Error('Install the updated PhoneGPT live transcription APK first.');
        current.context = await createVoiceContext(path);
        if (current.cancelled || AppState.currentState !== 'active') { await clear(current); return; }
      }
      current.uri = await current.recorder.start();
      if (current.cancelled) { await current.recorder.cancel(); await clear(current); return; }
      changeStatus('recording');
      if (mode === 'live' && current.context) {
        current.live = new LiveTranscription({
          context: current.context, recorder: current.recorder, uri: current.uri,
          onText: (text) => {
            if (!current.cancelled && mounted.current && latestChatKey.current === current.chatKey) onText.current(text, current.liveId);
          },
          onError: (error) => {
            if (!current.cancelled && mounted.current) Alert.alert('Live transcription failed', error instanceof Error ? error.message : 'Please try again.');
            void cancel();
          },
          removeFile: (uri) => FileSystem.deleteAsync(uri, { idempotent: true }),
        });
        current.live.start();
      }
    } catch (error) {
      await current.recorder.cancel().catch(() => undefined);
      if (!current.cancelled && mounted.current) Alert.alert('Could not record', error instanceof Error ? error.message : 'Please try again.');
      await clear(current);
    }
  };

  useEffect(() => { void cancel(); }, [chatKey, cancel]);
  useEffect(() => {
    mounted.current = true;
    const subscription = AppState.addEventListener('change', (state) => {
      // Android's permission dialog can temporarily background the Activity.
      if (state !== 'active' && phase.current !== 'starting') void cancel();
    });
    return () => { mounted.current = false; subscription.remove(); void cancel(); };
  }, [cancel]);

  return { model, selectedId, select, ready, status, progress, audioLevel, mode, busy: status !== 'idle', isActive: () => session.current !== null, start, stop, cancel };
}
