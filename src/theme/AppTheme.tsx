import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type ThemeColors = {
  background: string; surface: string; raised: string; text: string;
  secondary: string; muted: string; border: string; primary: string;
  onPrimary: string; userBubble: string; userText: string; assistantBubble: string;
  error: string; errorSurface: string; success: string; disabled: string;
  track: string; fill: string; scrim: string;
};

const light: ThemeColors = {
  background: '#F7FAF9', surface: '#FFFFFF', raised: '#EAF3F0', text: '#172D29',
  secondary: '#536A64', muted: '#657A74', border: '#DCE8E3', primary: '#157568',
  onPrimary: '#FFFFFF', userBubble: '#157568', userText: '#FFFFFF', assistantBubble: '#FFFFFF',
  error: '#B42318', errorSurface: '#FCECEA', success: '#157568', disabled: '#BCCBC6',
  track: '#DCE8E3', fill: '#157568', scrim: 'rgba(12,32,26,0.35)',
};
const dark: ThemeColors = {
  background: '#101B19', surface: '#182724', raised: '#20342F', text: '#EAF3EF',
  secondary: '#B4C8C0', muted: '#97B1A6', border: '#30483F', primary: '#83D7C1',
  onPrimary: '#102E26', userBubble: '#285347', userText: '#F0FAF6', assistantBubble: '#182724',
  error: '#FFAAA3', errorSurface: '#442825', success: '#83D7C1', disabled: '#40574D',
  track: '#30483F', fill: '#83D7C1', scrim: 'rgba(0,0,0,0.65)',
};

const THEME_KEY = '@phone-gpt/theme';
type ThemeState = { colors: ThemeColors; isDark: boolean; ready: boolean; setDarkMode: (enabled: boolean) => void };
const ThemeContext = createContext<ThemeState>({ colors: light, isDark: false, ready: false, setDarkMode: () => undefined });

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const [isDark, setDarkMode] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    AsyncStorage.getItem(THEME_KEY)
      .then((saved) => { if (active) setDarkMode(saved === 'dark'); })
      .catch(() => undefined)
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    // Never overwrite a saved choice with the default before hydration finishes.
    if (ready) void AsyncStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light').catch(() => undefined);
  }, [isDark, ready]);
  const value = useMemo(() => ({ colors: isDark ? dark : light, isDark, ready, setDarkMode }), [isDark, ready]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useAppTheme() { return useContext(ThemeContext); }
