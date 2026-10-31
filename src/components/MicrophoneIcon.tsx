import Svg, { Path, Rect } from 'react-native-svg';

export function MicrophoneIcon({ color, stop = false }: { color: string; stop?: boolean }) {
  return <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
    {stop ? <Rect x={5} y={5} width={14} height={14} rx={2} fill={color} /> : <>
      <Rect x={9} y={2} width={6} height={13} rx={3} stroke={color} strokeWidth={1.8} />
      <Path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </>}
  </Svg>;
}
