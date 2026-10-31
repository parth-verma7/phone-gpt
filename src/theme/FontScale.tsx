import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

export const FONT_SCALE_PRESETS = [0.5, 0.8, 1, 1.2, 1.5] as const;
export type FontScale = (typeof FONT_SCALE_PRESETS)[number];
export const FONT_SCALE_STORAGE_KEY = '@phone-gpt/font-scale';

export type FontScaleState = {
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => void;
  ready: boolean;
  error: string | null;
};

function isFontScale(value: number): value is FontScale {
  return FONT_SCALE_PRESETS.some((preset) => preset === value);
}

const FontScaleContext = createContext<FontScaleState>({
  fontScale: 1,
  setFontScale: () => undefined,
  ready: false,
  error: null,
});

export function FontScaleProvider({ children }: { children: ReactNode }) {
  const [fontScale, updateFontScale] = useState<FontScale>(1);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const changed = useRef(false);
  const writes = useRef<Promise<void>>(Promise.resolve());
  const mounted = useRef(false);

  useEffect(() => {
    let active = true;
    mounted.current = true;
    AsyncStorage.getItem(FONT_SCALE_STORAGE_KEY)
      .then((saved) => {
        const value = saved === null ? NaN : Number(saved);
        if (active && !changed.current && isFontScale(value)) updateFontScale(value);
      })
      .catch(() => { if (active) setError('Could not load the saved font size.'); })
      .finally(() => { if (active) setReady(true); });
    return () => { active = false; mounted.current = false; };
  }, []);

  const setFontScale = useCallback((scale: FontScale) => {
    if (!isFontScale(scale)) return;
    changed.current = true;
    updateFontScale(scale);
    // Queue writes, including repeated selections, so the newest choice wins.
    writes.current = writes.current.then(async () => {
      try {
        await AsyncStorage.setItem(FONT_SCALE_STORAGE_KEY, String(scale));
        if (mounted.current) setError(null);
      } catch {
        if (mounted.current) setError('Could not save the font size. Select a size to retry.');
      }
    });
  }, []);

  const value = useMemo(() => ({ fontScale, setFontScale, ready, error }), [fontScale, setFontScale, ready, error]);
  return <FontScaleContext.Provider value={value}>{children}</FontScaleContext.Provider>;
}

export function useFontScale() { return useContext(FontScaleContext); }
