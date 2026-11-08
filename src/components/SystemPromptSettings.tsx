import { useState } from 'react';
import { Alert, Pressable, View } from 'react-native';
import { DEFAULT_SYSTEM_PROMPT } from '../config/systemPrompt';
import { ScaledText as Text, ScaledTextInput as TextInput } from './ScaledText';
import { SettingsCard, ActionButton } from './UiKit';
import type { useSystemPromptSettings } from '../hooks/useSystemPromptSettings';
import { useAppTheme } from '../theme/AppTheme';

export function SystemPromptSettings({ settings }: { settings: ReturnType<typeof useSystemPromptSettings> }) {
  const { colors, isDark } = useAppTheme();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const choose = (text: string) => {
    if (settings.draft !== settings.savedPrompt && settings.draft !== text) {
      Alert.alert('Replace unsaved edits?', 'Your saved versions will remain available.', [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Replace', onPress: () => settings.setDraft(text) },
      ]);
    } else settings.setDraft(text);
  };
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
    <Text style={{ color: colors.secondary, fontSize: 12 }}>Edit and save to use these instructions in new chats. Saving an empty box restores the default.</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 }}>
    <ActionButton label={settings.saving ? 'Saving…' : 'Save'} icon="check" busy={settings.saving} disabled={!settings.ready || settings.draft.trim() === settings.savedPrompt} onPress={() => { void settings.save(); }} />
    <ActionButton label="Restore default" secondary disabled={!settings.ready || settings.saving} onPress={() => choose(DEFAULT_SYSTEM_PROMPT)} />
    <ActionButton label={`${historyOpen ? 'Hide history' : 'History'} (${settings.versions.length})`} secondary onPress={() => setHistoryOpen(!historyOpen)} />
    </View>
    {historyOpen && <View style={{ gap: 12 }}>
      <Text style={{ color: colors.secondary, fontSize: 12 }}>The original default is always available, plus up to 50 saved versions within available history space. Choose a version, then save to use it in new chats. Existing chats keep their instructions.</Text>
      <View style={{ padding: 12, gap: 8, backgroundColor: colors.raised, borderRadius: 12 }}>
        <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>PhoneGPT original default · Always available</Text>
        <Text selectable style={{ color: colors.secondary, fontSize: 13 }}>{DEFAULT_SYSTEM_PROMPT}</Text>
        <ActionButton label="Use original default" secondary disabled={!settings.ready || settings.saving} onPress={() => choose(DEFAULT_SYSTEM_PROMPT)} />
      </View>
      {!settings.versions.length && <Text style={{ color: colors.muted, fontSize: 12 }}>Your versions will appear here after you change and save instructions.</Text>}
      {settings.versions.map((version, index) => <View key={version.id} style={{ padding: 12, gap: 8, backgroundColor: colors.raised, borderRadius: 12 }}>
        <Pressable accessibilityRole="button" accessibilityState={{ expanded: previewId === version.id }} accessibilityLabel={`Preview prompt version ${settings.versions.length - index}`} onPress={() => setPreviewId(previewId === version.id ? null : version.id)} style={{ minHeight: 44, gap: 6 }}>
          <Text style={{ color: colors.text, fontSize: 13, fontWeight: '600' }}>Version {settings.versions.length - index} · {new Date(version.savedAt).toLocaleString()}</Text>
          <Text numberOfLines={previewId === version.id ? undefined : 2} style={{ color: colors.secondary, fontSize: 13 }}>{version.text}</Text>
        </Pressable>
        <ActionButton label="Remove version" secondary disabled={!settings.ready || settings.saving} onPress={() => Alert.alert('Remove saved version?', 'This removes only this history entry. Active instructions and existing chats stay unchanged.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: () => { void settings.removeVersion(version.id); } }])} />
        <ActionButton label="Use this prompt" secondary disabled={!settings.ready || settings.saving} onPress={() => choose(version.text)} />
      </View>)}
    </View>}
    {!!settings.notice && <Text accessibilityLiveRegion="polite" style={{ color: colors.success, fontSize: 12 }}>{settings.notice}</Text>}
    {!!settings.error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{settings.error}</Text>}
  </SettingsCard>;
}
