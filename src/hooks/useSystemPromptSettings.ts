import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const SYSTEM_PROMPT_KEY = '@phone-gpt/system-prompt';

export function useSystemPromptSettings() {
  const [savedPrompt, setSavedPrompt] = useState('');
  const [draft, setDraftValue] = useState('');
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SYSTEM_PROMPT_KEY)
      .then((value) => {
        if (active) { setSavedPrompt(value ?? ''); setDraftValue(value ?? ''); }
      })
      .catch(() => { if (active) setError('Could not load the saved prompt.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setDraft = (value: string) => { setDraftValue(value); setNotice(''); setError(''); };
  const save = async () => {
    if (!ready || saving) return;
    setSaving(true); setNotice(''); setError('');
    const value = draft.trim();
    try {
      await AsyncStorage.setItem(SYSTEM_PROMPT_KEY, value);
      setSavedPrompt(value); setDraftValue(value);
      setNotice(value ? 'Saved. Applies to new chats.' : 'Saved. New chats will use the default prompt.');
    } catch {
      setError('Could not save the prompt. Please try again.');
    } finally { setSaving(false); }
  };
  return { savedPrompt, draft, setDraft, ready, saving, notice, error, save };
}
