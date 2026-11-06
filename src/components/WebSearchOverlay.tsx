import { ActivityIndicator, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useAppTheme } from '../theme/AppTheme';

/** App-owned status; does not intercept scrolling, typing or the Stop button. */
export function WebSearchOverlay({ visible }: { visible: boolean }) {
  const { colors } = useAppTheme();
  if (!visible) return null;
  return <View pointerEvents="none" style={[{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 }, { alignItems: 'center', justifyContent: 'center', padding: 24 }]}>
    <View accessibilityRole="progressbar" accessibilityLabel="Searching the web" accessibilityState={{ busy: true }} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <ActivityIndicator color={colors.primary} />
      <Text accessibilityLiveRegion="polite" style={{ color: colors.text, fontSize: 14, fontWeight: '600', flexShrink: 1 }}>Searching the web…</Text>
    </View>
  </View>;
}
