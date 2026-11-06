import { Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { THEME_OPTIONS } from '../theme/themeColors';
import { CONTROL } from '../theme/controlStyles';
import { ScaledText as Text } from './ScaledText';

export function ThemeColorSettings() {
  const { colors, accent, setAccent, ready } = useAppTheme();
  return <View style={{ gap: 10 }}>
    <Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Theme color</Text>
    <View accessibilityRole="radiogroup" accessibilityLabel="Theme color" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {THEME_OPTIONS.map(option => <Pressable key={option.id} accessibilityRole="radio" accessibilityLabel={`${option.label} theme`} accessibilityState={{ checked: accent === option.id, disabled: !ready }} disabled={!ready} onPress={() => setAccent(option.id)} style={({ pressed }) => ({ minHeight: CONTROL.height, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: CONTROL.radius, borderWidth: 1, borderColor: accent === option.id ? colors.primary : colors.border, backgroundColor: colors.raised, opacity: !ready ? 0.5 : pressed ? 0.7 : 1 })}>
        <View style={{ width: 18, height: 18, borderRadius: 9, backgroundColor: option.swatch, borderWidth: 1, borderColor: '#64748B' }} />
        <Text style={{ color: colors.text, ...CONTROL.label }}>{option.label}{accent === option.id ? ' ✓' : ''}</Text>
      </Pressable>)}
    </View>
    <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>Applies across PhoneGPT in light and dark mode.</Text>
  </View>;
}
