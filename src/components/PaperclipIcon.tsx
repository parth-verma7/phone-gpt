import { useAppTheme } from '../theme/AppTheme';
import Svg, { Path } from 'react-native-svg';

export function PaperclipIcon() {
  const { colors } = useAppTheme();
  return <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" accessible={false}>
    <Path
      d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l10-10a4 4 0 0 1 5.66 5.66l-10 10a2 2 0 0 1-2.83-2.83l9.19-9.19"
      stroke={colors.secondary}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </Svg>;
}
