import { ScaledText as Text, ScaledTextInput as TextInput } from './ScaledText';
import { SettingsCard, ActionButton } from './UiKit';
import type { useSystemPromptSettings } from '../hooks/useSystemPromptSettings';
import { useAppTheme } from '../theme/AppTheme';

export function SystemPromptSettings({ settings }: { settings: ReturnType<typeof useSystemPromptSettings> }) {
  const { colors, isDark } = useAppTheme();
  return <SettingsCard title="System prompt" icon="chat" description="Set how your model responds in new conversations.">
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
    <ActionButton label={settings.saving ? 'Saving…' : 'Save instructions'} icon="check" busy={settings.saving} disabled={!settings.ready} onPress={() => { void settings.save(); }} />
    {!!settings.notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.success, fontSize: 12 }}>{settings.notice}</Text>}
    {!!settings.error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{settings.error}</Text>}
  </SettingsCard>;
}
