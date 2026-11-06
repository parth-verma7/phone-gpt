import type { ViewStyle } from 'react-native';
import type { ThemeColors } from './AppTheme';

/** Shared control geometry; font scaling never shrinks the touch target. */
export const CONTROL = {
  height: 44, radius: 12, cardRadius: 18, gap: 8, icon: 18,
  label: { fontSize: 13, lineHeight: 19, fontWeight: '600' as const },
  compactLabel: { fontSize: 12, lineHeight: 18, fontWeight: '600' as const },
};

export function controlSurface(colors: ThemeColors, disabled = false, pressed = false): ViewStyle {
  return {
    minHeight: CONTROL.height, borderRadius: CONTROL.radius,
    borderWidth: 1, borderColor: colors.border, backgroundColor: colors.raised,
    paddingHorizontal: 12, paddingVertical: 8, gap: CONTROL.gap,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.5 : pressed ? 0.72 : 1,
  };
}
