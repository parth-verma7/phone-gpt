import { ScaledText as Text } from './ScaledText';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AppState, Pressable, View } from 'react-native';
import { cancelModelDownload, deleteInstalledModel, downloadModel, formatBytes, getInstalledModelPath, getModelDownloadState, ModelDownloadCancelledError, type ModelDownloadState } from '../services/models';
import { voiceModels, type VoiceModel } from '../services/voice';
import { useAppTheme } from '../theme/AppTheme';
import { VOICE_TRANSCRIPTION_MODE } from '../config/voice';
import { DownloadControls } from './DownloadControls';
import { ActionButton } from './UiKit';
import { ProviderGroup } from './ProviderGroup';

export function VoiceModels({ selectedId, onSelect, disabled }: {
  selectedId: string | null; onSelect: (id: string | null) => Promise<void>; disabled: boolean;
}) {
  const { colors } = useAppTheme();
  return <ProviderGroup name="Voice" count={voiceModels.length}>
    <Text style={{ color: colors.secondary, fontSize: 13 }}>{VOICE_TRANSCRIPTION_MODE === 'live' ? 'English speech → text · live dictation on your phone.' : 'English speech → text · transcribed locally after you stop.'}</Text>
    {voiceModels.map((model) => <VoiceModelCard key={model.id} model={model} selected={selectedId === model.id} onSelect={onSelect} disabled={disabled} />)}
  </ProviderGroup>;
}

function VoiceModelCard({ model, selected, onSelect, disabled }: {
  model: VoiceModel; selected: boolean; onSelect: (id: string | null) => Promise<void>; disabled: boolean;
}) {
  const { colors } = useAppTheme();
  const [state, setState] = useState<ModelDownloadState>({ status: 'none', progress: 0 });
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const operation = useRef(false);
  const alive = useRef(true);
  const refresh = useCallback(async () => {
    try {
      const next = await getModelDownloadState(model);
      if (next.status === 'none') {
        const path = await getInstalledModelPath(model);
        if (path) { next.status = 'completed'; next.uri = path; next.progress = 1; }
      }
      if (alive.current) setState(next);
    } catch (error) {
      if (alive.current) setState({ status: 'failed', progress: 0, error: error instanceof Error ? error.message : 'Could not check download.' });
    } finally { if (alive.current) setChecking(false); }
  }, [model]);
  useEffect(() => {
    alive.current = true;
    void refresh();
    const timer = setInterval(() => { if (AppState.currentState === 'active' && !operation.current) void refresh(); }, 2000);
    return () => { alive.current = false; clearInterval(timer); };
  }, [refresh]);
  const run = async (task: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setBusy(true);
    try { await task(); }
    catch (error) {
      if (!(error instanceof ModelDownloadCancelledError) && alive.current) Alert.alert('Voice model', error instanceof Error ? error.message : 'Please try again.');
    } finally { operation.current = false; if (alive.current) { setBusy(false); await refresh(); } }
  };
  const downloading = ['pending', 'running', 'paused'].includes(state.status);
  return <View style={{ padding: 14, borderWidth: 1, borderColor: selected && state.status === 'completed' ? colors.primary : colors.border, borderRadius: 16, gap: 12, backgroundColor: colors.surface }}>
    <Text style={{ color: colors.text, fontWeight: '700', fontSize: 15 }}>{model.displayName}{selected && state.status === 'completed' ? ' · Selected for voice' : ''}</Text>
    <Text style={{ color: colors.secondary, fontSize: 13 }}>English · Speech → Text · {formatBytes(model.sizeBytes)}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
      {checking ? <Text style={{ color: colors.secondary }}>Checking…</Text> : downloading ? <View style={{ width: '100%' }}><DownloadControls model={model} state={state} onState={setState} /></View> : state.status === 'completed' ? <>
        <ActionButton label={selected ? 'Selected for voice' : 'Use for voice typing'} icon={selected ? 'check' : 'chat'} onPress={() => { void run(async () => {
          if (!await getInstalledModelPath(model)) throw new Error('Model file is missing. Download it again.');
          await onSelect(model.id);
        }); }} disabled={disabled || busy || selected} />
        <ActionButton label="Delete" danger icon="trash" onPress={() => { void run(async () => { if (selected) await onSelect(null); await deleteInstalledModel(model); }); }} disabled={disabled || busy} />
      </> : <ActionButton label={`Download · ${formatBytes(model.sizeBytes)}`} icon="download" onPress={() => { void run(async () => {
        await downloadModel(model, (progress) => { if (alive.current) setState({ status: 'running', progress }); }, (next) => { if (alive.current) setState(next); });
      }); }} disabled={busy || disabled} /> }
      {state.status === 'failed' && state.canPause && <ActionButton label="Discard download" danger icon="trash" disabled={busy} onPress={() => { void run(async () => { await cancelModelDownload(model); }); }} />}
    </View>
    {state.error && <Text style={{ color: colors.error, fontSize: 12 }}>{state.error}</Text>}
  </View>;
}
