import { CONTROL, controlSurface } from '../theme/controlStyles';
import { Pressable } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { AppIcon } from './AppIcon';
import { ScaledText as Text } from './ScaledText';

export type WebSearchControlsProps = {
  enabled: boolean;
  onToggle: () => void;
  disabled?: boolean;
};

export function WebSearchControls({ enabled, onToggle, disabled = false }: WebSearchControlsProps) {
  const { colors } = useAppTheme();
  return <Pressable
    accessibilityRole="switch"
    accessibilityLabel="Web search"
    accessibilityState={{ checked: enabled, disabled }}
    onPress={onToggle}
    disabled={disabled}
    style={({ pressed }) => [controlSurface(colors, disabled, pressed), { flexShrink: 0 }]}
  >
    <AppIcon name="search" size={16} color={enabled ? colors.primary : colors.secondary} />
    <Text style={{ color: enabled ? colors.primary : colors.secondary, ...CONTROL.compactLabel }}>Web {enabled ? 'on' : 'off'}</Text>
  </Pressable>;
}
