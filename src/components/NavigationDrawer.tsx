import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useAppTheme } from '../theme/AppTheme';

export function NavigationDrawer({ open, onClose, onRequestClose, onExited, children }: {
  open: boolean;
  onClose: () => void;
  onRequestClose: () => void;
  onExited?: () => void;
  children: ReactNode;
}) {
  const { colors } = useAppTheme();
  const { width } = useWindowDimensions();
  const drawerWidth = Math.min(width * 0.84, 360);
  const progress = useRef(new Animated.Value(0)).current;
  const [visible, setVisible] = useState(open);
  const exitPending = useRef(false);
  const openRef = useRef(open);
  openRef.current = open;
  const onExitedRef = useRef(onExited);
  onExitedRef.current = onExited;
  const finishExit = () => {
    if (openRef.current || !exitPending.current) return;
    exitPending.current = false;
    onExitedRef.current?.();
  };

  useEffect(() => {
    if (open) { exitPending.current = true; setVisible(true); }
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

  useEffect(() => {
    if (open || visible || Platform.OS === 'ios') return;
    // Android has no Modal.onDismiss. Wait for the hidden Modal commit and a
    // native frame before allowing another Modal to be presented.
    let nextFrame: number | undefined;
    const frame = requestAnimationFrame(() => {
      nextFrame = requestAnimationFrame(finishExit);
    });
    return () => {
      cancelAnimationFrame(frame);
      if (nextFrame !== undefined) cancelAnimationFrame(nextFrame);
    };
  }, [open, visible]);

  return <Modal animationType="none" transparent visible={open || visible} onRequestClose={onRequestClose} onDismiss={finishExit}>
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
