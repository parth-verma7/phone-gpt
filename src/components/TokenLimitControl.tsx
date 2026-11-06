import { CONTROL } from '../theme/controlStyles';
import { useEffect, useRef, useState } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';
import { ScaledText as Text, ScaledTextInput } from './ScaledText';
import { validTokenValue } from '../services/tokenLimits';

/** Stage slider, preset and typed changes; reload context only on explicit Apply. */
export function TokenLimitControl({ label, value, min, max, presets, disabled, onChange }: {
  label: string; value: number; min: number; max: number; presets: number[];
  disabled: boolean; onChange: (tokens: number) => void;
}) {
  const { colors } = useAppTheme();
  const [preview, setPreview] = useState(value);
  const [custom, setCustom] = useState(String(value));
  const [error, setError] = useState('');
  const width = useRef(1);
  const gesture = useRef({ startX: 0, startPreview: value, startCustom: String(value) });
  const live = useRef({ min, max, disabled, preview, custom });
  live.current = { min, max, disabled, preview, custom };
  useEffect(() => { setPreview(value); setCustom(String(value)); setError(''); }, [value, min, max]);
  const stage = (tokens: number) => {
    if (live.current.disabled) return;
    setError(''); setPreview(tokens); setCustom(String(tokens));
  };
  const updateGesture = (x: number) => {
    const { min: low, max: high } = live.current;
    const fraction = Math.max(0, Math.min(1, x / width.current));
    stage(Math.max(low, Math.min(high, Math.round(low * Math.pow(high / low, fraction)))));
  };
  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !live.current.disabled,
    onMoveShouldSetPanResponder: (_, state) => !live.current.disabled && Math.abs(state.dx) > Math.abs(state.dy),
    onPanResponderGrant: event => {
      gesture.current = { startX: event.nativeEvent.locationX, startPreview: live.current.preview, startCustom: live.current.custom };
      updateGesture(gesture.current.startX);
    },
    onPanResponderMove: (_, state) => updateGesture(gesture.current.startX + state.dx),
    onPanResponderRelease: () => {},
    onPanResponderTerminate: () => { setPreview(gesture.current.startPreview); setCustom(gesture.current.startCustom); },
  })).current;
  const draft = /^\d+$/.test(custom.trim()) ? Number(custom.trim()) : NaN;
  const valid = validTokenValue(draft, min, max);
  const pending = draft !== value;
  const canApply = !disabled && valid && pending;
  const position = max > min ? Math.max(0, Math.min(1, Math.log(preview / min) / Math.log(max / min))) : 0;
  const button = { minHeight: CONTROL.height, paddingHorizontal: 12, justifyContent: 'center' as const, borderRadius: CONTROL.radius, backgroundColor: colors.raised };
  return <View style={{ gap: 10, opacity: disabled ? 0.5 : 1 }}>
    <Text style={{ color: colors.text, ...CONTROL.label }}>{label}</Text>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>{presets.filter(tokens => tokens >= min && tokens <= max).map(tokens => <Pressable key={tokens} disabled={disabled} accessibilityRole="button" accessibilityLabel={`${label}: ${tokens} tokens`} accessibilityState={{ selected: draft === tokens, disabled }} onPress={() => stage(tokens)} style={[button, { backgroundColor: draft === tokens ? colors.primary : colors.raised }]}><Text style={{ color: draft === tokens ? colors.onPrimary : colors.text, ...CONTROL.label }}>{tokens.toLocaleString()}</Text></Pressable>)}</View>
    <View {...responder.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={label} accessibilityState={{ disabled }} accessibilityValue={{ min, max, now: preview }} aria-valuemin={min} aria-valuemax={max} aria-valuenow={preview} accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]} onAccessibilityAction={event => { const step = label === 'Conversation context' ? 256 : 64; stage(Math.max(min, Math.min(max, preview + (event.nativeEvent.actionName === 'increment' ? step : -step)))); }} onLayout={event => { width.current = Math.max(1, event.nativeEvent.layout.width); }} style={{ height: 44, justifyContent: 'center' }}>
      <View pointerEvents="none" style={{ height: 4, borderRadius: 2, backgroundColor: colors.track }}><View style={{ height: 4, width: `${position * 100}%`, borderRadius: 2, backgroundColor: colors.primary }} /></View>
      <View pointerEvents="none" style={{ position: 'absolute', left: `${position * 100}%`, marginLeft: -10, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary }} />
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <ScaledTextInput accessibilityLabel={`Custom ${label.toLowerCase()} in tokens`} keyboardType="number-pad" editable={!disabled} value={custom} onChangeText={text => {
        setCustom(text); setError('');
        const tokens = /^\d+$/.test(text.trim()) ? Number(text.trim()) : NaN;
        if (validTokenValue(tokens, min, max)) setPreview(tokens);
      }} onBlur={() => { if (!valid) setError(`Enter a whole number from ${min.toLocaleString()} to ${max.toLocaleString()}.`); }} placeholder="Custom tokens" placeholderTextColor={colors.muted} style={{ flex: 1, minWidth: 0, minHeight: 44, borderWidth: 1, borderColor: colors.border, borderRadius: CONTROL.radius, paddingHorizontal: 12, color: colors.text }} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Apply ${label.toLowerCase()}`} accessibilityHint={canApply ? 'Apply the pending value' : 'No valid unapplied change'} accessibilityState={{ disabled: !canApply }} disabled={!canApply} onPress={() => {
        if (!canApply) return;
        setError(''); onChange(draft);
      }} style={[button, { backgroundColor: canApply ? colors.primary : colors.raised }]}><Text style={{ color: canApply ? colors.onPrimary : colors.muted, ...CONTROL.label }}>Apply</Text></Pressable>
    </View>
    <Text style={{ color: colors.muted, fontSize: 12 }}>Range: {min.toLocaleString()}–{max.toLocaleString()} tokens · adjust, then Apply</Text>
    {!!error && <Text accessibilityRole="alert" style={{ color: colors.error, fontSize: 12 }}>{error}</Text>}
  </View>;
}
