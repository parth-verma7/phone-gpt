import { Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { AppIcon } from './AppIcon';
import { ScaledText as Text } from './ScaledText';

export type MainTab = 'home' | 'chats' | 'models' | 'settings';
export function BottomTabs({ active, bottomInset, onSelect }: { active: MainTab; bottomInset: number; onSelect: (tab: MainTab) => void }) {
  const { colors } = useAppTheme();
  return <View accessibilityRole="tablist" accessibilityLabel="Main navigation" style={{ flexDirection: 'row', paddingTop: 8, paddingBottom: Math.max(bottomInset, 8), paddingHorizontal: 12, backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1 }}>
    {(['home', 'chats', 'models', 'settings'] as const).map(tab => <Pressable key={tab} accessibilityRole="tab" accessibilityLabel={tab === 'home' ? 'Home' : tab === 'chats' ? 'Chats' : tab === 'models' ? 'Models' : 'Settings'} accessibilityState={{ selected: active === tab }} onPress={() => onSelect(tab)} style={({ pressed }) => ({ flex: 1, minHeight: 52, alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? 0.6 : 1 })}>
      <View style={{ paddingVertical: 5, paddingHorizontal: 17, borderRadius: 12, backgroundColor: active === tab ? colors.raised : 'transparent' }}><AppIcon name={tab === 'chats' ? 'chat' : tab} size={21} color={active === tab ? colors.primary : colors.secondary} /></View>
      <Text style={{ color: active === tab ? colors.primary : colors.secondary, fontSize: 12, fontWeight: active === tab ? '700' : '500' }}>{tab === 'home' ? 'Home' : tab === 'chats' ? 'Chats' : tab === 'models' ? 'Models' : 'Settings'}</Text>
    </Pressable>)}
  </View>;
}
