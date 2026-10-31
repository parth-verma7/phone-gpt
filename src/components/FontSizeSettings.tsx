import { SettingsCard } from './UiKit';
import { Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { FONT_SCALE_PRESETS, useFontScale } from '../theme/FontScale';
import { ScaledText as Text } from './ScaledText';

export function FontSizeSettings() {
  const { colors } = useAppTheme();
  const { fontScale, setFontScale, ready, error } = useFontScale();
  return <SettingsCard title="Text size" icon="text" description="Make PhoneGPT comfortable to read. Applies across the app.">
    <View accessibilityRole="radiogroup" accessibilityLabel="Text size" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {FONT_SCALE_PRESETS.map((scale) => {
        const selected = fontScale === scale;
        return <Pressable
          key={scale}
          accessibilityRole="radio"
          accessibilityLabel={`Font size ${Math.round(scale * 100)} percent`}
          accessibilityState={{ checked: selected, disabled: !ready }}
          disabled={!ready}
          onPress={() => setFontScale(scale)}
          style={{ minWidth: 52, minHeight: 44, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: selected ? colors.primary : colors.raised, opacity: ready ? 1 : 0.5 }}
        >
          <Text style={{ color: selected ? colors.onPrimary : colors.text, fontSize: 14, fontWeight: '600' }}>{scale === 1 ? 'Default' : `${scale}×`}</Text>
        </Pressable>;
      })}
    </View>
    {error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{error}</Text>}
  </SettingsCard>;
}
