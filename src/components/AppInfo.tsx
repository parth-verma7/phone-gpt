import { ScaledText as Text } from './ScaledText';
import { View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { PhoneGptLogo } from './PhoneGptLogo';
import { SettingsCard } from './UiKit';
import type { AppIconName } from './AppIcon';
import { VOICE_TRANSCRIPTION_MODE } from '../config/voice';

export function AppInfo({ version }: { version: string }) {
  const { colors } = useAppTheme();
  const sections: { title: string; text: string; icon: AppIconName }[] = [
    {
      title: 'Private, on-device chat', icon: 'shield',
      text: 'Your selected model runs on your phone. PhoneGPT stores conversations and attached text files on this device and does not send them to a chat server.',
    },
    {
      title: 'Using PhoneGPT offline', icon: 'models',
      text: 'Downloading models needs an internet connection. Once downloaded and loaded, the model generates replies locally.' + (__DEV__ ? ' This development build still needs a connection to the development server to load the app; use the standalone PhoneGPT app for offline startup.' : ''),
    },
    {
      title: 'Files and supported input', icon: 'text',
      text: 'Chat with text or attach a UTF-8 .txt file up to 32 KB. File contents also need to fit in the model’s context window. Image chat and other document formats are planned.',
    },
    {
      title: 'Voice typing', icon: 'chat',
      text: 'On Android, download and select an English Whisper model in Models → Voice. ' + (VOICE_TRANSCRIPTION_MODE === 'live' ? 'Tap the microphone for live, on-device transcription into your draft. Recent words may change. Tap Stop to finish.' : 'Tap the microphone to record, then tap Stop to transcribe locally into your draft.') + ' Recordings continue until you stop and are deleted after use. Voice typing does not send a message automatically.',
    },
    {
      title: 'Your saved data', icon: 'shield',
      text: 'Chats, settings, attachments and downloaded models are saved in app-specific storage. App updates normally keep this data. Uninstalling PhoneGPT or clearing its app data removes it.',
    },
    {
      title: 'About model replies', icon: 'info',
      text: 'Responses depend on the model you choose and can contain mistakes. Check important information before relying on it.',
    },
  ];

  return <View style={{ gap: 16 }}>
    <View style={{ gap: 6 }}>
      <PhoneGptLogo size={64} />
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{__DEV__ ? 'PhoneGPT Dev' : 'PhoneGPT'}</Text>
      <Text style={{ color: colors.secondary, fontSize: 14 }}>Version {version.replace(/^v/, '')}{__DEV__ ? ' · Development build' : ''}</Text>
      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 23 }}>AI on your phone. Your conversations stay with you.</Text>
    </View>
    {sections.map((section) => <SettingsCard key={section.title} title={section.title} icon={section.icon}>
      <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 21 }}>{section.text}</Text>
    </SettingsCard>)}
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Parth Verma</Text>
      <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: '600' }}>Founder &amp; Developer, PhoneGPT</Text>
      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 23 }}>Parth is a Machine Learning Engineer at Coinbase and the founder of PhoneGPT. He is building PhoneGPT to bring private, on-device AI into everyday use—giving people a simple way to download models and chat on their own phones.</Text>
    </View>
  </View>;
}
