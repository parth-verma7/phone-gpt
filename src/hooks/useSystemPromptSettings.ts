import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { DEFAULT_SYSTEM_PROMPT } from '../config/systemPrompt';

const SYSTEM_PROMPT_KEY = '@phone-gpt/system-prompt';

export function useSystemPromptSettings() {
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [draft, setDraftValue] = useState(DEFAULT_SYSTEM_PROMPT);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SYSTEM_PROMPT_KEY)
      .then((value) => {
        const prompt = value?.trim() || DEFAULT_SYSTEM_PROMPT;
        if (active) { setSavedPrompt(prompt); setDraftValue(prompt); }
      })
      .catch(() => { if (active) setError('Could not load the saved prompt.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);

  const setDraft = (value: string) => { setDraftValue(value); setNotice(''); setError(''); };
  const save = async () => {
    if (!ready || saving) return;
    setSaving(true); setNotice(''); setError('');
    const value = draft.trim() || DEFAULT_SYSTEM_PROMPT;
    try {
      await AsyncStorage.setItem(SYSTEM_PROMPT_KEY, value);
      setSavedPrompt(value); setDraftValue(value);
      setNotice(draft.trim() ? 'Saved. Applies to new chats.' : 'Saved. Default prompt restored for new chats.');
    } catch {
      setError('Could not save the prompt. Please try again.');
    } finally { setSaving(false); }
  };
  return { savedPrompt, draft, setDraft, ready, saving, notice, error, save };
}
