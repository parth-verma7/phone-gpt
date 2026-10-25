import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';

export function NavigationDrawer({ open, onClose, onRequestClose, children }: {
  open: boolean;
  onClose: () => void;
  onRequestClose: () => void;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.84, 360);
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) setVisible(true);
    const animation = Animated.timing(progress, {
      toValue: open ? 1 : 0,
      duration: open ? 240 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      // Keep the modal mounted until the drawer has slid offscreen.
      if (finished && !open) setVisible(false);
    });
    return () => animation.stop();
  }, [open, progress]);

  return <Modal animationType="none" transparent visible={open || visible} onRequestClose={onRequestClose}>
    <View style={{ flex: 1 }}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim, opacity: progress }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close navigation menu" onPress={onClose} style={{ flex: 1 }} />
      </Animated.View>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: drawerWidth, backgroundColor: colors.background, transform: [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-drawerWidth, 0] }) }] }}>
        {children}
      </Animated.View>
    </View>
  </Modal>;
}
