import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { AppIcon } from './AppIcon';
import { ScaledText as Text } from './ScaledText';

export type SearchDecisionState = 'checking' | 'search' | 'local' | 'limited';

/** App-authored routing summary; never displays the router's raw model output. */
export function SearchDecision({ decision, active = false }: { decision: SearchDecisionState; active?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { colors } = useAppTheme();
  const checking = decision === 'checking' && active;
  const title = checking ? 'Checking whether to search…' : decision === 'search' ? 'Web search chosen' : decision === 'limited' ? 'Web search limit reached' : decision === 'local' ? 'Continuing without search' : 'Search check interrupted';
  const detail = checking ? 'Deciding whether this question needs web information.' : decision === 'search' ? 'Web information will be used to help answer this question.' : decision === 'limited' ? 'No web information was fetched. Continuing with an on-device answer.' : decision === 'local' ? 'Continuing with the on-device model without a web lookup.' : 'The search check did not finish. You can send your question again.';
  return <View style={{ alignSelf: 'flex-start', maxWidth: '100%', marginBottom: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ expanded, busy: checking }} onPress={() => setExpanded(value => !value)} style={{ minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      {checking && <ActivityIndicator color={colors.primary} size="small" />}
      <Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 12, flexShrink: 1 }}>{title}</Text>
      <View style={{ transform: [{ rotate: expanded ? '180deg' : '0deg' }] }}><AppIcon name="chevron" size={15} color={colors.secondary} /></View>
    </Pressable>
    {expanded && <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18, paddingHorizontal: 12, paddingBottom: 12 }}>{detail}</Text>}
  </View>;
}
