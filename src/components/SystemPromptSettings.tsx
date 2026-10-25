import { Pressable, Text, TextInput, View } from 'react-native';
import type { useSystemPromptSettings } from '../hooks/useSystemPromptSettings';
import { useAppTheme } from '../theme/AppTheme';

export function SystemPromptSettings({ settings }: { settings: ReturnType<typeof useSystemPromptSettings> }) {
  const { colors, isDark } = useAppTheme();
  return <View style={{ marginTop: 24, gap: 10 }}>
    <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>System Prompt</Text>
    <TextInput
      accessibilityLabel="System Prompt"
      placeholder="Your instructions for the model."
      placeholderTextColor={colors.muted}
      multiline
      textAlignVertical="top"
      keyboardAppearance={isDark ? 'dark' : 'light'}
      value={settings.draft}
      onChangeText={settings.setDraft}
      editable={settings.ready && !settings.saving}
      style={{ minHeight: 130, maxHeight: 260, color: colors.text, backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, lineHeight: 22 }}
    />
    <Text style={{ color: colors.secondary, fontSize: 12 }}>Used privately in new chats. Leave blank for the default.</Text>
    <Pressable accessibilityRole="button" disabled={!settings.ready || settings.saving} onPress={() => { void settings.save(); }} style={{ alignSelf: 'flex-start', paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10, backgroundColor: colors.primary, opacity: settings.ready && !settings.saving ? 1 : 0.5 }}>
      <Text style={{ color: colors.onPrimary, fontSize: 14, fontWeight: '700' }}>{settings.saving ? 'Saving…' : 'Save'}</Text>
    </Pressable>
    {!!settings.notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.success, fontSize: 12 }}>{settings.notice}</Text>}
    {!!settings.error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{settings.error}</Text>}
  </View>;
}
