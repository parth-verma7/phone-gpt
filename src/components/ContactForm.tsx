import { useRef, useState } from 'react';
import { Alert, Linking, Keyboard, View, type TextInput as NativeTextInput } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { CONTACT_LIMITS, sendContactMessage, validateContactDraft, type ContactDraft, type ContactErrors } from '../services/contactForm';
import { ScaledText as Text, ScaledTextInput as TextInput } from './ScaledText';
import { ActionButton, SettingsCard } from './UiKit';

export function ContactForm() {
  const { colors, isDark } = useAppTheme();
  const [draft, setDraft] = useState<ContactDraft>({ name: '', email: '', message: '' });
  const [errors, setErrors] = useState<ContactErrors>({});
  const [status, setStatus] = useState<'sent' | 'unavailable' | null>(null);
  const [busy, setBusy] = useState(false);
  const sending = useRef(false);
  const nameRef = useRef<NativeTextInput>(null);
  const emailRef = useRef<NativeTextInput>(null);
  const messageRef = useRef<NativeTextInput>(null);

  function update(field: keyof ContactDraft, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setStatus(null);
  }

  async function sendMessage() {
    if (sending.current) return;
    const nextErrors = validateContactDraft(draft);
    setErrors(nextErrors);
    setStatus(null);
    if (Object.keys(nextErrors).length) {
      (nextErrors.name ? nameRef : nextErrors.email ? emailRef : messageRef).current?.focus();
      return;
    }
    sending.current = true;
    setBusy(true);
    Keyboard.dismiss();
    try {
      const result = await sendContactMessage(draft);
      setStatus(result);
      if (result === 'sent') setDraft({ name: '', email: '', message: '' });
    } catch {
      setStatus('unavailable');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  const inputStyle = { minHeight: 48, color: colors.text, backgroundColor: colors.raised, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 14, fontSize: 15, lineHeight: 22 };
  const errorText = (field: keyof ContactDraft) => errors[field] ? <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13 }}>{errors[field]}</Text> : null;

  return <SettingsCard title="Contact" icon="chat">
    <Text style={{ color: colors.secondary, fontSize: 13, lineHeight: 21 }}>Share feedback, ideas, model requests or just say hello. All fields are required.</Text>
    <Text style={{ color: colors.secondary, fontSize: 12, lineHeight: 19 }}>When you tap Send message, your name, reply email and message are sent through Formspree. Your chats are not included. An internet connection is required.</Text>
    <ActionButton label="Privacy Policy" secondary onPress={() => { void Linking.openURL('https://phone-gpt.pages.dev/privacy/').catch(() => Alert.alert('Unable to open privacy policy', 'Open https://phone-gpt.pages.dev/privacy/ in your browser when you have internet access.')); }} />
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 14 }}>Name (required)</Text>
      <TextInput ref={nameRef} accessibilityLabel="Name, required" accessibilityHint={errors.name} value={draft.name} onChangeText={(value) => update('name', value)} maxLength={CONTACT_LIMITS.name} autoComplete="name" textContentType="name" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => emailRef.current?.focus()} keyboardAppearance={isDark ? 'dark' : 'light'} editable={!busy} style={inputStyle} />
      {errorText('name')}
    </View>
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 14 }}>Reply email (required)</Text>
      <TextInput ref={emailRef} accessibilityLabel="Reply email, required" accessibilityHint={errors.email} value={draft.email} onChangeText={(value) => update('email', value)} maxLength={CONTACT_LIMITS.email} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" textContentType="emailAddress" returnKeyType="next" submitBehavior="submit" onSubmitEditing={() => messageRef.current?.focus()} keyboardAppearance={isDark ? 'dark' : 'light'} editable={!busy} style={inputStyle} />
      {errorText('email')}
    </View>
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.text, fontSize: 14 }}>Message (required)</Text>
      <TextInput ref={messageRef} accessibilityLabel="Message, required" accessibilityHint={errors.message} value={draft.message} onChangeText={(value) => update('message', value)} multiline textAlignVertical="top" scrollEnabled submitBehavior="newline" keyboardAppearance={isDark ? 'dark' : 'light'} editable={!busy} style={{ ...inputStyle, minHeight: 150, maxHeight: 280 }} />
      {errorText('message')}
    </View>
    <ActionButton label="Send message" busy={busy} onPress={() => { void sendMessage(); }} />
    {status === 'sent' && <Text accessibilityLiveRegion="polite" style={{ color: colors.secondary, fontSize: 13, lineHeight: 21 }}>Thanks! Your message has been submitted.</Text>}
    {status === 'unavailable' && <View style={{ gap: 6 }}>
      <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 13, lineHeight: 21 }}>Could not confirm submission. Your draft is still here. Check your connection and try again.</Text>
    </View>}
  </SettingsCard>;
}
