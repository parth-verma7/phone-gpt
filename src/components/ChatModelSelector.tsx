import { useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { getInstalledModelPath, getModelDownloadState, models, type ModelDefinition } from '../services/models';
import { useAppTheme } from '../theme/AppTheme';

export function ChatModelSelector({ open, onClose, onSelect, loadedModelId }: {
  open: boolean;
  onClose: () => void;
  onSelect: (model: ModelDefinition) => Promise<void>;
  loadedModelId?: string;
}) {
  const { colors } = useAppTheme();
  const [installed, setInstalled] = useState<ModelDefinition[]>([]);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!open) return;
    let active = true;
    setChecking(true);
    setError(false);
    setInstalled([]);
    void Promise.allSettled(models.map(async (model) => {
      const state = await getModelDownloadState(model);
      if (['pending', 'running', 'paused', 'failed'].includes(state.status)) return null;
      return await getInstalledModelPath(model) ? model : null;
    })).then((results) => {
      if (!active) return;
      setInstalled(results.flatMap((result) => result.status === 'fulfilled' && result.value ? [result.value] : []));
      setError(results.some((result) => result.status === 'rejected'));
      setChecking(false);
    });
    return () => { active = false; };
  }, [open]);

  if (!open) return null;
  return <View style={{ marginHorizontal: 16, marginVertical: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.surface, padding: 12 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 14, fontWeight: '700' }}>Downloaded models</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close model selector" onPress={onClose} style={{ minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' }}><Text style={{ color: colors.secondary, fontSize: 24 }}>×</Text></Pressable>
    </View>
    {checking ? <Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, paddingVertical: 8 }}>Checking downloaded models…</Text> : <>
      <ScrollView style={{ maxHeight: 220 }} keyboardShouldPersistTaps="handled">
        {installed.map((model) => <Pressable key={model.id} accessibilityRole="button" accessibilityState={{ selected: loadedModelId === model.id }} accessibilityLabel={`Use ${model.displayName}`} onPress={() => { onClose(); void onSelect(model); }} style={{ padding: 12, minHeight: 48, borderRadius: 8, backgroundColor: loadedModelId === model.id ? colors.raised : colors.surface }}>
          <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>{model.displayName}{loadedModelId === model.id ? ' · Loaded' : ''}</Text>
        </Pressable>)}
      </ScrollView>
      {!installed.length && !error && <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20 }}>No downloaded models yet. Download one from Menu → Models.</Text>}
      {error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13 }}>Some models could not be checked. Close and reopen this list to retry.</Text>}
    </>}
  </View>;
}
