import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, FlatList, Keyboard, KeyboardAvoidingView, Modal,
  Platform, Pressable, StyleSheet, TextInput, View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme/AppTheme';
import { highlightMatches, searchChats, type SearchableChat, type SearchResult } from '../services/chatSearch';
import { DeleteChatButton } from './DeleteChatButton';
import { AppIcon } from './AppIcon';
import { ScaledText as Text, ScaledTextInput } from './ScaledText';

export type ChatHistorySearchProps<T extends SearchableChat = SearchableChat> = {
  open: boolean;
  onClose: () => void;
  onSelect: (chat: T) => void;
  chats: readonly T[];
  onDelete?: (chat: T) => Promise<void>;
  deletingDisabled?: boolean;
};

export function ChatHistorySearch<T extends SearchableChat>({ open, onClose, onSelect, chats, onDelete, deletingDisabled = false }: ChatHistorySearchProps<T>) {
  const { colors, isDark } = useAppTheme();
  const [query, setQuery] = useState('');
  const [visible, setVisible] = useState(open);
  const progress = useRef(new Animated.Value(0)).current;
  const input = useRef<TextInput>(null);
  const list = useRef<FlatList<SearchResult<T>>>(null);
  const results = useMemo(() => searchChats(chats, query), [chats, query]);

  useEffect(() => {
    if (open) {
      setVisible(true);
      setQuery('');
    } else if (input.current) {
      input.current?.blur();
      Keyboard.dismiss();
    }
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (!finished) return;
      if (open) input.current?.focus();
      else setVisible(false);
    });
    return () => animation.stop();
  }, [open, progress]);

  useEffect(() => {
    if (open) list.current?.scrollToOffset({ offset: 0, animated: false });
  }, [query, open]);

  const close = useCallback(() => {
    input.current?.blur();
    Keyboard.dismiss();
    onClose();
  }, [onClose]);

  function highlighted(text: string) {
    return highlightMatches(text, query).map((part, index) => (
      <Text key={index} style={part.match ? { backgroundColor: colors.primary, color: colors.onPrimary, fontWeight: '700' } : undefined}>{part.text}</Text>
    ));
  }

  return <Modal
    visible={open || visible}
    animationType="none"
    presentationStyle="fullScreen"
    onRequestClose={close}
    onShow={() => { if (open) input.current?.focus(); }}
  >
    <Animated.View accessibilityViewIsModal style={[styles.fill, {
      backgroundColor: colors.background,
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [36, 0] }) }],
    }]}>
      <SafeAreaView style={styles.fill} edges={['top', 'bottom', 'left', 'right']}>
        <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <View style={styles.header}>
            <Text accessibilityRole="header" style={[styles.heading, { color: colors.text }]}>Search chats</Text>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close chat search" style={styles.control}>
              <AppIcon name="close" color={colors.text} />
            </Pressable>
          </View>
          <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <ScaledTextInput
              ref={input}
              value={query}
              onChangeText={setQuery}
              accessibilityLabel="Search saved chats"
              placeholder="Search titles and messages"
              placeholderTextColor={colors.muted}
              selectionColor={colors.primary}
              keyboardAppearance={isDark ? 'dark' : 'light'}
              autoCorrect={false}
              autoCapitalize="none"
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
              style={[styles.input, { color: colors.text }]}
            />
            {query.length > 0 && <Pressable accessibilityRole="button" accessibilityLabel="Clear search" style={styles.control} onPress={() => { setQuery(''); input.current?.focus(); }}>
              <AppIcon name="close" color={colors.secondary} size={18} />
            </Pressable>}
          </View>
          <Text accessibilityLiveRegion="polite" style={[styles.count, { color: colors.muted }]}>
            {results.length} {results.length === 1 ? 'conversation' : 'conversations'} · Newest started first
          </Text>
          <FlatList
            ref={list}
            data={results}
            keyExtractor={(item) => item.chat.id}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            initialNumToRender={12}
            maxToRenderPerBatch={12}
            windowSize={7}
            contentContainerStyle={styles.results}
            renderItem={({ item }) => <View style={[styles.result, { backgroundColor: colors.surface, borderColor: colors.border, flexDirection: 'row', alignItems: 'flex-start' }]}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${item.title}, ${item.date}, ${item.time}${item.snippet ? `, ${item.snippet}` : ''}`}
                onPress={() => { close(); onSelect(item.chat); }}
                style={({ pressed }) => ({ flex: 1, minWidth: 0, gap: 7, opacity: pressed ? 0.7 : 1 })}
              >
                <Text style={[styles.title, { color: colors.text }]}>{highlighted(item.title)}</Text>
                <Text style={[styles.date, { color: colors.muted }]}>{item.date} · {item.time}</Text>
                {!!item.snippet && <Text style={[styles.snippet, { color: colors.secondary }]}>{highlighted(item.snippet)}</Text>}
              </Pressable>
              {onDelete && <DeleteChatButton chatTitle={item.title} disabled={deletingDisabled} onConfirm={() => onDelete(item.chat)} />}
            </View>}
            ListEmptyComponent={<View style={styles.empty}>
              <AppIcon name="chat" color={colors.muted} size={32} />
              <Text style={[styles.title, { color: colors.text }]}>{query ? 'No matching conversations' : 'No saved chats yet'}</Text>
              <Text style={[styles.snippet, { color: colors.secondary }]}>{query ? 'Try another word or clear your search.' : 'Your saved conversations will appear here.'}</Text>
            </View>}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  </Modal>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingLeft: 20, paddingRight: 12, paddingVertical: 12, gap: 12 },
  heading: { flex: 1, fontSize: 24, fontWeight: '800' },
  control: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' },
  search: { marginHorizontal: 20, borderRadius: 16, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minWidth: 0, minHeight: 52, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  count: { fontSize: 12, lineHeight: 18, marginHorizontal: 20, marginVertical: 14 },
  results: { paddingHorizontal: 20, paddingBottom: 20, flexGrow: 1, gap: 10 },
  result: { padding: 16, gap: 7, borderWidth: 1, borderRadius: 16 },
  title: { fontSize: 16, lineHeight: 23, fontWeight: '700' },
  date: { fontSize: 12, lineHeight: 18 },
  snippet: { fontSize: 14, lineHeight: 21 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 40, gap: 12 },
});
