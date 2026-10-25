import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

export async function pickTextDocument() {
  // Loading expo-document-picker eagerly crashes older development APKs before
  // the app opens. Check native availability first and import only on demand.
  if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExpoDocumentPicker')) {
    throw new Error('This installed app does not include the text-file picker. Install PhoneGPT v0.3.8 or newer over the existing app, then reload. Your chats and models will be preserved.');
  }
  const { getDocumentAsync } = await import('expo-document-picker');
  return getDocumentAsync({ type: 'text/plain', copyToCacheDirectory: true, multiple: false });
}
