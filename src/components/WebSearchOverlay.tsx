import { ActivityIndicator, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useAppTheme } from '../theme/AppTheme';
import { AppIcon } from './AppIcon';

/** Compact inline activity; never covers messages, typing or Stop. */
export function WebSearchOverlay({ visible }: { visible: boolean }) {
  const { colors } = useAppTheme();
  if (!visible) return null;
  return <View pointerEvents="none" style={{ alignSelf: 'flex-start', maxWidth: '100%', marginBottom: 12 }}>
    <View accessibilityRole="progressbar" accessibilityLabel="Searching the web" accessibilityState={{ busy: true }} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }}>
      <AppIcon name="search" size={15} color={colors.secondary} />
      <Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 12, flexShrink: 1 }}>Searching the web…</Text>
      <ActivityIndicator color={colors.primary} size="small" />
    </View>
  </View>;
}
