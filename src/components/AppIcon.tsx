import Svg, { Path } from 'react-native-svg';

export type AppIconName = 'home' | 'chat' | 'models' | 'settings' | 'info' | 'menu' | 'close' | 'arrow' | 'up' | 'chevron' | 'shield' | 'download' | 'check' | 'trash' | 'moon' | 'text' | 'plus' | 'pause' | 'play' | 'stop' | 'search';
const paths: Record<AppIconName, string> = {
  stop: 'M6 6h12v12H6V6Z',
  search: 'M10.5 3a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15Zm5.5 13 5 5',
  plus: 'M12 5v14M5 12h14',
  pause: 'M8 5v14M16 5v14',
  play: 'm8 4 12 8-12 8V4Z',
  download: 'M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5',
  check: 'm5 12 4 4L19 6',
  trash: 'M3 6h18M9 6V3h6v3M6 6l1 15h10l1-15M10 10v7M14 10v7',
  moon: 'M21 13a9 9 0 0 1-10-10A9 9 0 1 0 21 13Z',
  text: 'M4 5h16M12 5v15M8 20h8',
  home: 'M3 10 12 3l9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H8l-5 2V11.5a9 9 0 0 1 18 0ZM8 10h8M8 14h5',
  models: 'm12 3 9 5-9 5-9-5 9-5ZM3 12l9 5 9-5M3 16l9 5 9-5',
  settings: 'M4 6h16M4 12h16M4 18h16M8 3v6M16 9v6M9 15v6',
  info: 'M12 8h.01M12 11v6M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  close: 'm6 6 12 12M6 18 18 6',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  up: 'M12 20V4m-6 6 6-6 6 6',
  chevron: 'm6 9 6 6 6-6',
  shield: 'm12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Zm-4 9 3 3 5-6',
};
export function AppIcon({ name, color, size = 22 }: { name: AppIconName; color: string; size?: number }) {
  return <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" accessible={false}>
    <Path d={paths[name]} stroke={color} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}
