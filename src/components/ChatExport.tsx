import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Platform, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppTheme';
import { CONTROL, controlSurface } from '../theme/controlStyles';
import { chatHistoryLabels } from '../services/chatHistory';
import type { ExportChat } from '../services/chatExport';
import { exportChatsToDevice } from '../services/chatExportDevice';
import { AppIcon } from './AppIcon';
import { ActionButton } from './UiKit';
import { ScaledText as Text } from './ScaledText';

export function ChatExport({ open, chats, onClose }: { open: boolean; chats: readonly ExportChat[]; onClose: () => void }) {
  const { colors } = useAppTheme();
  const [selected, setSelected] = useState(new Set(chats.map(chat => chat.id)));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const saving = useRef(false);
  useEffect(() => { if (open) { setSelected(new Set(chats.map(chat => chat.id))); setStatus(''); setError(''); } }, [open]);
  const chosen = chats.filter(chat => selected.has(chat.id));
  const allSelected = chats.length > 0 && chats.every(chat => selected.has(chat.id));
  const close = () => { if (!saving.current) onClose(); };
  async function save() {
    if (saving.current || !chosen.length) return;
    saving.current = true; setBusy(true); setStatus(''); setError('');
    try {
      const result = await exportChatsToDevice(chosen);
      if (result.status === 'cancelled') setStatus('Export cancelled.');
      else setStatus(`${result.status === 'saved' ? 'Saved' : 'Download started for'} ${result.count} conversation${result.count === 1 ? '' : 's'}: ${result.fileName}${result.warnings.length ? `\n${result.warnings.length} attached file(s) unavailable. See manifest.json in the ZIP.` : ''}`);
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not export chats. Please try again.'); }
    finally { saving.current = false; setBusy(false); }
  }
  return <Modal visible={open} animationType="slide" onRequestClose={close}>
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={{ padding: 16, borderBottomWidth: 1, borderColor: colors.border, gap: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Text accessibilityRole="header" style={{ flex: 1, fontSize: 20, fontWeight: '700', color: colors.text }}>Export chats</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Close chat export" disabled={busy} onPress={close} style={({ pressed }) => [controlSurface(colors, busy, pressed), { width: 44, paddingHorizontal: 0 }]}><AppIcon name="close" size={CONTROL.icon} color={colors.secondary} /></Pressable>
        </View>
        <Text style={{ fontSize: 13, lineHeight: 19, color: colors.secondary }}>Save a ZIP on your device. Each chat has text and JSON files named by its UUID, plus available attached text files.</Text>
        {Platform.OS === 'android' && <Text style={{ fontSize: 12, lineHeight: 18, color: colors.secondary }}>Choose or create a folder inside Downloads, such as PhoneGPT. Android does not allow selecting Downloads itself.</Text>}
        <Pressable accessibilityRole="checkbox" accessibilityLabel="All chats" accessibilityState={{ checked: allSelected, disabled: busy || !chats.length }} disabled={busy || !chats.length}
          onPress={() => { setSelected(allSelected ? new Set() : new Set(chats.map(chat => chat.id))); setStatus(''); }}
          style={({ pressed }) => [controlSurface(colors, busy || !chats.length, pressed), { alignSelf: 'flex-start', backgroundColor: allSelected ? colors.primary : colors.raised, borderColor: allSelected ? colors.primary : colors.border }]}>
          {allSelected && <AppIcon name="check" size={CONTROL.icon} color={colors.onPrimary} />}
          <Text style={{ ...CONTROL.label, color: allSelected ? colors.onPrimary : colors.primary }}>All chats</Text>
        </Pressable>
      </View>
      <FlatList data={chats} keyExtractor={chat => chat.id} extraData={{ selected, busy }} contentContainerStyle={{ padding: 16, gap: 8 }} ListEmptyComponent={<Text style={{ color: colors.secondary }}>No saved conversations to export.</Text>}
        renderItem={({ item }) => {
          const labels = chatHistoryLabels(item);
          const checked = selected.has(item.id);
          return <Pressable accessibilityRole="checkbox" accessibilityLabel={`${labels.title}, ${labels.date}, ${labels.time}`} accessibilityState={{ checked, disabled: busy }} disabled={busy}
            onPress={() => setSelected(current => { const next = new Set(current); if (next.has(item.id)) next.delete(item.id); else next.add(item.id); return next; })}
            style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64, borderRadius: CONTROL.radius, borderWidth: 1, borderColor: checked ? colors.primary : colors.border, backgroundColor: pressed ? colors.raised : colors.surface })}>
            <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: checked ? colors.primary : colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: checked ? colors.primary : colors.surface }}>{checked && <AppIcon name="check" size={16} color={colors.onPrimary} />}</View>
            <View style={{ flex: 1, gap: 4 }}><Text numberOfLines={1} style={{ color: colors.text, ...CONTROL.label }}>{labels.title}</Text><Text style={{ color: colors.secondary, fontSize: 11 }}>{labels.date} · {labels.time}</Text></View>
          </Pressable>;
        }} />
      <View style={{ padding: 16, borderTopWidth: 1, borderColor: colors.border, gap: 10 }}>
        {!!status && <Text selectable accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 12, lineHeight: 18 }}>{status}</Text>}
        {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{error}</Text>}
        {busy && <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><ActivityIndicator color={colors.primary} /><Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 12 }}>Preparing your export…</Text></View>}
        <ActionButton label={`Export ${chosen.length} chat${chosen.length === 1 ? '' : 's'}`} icon="export" disabled={!chosen.length || busy} busy={busy} onPress={() => { void save(); }} />
      </View>
    </SafeAreaView>
  </Modal>;
}
