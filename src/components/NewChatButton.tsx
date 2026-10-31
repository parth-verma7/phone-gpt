import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { AppIcon } from './AppIcon';
import { ScaledText as Text } from './ScaledText';
import { useAppTheme } from '../theme/AppTheme';

export function NewChatButton({ onPress, disabled }: { onPress: () => void; disabled: boolean }) {
  const { colors } = useAppTheme();
  const [hint, setHint] = useState(false);
  return <View style={{ position: 'relative', marginLeft: 8 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Start a new chat" accessibilityHint="Opens an empty conversation" accessibilityState={{ disabled }} disabled={disabled}
      onHoverIn={() => setHint(true)} onHoverOut={() => setHint(false)} onFocus={() => setHint(true)} onBlur={() => setHint(false)} onLongPress={() => setHint(true)} onPressOut={() => setHint(false)}
      onPress={() => { setHint(false); onPress(); }}
      style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.raised, opacity: disabled ? 0.4 : pressed ? 0.65 : 1 })}>
      <AppIcon name="plus" color={colors.primary} />
    </Pressable>
    {hint && <View pointerEvents="none" style={{ position: 'absolute', right: 0, top: 46, minWidth: 140, padding: 9, borderRadius: 8, backgroundColor: colors.text, zIndex: 10 }}><Text style={{ color: colors.background, fontSize: 12 }}>Start a new chat</Text></View>}
  </View>;
}
