import type { ReactNode } from 'react';
import { ScrollView, Switch, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { SettingsCard } from './UiKit';
import { FontSizeSettings } from './FontSizeSettings';
import { SystemPromptSettings } from './SystemPromptSettings';
import type { useSystemPromptSettings } from '../hooks/useSystemPromptSettings';
import { ScaledText as Text } from './ScaledText';

export function SettingsContent({ bottomInset, promptSettings, modelControls }: {
  bottomInset: number; promptSettings: ReturnType<typeof useSystemPromptSettings>; modelControls: ReactNode;
}) {
  const { colors, isDark, setDarkMode, ready } = useAppTheme();
  return <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 16, paddingBottom: Math.max(bottomInset, 24) }}>
    <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 20 }}>Your space, your preferences. Everything here is saved on this device.</Text>
    <SettingsCard title="Appearance" icon="moon">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
        <View style={{ flex: 1, gap: 5 }}><Text style={{ color: colors.text, fontSize: 14, fontWeight: '600' }}>Dark mode</Text><Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>A softer screen for quieter moments.</Text></View>
        <Switch accessibilityLabel="Dark mode" value={isDark} onValueChange={setDarkMode} disabled={!ready} trackColor={{ false: colors.track, true: colors.primary }} thumbColor={isDark ? colors.onPrimary : '#FFFFFF'} ios_backgroundColor={colors.track} />
      </View>
    </SettingsCard>
    <FontSizeSettings />
    <SystemPromptSettings settings={promptSettings} />
    <SettingsCard title="Generation" icon="settings" description="Adjust replies and memory. Larger limits use more time and phone memory.">{modelControls}</SettingsCard>
  </ScrollView>;
}
