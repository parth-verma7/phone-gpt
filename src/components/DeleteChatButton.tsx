import { useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { AppIcon } from './AppIcon';
import { ScaledText as Text } from './ScaledText';

export type DeleteChatButtonProps = {
  onConfirm: () => void | Promise<void>;
  chatTitle: string;
  disabled?: boolean;
};

export function DeleteChatButton({ onConfirm, chatTitle, disabled = false }: DeleteChatButtonProps) {
  const { colors } = useAppTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const phase = useRef<'idle' | 'confirming' | 'deleting'>('idle');
  const latest = useRef({ onConfirm, disabled });
  latest.current = { onConfirm, disabled };

  function releaseConfirmation() {
    if (phase.current !== 'confirming') return;
    phase.current = 'idle';
    setBusy(false);
  }

  async function confirm() {
    if (phase.current !== 'confirming') return;
    if (latest.current.disabled) { releaseConfirmation(); return; }
    phase.current = 'deleting';
    try {
      await latest.current.onConfirm();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message || 'Could not delete the conversation. Please try again.' : 'Could not delete the conversation. Please try again.');
    } finally {
      phase.current = 'idle';
      setBusy(false);
    }
  }

  function requestDeletion() {
    if (latest.current.disabled || phase.current !== 'idle') return;
    phase.current = 'confirming';
    setBusy(true);
    setError(null);
    const message = `Delete “${chatTitle}” and its local attachments? This cannot be undone.`;
    try {
      // React Native Web's Alert is a no-op; use the browser's confirmation there.
      if (Platform.OS === 'web') {
        if (typeof window === 'undefined' || typeof window.confirm !== 'function') {
          throw new Error('Confirmation is unavailable. Please try again in the app or a browser.');
        }
        if (window.confirm(`Delete chat?\n\n${message}`)) void confirm();
        else releaseConfirmation();
      } else {
        Alert.alert('Delete chat?', message, [
          { text: 'Cancel', style: 'cancel', onPress: releaseConfirmation },
          { text: 'Delete', style: 'destructive', onPress: () => { void confirm(); } },
        ], { cancelable: true, onDismiss: releaseConfirmation });
      }
    } catch (cause) {
      releaseConfirmation();
      setError(cause instanceof Error ? cause.message : 'Could not confirm deletion. Please try again.');
    }
  }

  return <View>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Delete conversation"
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={requestDeletion}
      style={({ pressed }) => [styles.button, {
        backgroundColor: pressed ? colors.errorSurface : 'transparent',
        opacity: disabled || busy ? 0.5 : 1,
      }]}
    >
      <AppIcon name="trash" color={colors.error} size={20} />
    </Pressable>
    {error && <Text accessibilityRole="alert" accessibilityLiveRegion="polite" style={{ color: colors.error, fontSize: 12 }}>{error}</Text>}
  </View>;
}

const styles = StyleSheet.create({
  button: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
