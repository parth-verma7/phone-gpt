import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';
import { DEFAULT_SYSTEM_PROMPT } from '../config/systemPrompt';

const SYSTEM_PROMPT_KEY = '@phone-gpt/system-prompt-versions-v1';
const LEGACY_PROMPT_KEY = '@phone-gpt/system-prompt';
type PromptVersion = { id: string; text: string; savedAt: number };
type PromptStore = { schemaVersion: 1; activePrompt: string; versions: PromptVersion[] };

export function useSystemPromptSettings() {
  const [savedPrompt, setSavedPrompt] = useState(DEFAULT_SYSTEM_PROMPT);
  const [draft, setDraftValue] = useState(DEFAULT_SYSTEM_PROMPT);
  const [versions, setVersions] = useState<PromptVersion[]>([]);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const writeInFlight = useRef(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(SYSTEM_PROMPT_KEY)
      .then(async (value) => {
        let prompt = DEFAULT_SYSTEM_PROMPT;
        let history: PromptVersion[] = [];
        // Separate keys keep arbitrary legacy instructions (including JSON) unambiguous.
        if (value !== null) {
          const store: PromptStore = JSON.parse(value);
          if (store.schemaVersion !== 1 || typeof store.activePrompt !== 'string' || !Array.isArray(store.versions)
            || store.versions.some(v => !v || typeof v.id !== 'string' || typeof v.text !== 'string' || !Number.isFinite(v.savedAt))) {
            throw new Error('Invalid prompt history');
          }
          prompt = store.activePrompt; history = store.versions.filter(version => version.text !== DEFAULT_SYSTEM_PROMPT);
        } else prompt = (await AsyncStorage.getItem(LEGACY_PROMPT_KEY))?.trim() || DEFAULT_SYSTEM_PROMPT;
        if (active) { setSavedPrompt(prompt); setDraftValue(prompt); setVersions(history); setReady(true); }
      })
      .catch(() => { if (active) setError('Could not load saved instructions. Restart the app to retry. Existing chats still work; saving and new chats are paused to protect your history.'); });
    return () => { active = false; };
  }, []);

  const setDraft = (value: string) => { setDraftValue(value); setNotice(''); setError(''); };
  const save = async () => {
    if (!ready || writeInFlight.current) return;
    const value = draft.trim() || DEFAULT_SYSTEM_PROMPT;
    if (value.length > 16000) { setError('Use instructions under 16,000 characters. Your saved versions are unchanged.'); return; }
    if (value === savedPrompt) { setDraftValue(value); setNotice('These instructions are already saved.'); return; }
    writeInFlight.current = true; setSaving(true); setNotice(''); setError('');
    const now = Date.now();
    // The bundled default is pinned separately and never consumes a history slot.
    const previous = versions.length || savedPrompt === DEFAULT_SYSTEM_PROMPT ? versions : [{ id: `${now}-0`, text: savedPrompt, savedAt: now }];
    const next = value === DEFAULT_SYSTEM_PROMPT ? previous : [{ id: `${now}-${Math.random().toString(36).slice(2)}`, text: value, savedAt: now }, ...previous];
    // Bound storage without silently discarding a saved version.
    if (next.length > 50 || next.reduce((size, entry) => size + entry.text.length, 0) > 64000) {
      setError('Prompt history is full. Remove an older version before saving.');
      writeInFlight.current = false; setSaving(false); return;
    }
    try {
      await AsyncStorage.setItem(SYSTEM_PROMPT_KEY, JSON.stringify({ schemaVersion: 1, activePrompt: value, versions: next }));
      setSavedPrompt(value); setDraftValue(value); setVersions(next);
      setNotice('Saved as a version. Applies to new chats.');
    } catch {
      setError('Could not save the prompt. Please try again.');
    } finally { writeInFlight.current = false; setSaving(false); }
  };
  const removeVersion = async (id: string) => {
    if (!ready || writeInFlight.current) return;
    writeInFlight.current = true; setSaving(true); setError('');
    const next = versions.filter(version => version.id !== id);
    try {
      await AsyncStorage.setItem(SYSTEM_PROMPT_KEY, JSON.stringify({ schemaVersion: 1, activePrompt: savedPrompt, versions: next }));
      setVersions(next); setNotice('Version removed. Your active instructions are unchanged.');
    } catch { setError('Could not remove the version. Please try again.'); }
    finally { writeInFlight.current = false; setSaving(false); }
  };
  return { removeVersion, savedPrompt, draft, setDraft, versions, ready, saving, notice, error, save };
}
