import { useAppTheme, type ThemeColors } from '../theme/AppTheme';
import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ModelDefinition } from '../services/models';

export function groupModelsByProvider(models: ModelDefinition[]) {
  const groups = new Map<string, ModelDefinition[]>();
  for (const model of models) {
    const identity = `${model.id} ${model.displayName} ${model.provider}`.toLowerCase();
    const name = identity.includes('deepseek') ? 'DeepSeek'
      : identity.includes('qwen') ? 'Qwen'
      : identity.includes('llama') ? 'LLaMA'
      : identity.includes('gemma') ? 'Gemma'
      : identity.includes('smollm') ? 'SmolLM' : model.provider;
    const group = groups.get(name) ?? [];
    group.push(model);
    groups.set(name, group);
  }
  return [...groups].map(([name, models]) => ({ name, models }));
}

export function ProviderGroup({ name, count, initiallyExpanded, children }: {
  name: string; count: number; initiallyExpanded: boolean; children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [expanded, setExpanded] = useState(initiallyExpanded);
  return <View style={styles.group}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${name}, ${count} ${count === 1 ? 'model' : 'models'}`} accessibilityState={{ expanded }} onPress={() => setExpanded((value) => !value)} style={styles.header}>
      <Text style={styles.name}>{name}</Text>
      <Text style={styles.count}>{count} {count === 1 ? 'model' : 'models'}</Text>
      <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
    </Pressable>
    {expanded && <View style={styles.models}>{children}</View>}
  </View>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  group: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16, backgroundColor: colors.surface, minHeight: 56 },
  name: { flex: 1, color: colors.text, fontSize: 17, fontWeight: '700' },
  count: { color: colors.secondary, fontSize: 12 },
  chevron: { color: colors.secondary, fontSize: 12 },
  models: { padding: 10, gap: 10 },
});
