import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { restoreThemeAccent, themeColors, THEME_ACCENT_KEY, type ThemeAccent, type ThemeColors } from './themeColors';
export type { ThemeColors } from './themeColors';

const THEME_KEY = '@phone-gpt/theme';
type ThemeState = { colors: ThemeColors; isDark: boolean; ready: boolean; setDarkMode: (enabled: boolean) => void; accent: ThemeAccent; setAccent: (accent: ThemeAccent) => void };
const ThemeContext = createContext<ThemeState>({ colors: themeColors(false, 'teal'), isDark: false, ready: false, setDarkMode: () => undefined, accent: 'teal', setAccent: () => undefined });

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setDarkMode] = useState(false);
  const [accent, setAccent] = useState<ThemeAccent>('teal');
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    Promise.all([AsyncStorage.getItem(THEME_KEY).catch(() => null), AsyncStorage.getItem(THEME_ACCENT_KEY).catch(() => null)])
      .then(([saved, savedAccent]) => { if (active) { setDarkMode(saved === 'dark'); setAccent(restoreThemeAccent(savedAccent)); } })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    // Never overwrite a saved choice with the default before hydration finishes.
    if (ready) {
      void AsyncStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light').catch(() => undefined);
      void AsyncStorage.setItem(THEME_ACCENT_KEY, accent).catch(() => undefined);
    }
  }, [isDark, accent, ready]);
  const value = useMemo(() => ({ colors: themeColors(isDark, accent), isDark, ready, setDarkMode, accent, setAccent }), [isDark, accent, ready]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() { return useContext(ThemeContext); }
