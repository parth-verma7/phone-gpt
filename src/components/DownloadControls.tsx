import { useRef, useState } from 'react';
import { Alert, View } from 'react-native';
import { pauseModelDownload, resumeModelDownload, cancelModelDownload, type DownloadableModel, type ModelDownloadState } from '../services/models';
import { ScaledText as Text } from './ScaledText';
import { useAppTheme } from '../theme/AppTheme';
import { ActionButton, DownloadStatus } from './UiKit';

export function DownloadControls({ model, state, onState, onCancel }: {
  model: DownloadableModel; state: ModelDownloadState; onState: (state: ModelDownloadState) => void; onCancel?: () => Promise<void>;
}) {
  const { colors } = useAppTheme();
  const [action, setAction] = useState<'pause' | 'resume' | 'cancel' | null>(null);
  const busy = action !== null;
  const operation = useRef(false);
  const manual = state.status === 'paused' && state.pauseReason === 'manual';
  const label = manual ? 'Paused by you' : state.pauseReason === 'network' ? 'No internet' : state.status === 'paused' ? 'Waiting to retry' : 'Downloading';
  const run = async (kind: 'pause' | 'resume' | 'cancel', task: () => Promise<void>) => {
    if (operation.current) return;
    operation.current = true; setAction(kind);
    try { await task(); }
    catch (error) { Alert.alert('Model download', error instanceof Error ? error.message : 'Please try again.'); }
    finally { operation.current = false; setAction(null); }
  };
  return <View style={{ gap: 12 }}>
    <DownloadStatus progress={state.progress} label={label} />
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {state.canPause && <ActionButton secondary label={action === 'pause' ? 'Pausing…' : action === 'resume' ? 'Resuming…' : manual ? 'Resume' : 'Pause'} busy={action === 'pause' || action === 'resume'} icon={manual ? 'play' : 'pause'} disabled={busy} onPress={() => { void run(manual ? 'resume' : 'pause', async () => { onState(await (manual ? resumeModelDownload(model) : pauseModelDownload(model))); }); }} />}
      <ActionButton danger label={action === 'cancel' ? 'Cancelling…' : 'Cancel'} busy={action === 'cancel'} icon="close" disabled={busy} onPress={() => { void run('cancel', async () => {
        if (onCancel) await onCancel();
        else if (await cancelModelDownload(model)) onState({ status: 'none', progress: 0 });
      }); }} />
    </View>
    {state.canPause === false && <Text style={{ color: colors.muted, fontSize: 11, lineHeight: 17 }}>Older transfer · finish or restart it to enable Pause.</Text>}
  </View>;
}
