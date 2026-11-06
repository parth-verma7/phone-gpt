import { useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Platform, Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { plainChatPreview } from '../services/chatPreview';
import { searchChats, highlightMatches, type SearchableChat } from '../services/chatSearch';
import { AppIcon } from './AppIcon';
import { PhoneGptLogo } from './PhoneGptLogo';
import { ScaledText as Text, ScaledTextInput } from './ScaledText';
import { ActionButton } from './UiKit';

export function ChatsScreen<T extends SearchableChat & { modelId?: string }>({ chats, ready, busy, activeChatId, onSelect, onNewChat, onModels, onExport, onDelete, version, modelName }: {
  chats: T[]; ready: boolean; busy: boolean; activeChatId?: string; onSelect: (chat: T) => void; onNewChat: () => void; onModels: () => void; onExport: () => void; onDelete: (chat: T) => Promise<void>; version: string; modelName: (id?: string) => string | undefined;
}) {
  const { colors, isDark } = useAppTheme();
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [selected, setSelected] = useState(new Set<string>());
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const phase = useRef<'idle' | 'confirming' | 'deleting'>('idle');
  const busyRef = useRef(busy); busyRef.current = busy;
  const selectedChats = chats.filter(chat => selected.has(chat.id));
  const changeQuery = (text: string) => { setQuery(text); setSelected(new Set()); setDeleteError(''); };
  const toggleSelected = (id: string) => setSelected(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  const requestDelete = () => {
    if (busy || deleting || phase.current !== 'idle' || !selectedChats.length) return;
    phase.current = 'confirming';
    const release = () => { if (phase.current === 'confirming') phase.current = 'idle'; };
    const confirm = async () => {
      if (phase.current !== 'confirming') return;
      if (busyRef.current) { release(); return; }
      phase.current = 'deleting'; setDeleting(true); setDeleteError('');
      try {
        for (const chat of selectedChats) await onDelete(chat);
        setSelected(new Set()); setEditing(false);
      } catch { setDeleteError('Some chats could not be deleted. Review the remaining selection and try again.'); }
      finally { phase.current = 'idle'; setDeleting(false); }
    };
    const message = `Delete ${selectedChats.length} selected conversation${selectedChats.length === 1 ? '' : 's'} and their local attachments? This cannot be undone.`;
    try {
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || typeof window.confirm !== 'function') { release(); setDeleteError('Confirmation is unavailable. Please try again.'); return; }
        if (window.confirm(message)) void confirm(); else release();
      } else Alert.alert('Delete conversations?', message, [{ text: 'Cancel', style: 'cancel', onPress: release }, { text: 'Delete', style: 'destructive', onPress: () => { void confirm(); } }], { cancelable: true, onDismiss: release });
    } catch { release(); setDeleteError('Could not confirm deletion. Please try again.'); }
  };
  const results = useMemo(() => searchChats(chats, query), [chats, query]);
  const highlighted = (text: string) => highlightMatches(plainChatPreview(text), query).map((part, index) => <Text key={index} style={part.match ? { color: colors.onPrimary, backgroundColor: colors.primary, fontWeight: '700' } : undefined}>{part.text}</Text>);
  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 18 }}><PhoneGptLogo size={28} /><Text style={{ color: colors.text, fontSize: 23, fontWeight: '700', flex: 1 }}>PhoneGPT</Text><AppIcon name="shield" color={colors.secondary} size={14} /><Text style={{ color: colors.secondary, fontSize: 11 }}>On-device AI</Text></View>
    <View style={{ paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 30, fontWeight: '700', flex: 1 }}>Chats</Text><Pressable accessibilityRole="button" accessibilityLabel={editing ? 'Done editing chats' : 'Edit chats'} disabled={busy || deleting || !ready || !chats.length} onPress={() => { if (phase.current !== 'idle') return; setEditing(!editing); setSelected(new Set()); setDeleteError(''); }} style={{ minHeight: 44, paddingHorizontal: 10, justifyContent: 'center', opacity: busy || !ready || !chats.length ? 0.4 : 1 }}><Text style={{ color: colors.primary, fontSize: 14, fontWeight: '600' }}>{editing ? 'Done' : 'Edit'}</Text></Pressable>{!editing && <ActionButton label="New chat" icon="plus" disabled={busy || !ready} onPress={onNewChat} />}</View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 20, marginBottom: 12 }}><View style={{ flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 12, borderRadius: 13, backgroundColor: colors.raised }}><AppIcon name="search" size={18} color={colors.secondary} /><ScaledTextInput accessibilityLabel="Search conversations" placeholder="Search your conversations" placeholderTextColor={colors.muted} keyboardAppearance={isDark ? 'dark' : 'light'} autoCapitalize="none" autoCorrect={false} value={query} onChangeText={changeQuery} editable={!deleting} style={{ flex: 1, minWidth: 0, minHeight: 46, color: colors.text, fontSize: 14 }} />{query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear chat search" onPress={() => changeQuery('')} disabled={deleting} style={{ width: 36, height: 44, justifyContent: 'center', alignItems: 'center' }}><AppIcon name="close" size={18} color={colors.secondary} /></Pressable>}</View><Pressable accessibilityRole="button" accessibilityLabel="Export chat history" disabled={busy || !ready || !chats.length} accessibilityState={{ disabled: busy || !ready || !chats.length }} onPress={onExport} style={{ minHeight: 46, minWidth: 44, alignItems: 'center', justifyContent: 'center', opacity: busy || !ready || !chats.length ? 0.35 : 1 }}><AppIcon name="export" color={colors.primary} size={22} /></Pressable></View>
    {editing && <View style={{ paddingHorizontal: 20, paddingBottom: 12, gap: 8 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}><Pressable accessibilityRole="checkbox" accessibilityLabel={query ? 'Select all matching chats' : 'Select all chats'} accessibilityState={{ checked: !!results.length && results.every(item => selected.has(item.chat.id)), disabled: busy || deleting }} disabled={busy || deleting || !results.length} onPress={() => setSelected(results.every(item => selected.has(item.chat.id)) ? new Set() : new Set(results.map(item => item.chat.id)))} style={{ minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, backgroundColor: colors.raised, borderRadius: 10 }}><Text style={{ color: colors.primary, fontSize: 13 }}>{results.length && results.every(item => selected.has(item.chat.id)) ? 'Deselect all' : 'Select all'}</Text></Pressable><Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 12, flex: 1 }}>{selectedChats.length} selected</Text><ActionButton label="Delete selected" danger disabled={busy || !selectedChats.length} busy={deleting} onPress={requestDelete} /></View>{deleteError && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{deleteError}</Text>}</View>}
    {busy && <Text accessibilityLiveRegion="polite" style={{ paddingHorizontal: 20, paddingBottom: 10, color: colors.secondary, fontSize: 12 }}>Finish the current task before starting or switching chats.</Text>}
    {!ready ? <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.secondary }}>Loading your chats…</Text></View> : <FlatList data={results} keyExtractor={item => item.chat.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={12} windowSize={7} contentContainerStyle={{ flexGrow: 1, paddingBottom: 16 }}
      ListEmptyComponent={<View style={{ flex: 1, justifyContent: 'center', padding: 30, gap: 14, alignItems: 'center' }}><AppIcon name={query ? 'search' : 'chat'} color={colors.primary} size={36} /><Text style={{ color: colors.text, fontSize: 23, fontWeight: '700', textAlign: 'center' }}>{query ? 'No matching chats' : 'A little AI. All yours.'}</Text><Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center' }}>{query ? 'Try another word from a title or message.' : 'Download a model, then start a conversation. Your chats stay on this device.'}</Text>{!query && <View style={{ alignSelf: 'center' }}><ActionButton label="Explore models" icon="models" onPress={onModels} /></View>}<Text style={{ color: colors.muted, fontSize: 11 }}>PhoneGPT {version}</Text></View>}
      renderItem={({ item }) => {
        const disabled = deleting || (busy && (editing || activeChatId !== item.chat.id));
        const last = item.chat.messages[item.chat.messages.length - 1];
        const preview = query ? item.snippet : last?.content.trim().replace(/\s+/g, ' ') || last?.attachments?.[0]?.name || 'Start a conversation';
        const model = modelName(item.chat.modelId);
        return <View style={{ flexDirection: 'row', alignItems: 'center', paddingRight: 12 }}><Pressable accessibilityRole={editing ? "checkbox" : "button"} accessibilityLabel={`${editing ? 'Select chat' : 'Open chat'}: ${item.title}, ${item.date}, ${item.time}`} disabled={disabled} accessibilityState={{ disabled, ...(editing ? { checked: selected.has(item.chat.id) } : {}) }} onPress={() => editing ? toggleSelected(item.chat.id) : onSelect(item.chat)} style={({ pressed }) => ({ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: 20, paddingRight: 5, paddingVertical: 16, backgroundColor: pressed ? colors.raised : 'transparent', opacity: disabled ? 0.5 : 1 })}>
          <View style={{ width: 44, height: 44, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised }}><AppIcon name={editing && selected.has(item.chat.id) ? "check" : "chat"} size={22} color={colors.primary} /></View>
          <View style={{ flex: 1, minWidth: 0, gap: 5 }}><View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Text numberOfLines={1} style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '600' }}>{highlighted(item.title)}</Text><View style={{ alignItems: 'flex-end', gap: 2 }}><Text style={{ color: colors.muted, fontSize: 10 }}>{item.date}</Text><Text style={{ color: colors.muted, fontSize: 10 }}>{item.time}</Text></View></View><Text numberOfLines={1} style={{ color: colors.secondary, fontSize: 13 }}>{highlighted(preview)}</Text>{model && <Text numberOfLines={1} style={{ color: colors.muted, fontSize: 11 }}>Last used · {model}</Text>}</View>
        </Pressable></View>;
      }} ItemSeparatorComponent={() => <View style={{ height: 1, marginLeft: 76, marginRight: 20, backgroundColor: colors.border }} />} />}
  </View>;
}
