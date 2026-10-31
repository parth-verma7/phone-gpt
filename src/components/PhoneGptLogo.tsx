import { Image } from 'react-native';

export function PhoneGptLogo({ size = 48 }: { size?: number }) {
  return <Image accessible={false} source={require('../../assets-phonegpt-icon.png')} resizeMode="contain" style={{ width: size, height: size, borderRadius: size * 0.22 }} />;
}
