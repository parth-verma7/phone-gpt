import { ScaledText as Text } from './ScaledText';
import { Alert, Linking, Platform, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { PhoneGptLogo } from './PhoneGptLogo';
import { ActionButton, SettingsCard } from './UiKit';
import type { AppIconName } from './AppIcon';
import { VOICE_TRANSCRIPTION_MODE } from '../config/voice';
import { ContactForm } from './ContactForm';

export function AppInfo({ version }: { version: string }) {
  const { colors } = useAppTheme();
  const sections: { title: string; text: string; icon: AppIconName }[] = [
    {
      title: 'Private, on-device chat', icon: 'shield',
      text: 'Your selected model runs on your phone. PhoneGPT stores conversations and attached text files on this device and does not send them to a chat server.',
    },
    {
      title: 'Web search', icon: 'shield',
      text: 'Web search sends the search question online through Cloudflare to Brave Search. Saved conversation history, attached files and voice recordings are not included in that search request. Network-derived usage counters enforce search limits.',
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
      text: Platform.OS === 'android'
        ? 'Download and select an English Whisper model in Models → Voice. ' + (VOICE_TRANSCRIPTION_MODE === 'live' ? 'Tap the microphone for live, on-device transcription into your draft. Recent words may change. Tap Stop to finish.' : 'Tap the microphone to record, then tap Stop to transcribe locally into your draft.') + ' Recordings continue until you stop. Temporary recordings are normally cleaned up after use; an interruption may leave a file until later cleanup. Voice typing does not send a message automatically.'
        : 'On-device voice typing is available on Android. Voice typing on iOS has not yet been verified on a device.',
    },
    {
      title: 'Your saved data', icon: 'shield',
      text: 'Chats, settings, attachments and downloaded models are saved in app-specific storage. App updates normally keep this data. Uninstalling PhoneGPT or clearing its app data removes the local copy. Android backup settings may allow backup or restoration of some app data.',
    },
    {
      title: 'About model replies', icon: 'info',
      text: 'Responses depend on the model you choose and can contain mistakes. Check important information before relying on it.',
    },
  ];

  const openPrivacyPolicy = async () => {
    try { await Linking.openURL('https://phone-gpt.pages.dev/privacy/'); }
    catch { Alert.alert('Unable to open privacy policy', 'Open https://phone-gpt.pages.dev/privacy/ in your browser when you have internet access.'); }
  };

  return <View style={{ gap: 16 }}>
    <View style={{ gap: 6 }}>
      <PhoneGptLogo size={64} />
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{__DEV__ ? 'PhoneGPT Dev' : 'PhoneGPT'}</Text>
      <Text style={{ color: colors.secondary, fontSize: 14 }}>Version {version.replace(/^v/, '')}{__DEV__ ? ' · Development build' : ''}</Text>
      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 23 }}>AI on your phone. Your conversations stay with you.</Text>
    </View>
    <SettingsCard title="Privacy Policy" icon="shield" description="How PhoneGPT handles your information, online services and data deletion.">
      <ActionButton label="Read Privacy Policy" secondary icon="shield" onPress={() => { void openPrivacyPolicy(); }} />
    </SettingsCard>
    {sections.map((section) => <SettingsCard key={section.title} title={section.title} icon={section.icon}>
      <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 21 }}>{section.text}</Text>
    </SettingsCard>)}
    <Text style={{ color: colors.secondary, fontSize: 14 }}>Created by Parth Verma</Text>
    <ContactForm />
  </View>;
}
