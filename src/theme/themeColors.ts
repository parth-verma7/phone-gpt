export type ThemeColors = {
  background: string; surface: string; raised: string; text: string;
  secondary: string; muted: string; border: string; primary: string;
  onPrimary: string; userBubble: string; userText: string; assistantBubble: string;
  error: string; errorSurface: string; success: string; disabled: string;
  track: string; fill: string; scrim: string;
};

const tealLight: ThemeColors = {
  background: '#F7FAF9', surface: '#FFFFFF', raised: '#EAF3F0', text: '#172D29',
  secondary: '#536A64', muted: '#657A74', border: '#DCE8E3', primary: '#157568',
  onPrimary: '#FFFFFF', userBubble: '#157568', userText: '#FFFFFF', assistantBubble: '#FFFFFF',
  error: '#B42318', errorSurface: '#FCECEA', success: '#157568', disabled: '#BCCBC6',
  track: '#DCE8E3', fill: '#157568', scrim: 'rgba(12,32,26,0.35)',
};
const tealDark: ThemeColors = {
  background: '#101B19', surface: '#182724', raised: '#20342F', text: '#EAF3EF',
  secondary: '#B4C8C0', muted: '#97B1A6', border: '#30483F', primary: '#83D7C1',
  onPrimary: '#102E26', userBubble: '#285347', userText: '#F0FAF6', assistantBubble: '#182724',
  error: '#FFAAA3', errorSurface: '#442825', success: '#83D7C1', disabled: '#40574D',
  track: '#30483F', fill: '#83D7C1', scrim: 'rgba(0,0,0,0.65)',
};

export const THEME_OPTIONS = [
  { id: 'teal', label: 'Teal', swatch: '#157568' },
  { id: 'light-blue', label: 'Light blue', swatch: '#38BDF8' },
  { id: 'royal-blue', label: 'Royal blue', swatch: '#334AC0' },
  { id: 'violet', label: 'Violet', swatch: '#7C3AED' },
  { id: 'red', label: 'Red', swatch: '#B42335' },
  { id: 'pink', label: 'Pink', swatch: '#D94699' },
] as const;
export type ThemeAccent = typeof THEME_OPTIONS[number]['id'];
export const THEME_ACCENT_KEY = '@phone-gpt/theme-accent';
export function restoreThemeAccent(saved: unknown): ThemeAccent {
  // Retired choices migrate without touching the independent light/dark preference.
  if (saved === 'sage-blue') return 'light-blue';
  if (saved === 'white') return 'teal';
  return THEME_OPTIONS.some(option => option.id === saved) ? saved as ThemeAccent : 'teal';
}
const accents: Record<Exclude<ThemeAccent, 'teal'>, { light: string; dark: string; tint: string }> = {
  'light-blue': { light: '#0369A1', dark: '#7DD3FC', tint: '#EAF6FD' },
  'royal-blue': { light: '#334AC0', dark: '#A5B4FC', tint: '#EEF0FF' },
  violet: { light: '#7C3AED', dark: '#C4B5FD', tint: '#F3EEFF' },
  red: { light: '#B42335', dark: '#FDA4AF', tint: '#FFF0F2' },
  pink: { light: '#A61C64', dark: '#F9A8D4', tint: '#FDEFF6' },
};
export function themeColors(isDark: boolean, accent: ThemeAccent): ThemeColors {
  if (accent === 'teal') return isDark ? tealDark : tealLight;
  const choice = accents[accent];
  const primary = isDark ? choice.dark : choice.light;
  return {
    ...(isDark ? tealDark : tealLight),
    background: isDark ? '#11151C' : '#F8FAFC',
    surface: isDark ? '#1A202A' : '#FFFFFF',
    raised: isDark ? '#242D3B' : choice.tint,
    text: isDark ? '#F1F5F9' : '#182335',
    secondary: isDark ? '#B9C5D5' : '#526174',
    muted: isDark ? '#A0AEC0' : '#607085',
    border: isDark ? '#3A4658' : '#DCE3EB',
    primary, onPrimary: isDark ? '#111827' : '#FFFFFF',
    userBubble: primary, userText: isDark ? '#111827' : '#FFFFFF',
    assistantBubble: isDark ? '#1A202A' : '#FFFFFF',
    disabled: isDark ? '#465366' : '#BFCAD6',
    track: isDark ? '#3A4658' : '#DCE3EB', fill: primary,
    scrim: isDark ? 'rgba(0,0,0,0.65)' : 'rgba(15,23,42,0.35)',
  };
}
