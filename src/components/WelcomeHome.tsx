import { useMemo } from 'react';
import { useAppTheme, type ThemeColors } from '../theme/AppTheme';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

export function WelcomeHome({ version, onChat, onModels }: { version: string; onChat: () => void; onModels: () => void }) {
  const { colors } = useAppTheme();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return <ScrollView contentContainerStyle={styles.content}>
    <View style={styles.mark}><Text style={styles.markText}>P</Text></View>
    <Text accessibilityRole="header" style={styles.heading}>Welcome to PhoneGPT</Text>
    <Text style={styles.description}>Your private AI, on your phone. Download a model once, then chat offline. Your conversations stay on this device.</Text>
    <View style={styles.actions}>
      <Pressable accessibilityRole="button" onPress={onChat} style={styles.primary}><Text style={styles.primaryText}>Chat</Text></Pressable>
      <Pressable accessibilityRole="button" onPress={onModels} style={styles.secondary}><Text style={styles.secondaryText}>Models</Text></Pressable>
    </View>
    <Text style={styles.hint}>New here? Open Models to download and load your first model.</Text>
    <Text style={styles.version}>PhoneGPT {version}</Text>
  </ScrollView>;
}

const createStyles = (colors: ThemeColors) => StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 32, gap: 18 },
  mark: { width: 64, height: 64, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  markText: { color: colors.onPrimary, fontSize: 32, fontWeight: '800' },
  heading: { color: colors.text, fontSize: 29, fontWeight: '800', textAlign: 'center' },
  description: { maxWidth: 360, color: colors.secondary, fontSize: 14, lineHeight: 22, textAlign: 'center' },
  actions: { width: '100%', maxWidth: 320, gap: 12, marginTop: 8 },
  primary: { backgroundColor: colors.primary, borderRadius: 14, padding: 16, alignItems: 'center' },
  primaryText: { color: colors.onPrimary, fontSize: 16, fontWeight: '700' },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 16, alignItems: 'center' },
  secondaryText: { color: colors.text, fontSize: 16, fontWeight: '700' },
  hint: { maxWidth: 320, color: colors.secondary, fontSize: 12, lineHeight: 18, textAlign: 'center' },
  version: { color: colors.muted, fontSize: 12, marginTop: 12 },
});
