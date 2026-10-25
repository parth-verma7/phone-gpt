import { Text, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';

export function AppInfo({ version }: { version: string }) {
  const { colors } = useAppTheme();
  const sections = [
    {
      title: 'Private, on-device chat',
      text: 'Your selected model runs on your phone. PhoneGPT stores conversations and attached text files on this device and does not send them to a chat server.',
    },
    {
      title: 'Using PhoneGPT offline',
      text: 'Downloading models needs an internet connection. Once downloaded and loaded, the model generates replies locally.' + (__DEV__ ? ' This development build still needs a connection to the development server to load the app; a standalone offline build is planned.' : ''),
    },
    {
      title: 'Files and supported input',
      text: 'Chat with text or attach a UTF-8 .txt file up to 32 KB. File contents also need to fit in the model’s context window. Image chat and other document formats are planned.',
    },
    {
      title: 'Your saved data',
      text: 'Chats, settings, attachments and downloaded models are saved in app-specific storage. App updates normally keep this data. Uninstalling PhoneGPT or clearing its app data removes it.',
    },
    {
      title: 'About model replies',
      text: 'Responses depend on the model you choose and can contain mistakes. Check important information before relying on it.',
    },
  ];

  return <View style={{ gap: 16 }}>
    <View style={{ gap: 6 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>PhoneGPT</Text>
      <Text style={{ color: colors.secondary, fontSize: 14 }}>Version {version.replace(/^v/, '')}{__DEV__ ? ' · Development build' : ''}</Text>
      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 23 }}>AI on your phone. Your conversations stay with you.</Text>
    </View>
    {sections.map((section) => <View key={section.title} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 17, fontWeight: '700' }}>{section.title}</Text>
      <Text style={{ color: colors.secondary, fontSize: 14, lineHeight: 21 }}>{section.text}</Text>
    </View>)}
    <View style={{ gap: 8, marginTop: 8 }}>
      <Text accessibilityRole="header" style={{ color: colors.text, fontSize: 22, fontWeight: '700' }}>Parth Verma</Text>
      <Text style={{ color: colors.secondary, fontSize: 14, fontWeight: '600' }}>Founder &amp; Developer, PhoneGPT</Text>
      <Text style={{ color: colors.secondary, fontSize: 15, lineHeight: 23 }}>Parth is a Machine Learning Engineer at Coinbase and the founder of PhoneGPT. He is building PhoneGPT to bring private, on-device AI into everyday use—giving people a simple way to download models and chat on their own phones.</Text>
    </View>
  </View>;
}
