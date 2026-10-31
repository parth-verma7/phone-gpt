import { View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';

export function AudioLevelMeter({ level }: { level: number }) {
  const { colors } = useAppTheme();
  const volume = Number.isFinite(level) ? Math.max(0, Math.min(1, level)) : 0;
  return <View accessible accessibilityRole="progressbar" accessibilityLabel="Microphone sound level" accessibilityValue={{ min: 0, max: 100, now: Math.round(volume * 100) }} style={{ width: 48, height: 24, flexShrink: 0, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
    {volume > 0.02 && [0.45, 0.75, 1, 0.75, 0.45].map((scale, index) => <View key={index} style={{ width: 4, height: Math.max(3, Math.round(volume * 24 * scale)), borderRadius: 2, backgroundColor: colors.primary }} />)}
  </View>;
}
