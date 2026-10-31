import { createContext, forwardRef, useContext } from 'react';
import {
  StyleSheet,
  Text as NativeText,
  TextInput as NativeTextInput,
  type TextProps,
  type TextInputProps,
  type TextStyle,
} from 'react-native';
import { useFontScale } from '../theme/FontScale';

const InsideText = createContext(false);

function scaledMetrics(style: TextProps['style'], scale: number, nested: boolean): TextStyle {
  const flattened = StyleSheet.flatten(style);
  const metrics: TextStyle = {};
  if (typeof flattened?.fontSize === 'number') {
    metrics.fontSize = flattened.fontSize * scale;
  } else if (!nested) {
    metrics.fontSize = 14 * scale;
  }
  if (typeof flattened?.lineHeight === 'number') metrics.lineHeight = flattened.lineHeight * scale;
  return metrics;
}

export const ScaledText = forwardRef<NativeText, TextProps>(function ScaledText({ style, children, ...props }, ref) {
  const { fontScale } = useFontScale();
  const nested = useContext(InsideText);
  return <NativeText {...props} ref={ref} style={[style, scaledMetrics(style, fontScale, nested)]}>
    <InsideText.Provider value={true}>{children}</InsideText.Provider>
  </NativeText>;
});

export const ScaledTextInput = forwardRef<NativeTextInput, TextInputProps>(function ScaledTextInput({ style, ...props }, ref) {
  const { fontScale } = useFontScale();
  return <NativeTextInput {...props} ref={ref} style={[style, scaledMetrics(style, fontScale, false)]} />;
});
