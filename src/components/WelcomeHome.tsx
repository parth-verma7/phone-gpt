import { ScaledText as Text } from './ScaledText';
import { useMemo } from 'react';
import { useAppTheme, type ThemeColors } from '../theme/AppTheme';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { PhoneGptLogo } from './PhoneGptLogo';
import { AppIcon, type AppIconName } from './AppIcon';

export function WelcomeHome({ version, onChat, onModels }: { version: string; onChat: () => void; onModels: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const features: { icon: AppIconName; title: string; detail: string }[] = [
    { icon: 'shield', title: 'Private by design', detail: 'Your chats stay on this device.' },
    { icon: 'models', title: 'Your choice of model', detail: 'Download once. Use offline.' },
  ];
  return <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
    <View style={styles.inner}>
      <View style={styles.badge}><PhoneGptLogo size={44} /><Text style={styles.badgeText}>ON YOUR DEVICE. ON YOUR TERMS.</Text></View>
      <Text accessibilityRole="header" style={styles.heading}>A little AI.{'\n'}All yours.</Text>
      <Text style={styles.description}>Meet PhoneGPT. A quiet space to think, ask questions and explore—with AI that runs on your phone.</Text>
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={onChat} style={({ pressed }) => [styles.primary, pressed && styles.pressed]}>
          <AppIcon name="chat" color={colors.onPrimary} /><Text style={styles.primaryText}>Start a conversation</Text><AppIcon name="arrow" color={colors.onPrimary} size={20} />
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onModels} style={({ pressed }) => [styles.secondary, pressed && styles.pressed]}>
          <AppIcon name="models" color={colors.primary} /><View style={styles.actionCopy}><Text style={styles.secondaryText}>Explore models</Text><Text style={styles.actionDetail}>Find and download your first model</Text></View><AppIcon name="arrow" color={colors.secondary} size={20} />
        </Pressable>
      </View>
      <View style={styles.features}>{features.map((feature) => <View key={feature.title} style={styles.feature}>
        <View style={styles.featureIcon}><AppIcon name={feature.icon} color={colors.primary} size={20} /></View>
        <View style={styles.actionCopy}><Text style={styles.featureTitle}>{feature.title}</Text><Text style={styles.featureDetail}>{feature.detail}</Text></View>
      </View>)}</View>
      <Text style={styles.version}>No account needed · PhoneGPT {version}</Text>
    </View>
  </ScrollView>;
}
const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: 28 },
  inner: { width: '100%', maxWidth: 480, alignSelf: 'center', gap: 22 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  badgeText: { color: colors.primary, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heading: { color: colors.text, fontSize: 42, lineHeight: 48, fontWeight: '800', letterSpacing: -1.5 },
  description: { color: colors.secondary, fontSize: 14, lineHeight: 23, maxWidth: 380 },
  actions: { gap: 12, marginTop: 4 },
  primary: { flexDirection: 'row', gap: 12, backgroundColor: colors.primary, borderRadius: 16, paddingHorizontal: 18, paddingVertical: 18, minHeight: 58, alignItems: 'center' },
  primaryText: { flex: 1, color: colors.onPrimary, fontSize: 15, fontWeight: '700' },
  secondary: { flexDirection: 'row', gap: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, padding: 18, minHeight: 72, alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 15, fontWeight: '700' },
  actionCopy: { flex: 1, minWidth: 0, gap: 4 },
  actionDetail: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  pressed: { opacity: 0.75 },
  features: { gap: 18, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 24, marginTop: 4 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  featureIcon: { padding: 10, backgroundColor: colors.raised, borderRadius: 12 },
  featureTitle: { color: colors.text, fontSize: 13, fontWeight: '600' },
  featureDetail: { color: colors.secondary, fontSize: 12, lineHeight: 18 },
  version: { color: colors.muted, fontSize: 11, lineHeight: 18, marginTop: 4 },
});
