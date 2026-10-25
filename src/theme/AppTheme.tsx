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
  background: '#FFFFFF', surface: '#FFFFFF', raised: '#F1F1F5', text: '#171720',
  secondary: '#60606C', muted: '#747480', border: '#E1E1E7', primary: '#171720',
  onPrimary: '#FFFFFF', userBubble: '#171720', userText: '#FFFFFF', assistantBubble: '#F1F1F5',
  error: '#B42318', errorSurface: '#F2E9E9', success: '#16803C', disabled: '#BABAC3',
  track: '#E8E8EE', fill: '#4B4B57', scrim: 'rgba(0,0,0,0.32)',
};
const dark: ThemeColors = {
  background: '#121418', surface: '#1A1D23', raised: '#242830', text: '#F0F2F6',
  secondary: '#B6BCC8', muted: '#929CAA', border: '#343942', primary: '#A6E3C5',
  onPrimary: '#10241A', userBubble: '#234537', userText: '#ECF6F0', assistantBubble: '#20232A',
  error: '#FFAAA3', errorSurface: '#442825', success: '#8DDFAB', disabled: '#454D5B',
  track: '#343942', fill: '#A6E3C5', scrim: 'rgba(0,0,0,0.65)',
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
