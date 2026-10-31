import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { useAppTheme } from '../theme/AppTheme';
import { AppIcon, type AppIconName } from './AppIcon';

export function ActionButton({ label, onPress, icon, secondary = false, danger = false, disabled = false, busy = false }: {
  label: string; onPress: () => void; icon?: AppIconName; secondary?: boolean; danger?: boolean; disabled?: boolean; busy?: boolean;
}) {
  const { colors } = useAppTheme();
  const foreground = danger ? colors.error : secondary ? colors.primary : colors.onPrimary;
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: disabled || busy, busy }} disabled={disabled || busy} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, paddingVertical: 11, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start', maxWidth: '100%', backgroundColor: danger ? colors.errorSurface : secondary ? colors.raised : colors.primary, opacity: disabled || busy ? 0.5 : pressed ? 0.72 : 1 })}>
    {busy ? <ActivityIndicator color={foreground} size="small" /> : icon && <AppIcon name={icon} color={foreground} size={18} />}
    <Text style={{ color: foreground, fontSize: 13, fontWeight: '700', flexShrink: 1 }}>{label}</Text>
  </Pressable>;
}

export function SettingsCard({ title, description, icon, children }: { title: string; description?: string; icon: AppIconName; children: ReactNode }) {
  const { colors } = useAppTheme();
  return <View style={{ backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18, gap: 14 }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}><AppIcon name={icon} color={colors.primary} size={20} /><Text accessibilityRole="header" style={{ flex: 1, color: colors.text, fontSize: 16, fontWeight: '700' }}>{title}</Text></View>
    {description && <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 19 }}>{description}</Text>}
    {children}
  </View>;
}

export function DownloadStatus({ progress, label }: { progress: number; label: string }) {
  const { colors } = useAppTheme();
  const percent = Number.isFinite(progress) ? Math.round(Math.max(0, Math.min(1, progress)) * 100) : 0;
  return <View accessibilityRole="progressbar" accessibilityLabel={label} accessibilityValue={{ min: 0, max: 100, now: percent }} style={{ flex: 1, minWidth: 100, gap: 8 }}>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 8 }}><Text style={{ color: colors.secondary, fontSize: 12, flexShrink: 1 }}>{label}</Text><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '700' }}>{percent}%</Text></View>
    <View style={{ height: 5, backgroundColor: colors.track, borderRadius: 3, overflow: 'hidden' }}><View style={{ width: `${percent}%`, height: 5, backgroundColor: colors.fill, borderRadius: 3 }} /></View>
  </View>;
}
