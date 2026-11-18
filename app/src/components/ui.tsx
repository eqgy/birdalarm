import * as Haptics from 'expo-haptics';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type GestureResponderEvent, type PressableProps, type StyleProp, type TextProps, type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useStore } from '@/state/store';
import { themeFor, type Theme } from '@/theme';

export const TAB_BAR_HEIGHT = 64;
const NATIVE = Platform.OS !== 'web';

/** Fonts and colours for the look chosen in Settings. */
export function useTheme(): Theme {
  const { look, type } = useStore().settings;
  return useMemo(() => themeFor(look, type), [look, type]);
}

/** Slow fade-and-rise, replayed every time the screen comes into focus. */
export function FadeIn({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const [v] = useState(() => new Animated.Value(0));
  useFocusEffect(
    useCallback(() => {
      v.setValue(0);
      const anim = Animated.timing(v, {
        toValue: 1,
        duration: 1100,
        delay,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: NATIVE,
      });
      anim.start();
      return () => anim.stop();
    }, [v, delay]),
  );
  return (
    <Animated.View
      style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** Page wrapper. The sky itself lives in the root layout so it keeps drifting between screens. */
export function Screen({ children, scroll = true, animate = true }: { children: ReactNode; scroll?: boolean; animate?: boolean }) {
  const body = scroll ? (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.content, { flex: 1 }]}>{children}</View>
  );
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
      {animate ? <FadeIn style={{ flex: 1 }}>{body}</FadeIn> : body}
    </SafeAreaView>
  );
}

export function Title(props: TextProps) {
  const { C, display } = useTheme();
  return <Text {...props} style={[{ color: C.text, marginBottom: 24 }, display(30), props.style]} />;
}
export function Label(props: TextProps) {
  const { C, LABEL } = useTheme();
  return (
    <Text
      {...props}
      style={[{ color: C.faint, fontFamily: LABEL, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }, props.style]}
    />
  );
}
export function Body(props: TextProps) {
  const { C, SANS } = useTheme();
  return <Text {...props} style={[{ color: C.dim, fontFamily: SANS, fontSize: 16, lineHeight: 24 }, props.style]} />;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const NATIVE_DRIVER = Platform.OS !== 'web';

/** A light tap you can feel. Does nothing where haptics aren't available (web). */
export function tapFeedback() {
  if (Platform.OS === 'web') return;
  Haptics.selectionAsync().catch(() => {});
}

/**
 * Every button in the app. On touch it eases down to 96% and dims a little, then springs
 * back on release, with a light haptic tap on press. Takes the same props as Pressable,
 * except that `style` must be a plain style (not a function).
 */
export function Press({
  style, children, onPress, onPressIn, onPressOut, haptic = true, depth = 0.96, ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
  /** Tap the Taptic Engine on press. */
  haptic?: boolean;
  /** How far it shrinks while held, 1 = not at all. */
  depth?: number;
}) {
  const [v] = useState(() => new Animated.Value(0));
  const go = (to: number) =>
    Animated.spring(v, { toValue: to, useNativeDriver: NATIVE_DRIVER, speed: to ? 50 : 18, bounciness: to ? 0 : 7 }).start();
  return (
    <AnimatedPressable
      {...rest}
      onPressIn={(e: GestureResponderEvent) => {
        go(1);
        onPressIn?.(e);
      }}
      onPressOut={(e: GestureResponderEvent) => {
        go(0);
        onPressOut?.(e);
      }}
      onPress={(e: GestureResponderEvent) => {
        if (haptic) tapFeedback();
        onPress?.(e);
      }}
      style={[
        style,
        {
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [1, 0.72] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, depth] }) }],
        },
      ]}>
      {children}
    </AnimatedPressable>
  );
}

export function Row({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const { C } = useTheme();
  const inner = <View style={[styles.row, { borderBottomColor: C.line }]}>{children}</View>;
  return onPress ? (
    <Press onPress={onPress} depth={0.985}>
      {inner}
    </Press>
  ) : (
    inner
  );
}

/** On/off switch: the knob glides across and the track fades between colours. */
export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { C } = useTheme();
  const [v] = useState(() => new Animated.Value(value ? 1 : 0));
  useEffect(() => {
    Animated.spring(v, { toValue: value ? 1 : 0, useNativeDriver: false, speed: 16, bounciness: 6 }).start();
  }, [v, value]);
  return (
    <Press
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      hitSlop={10}
      depth={0.92}
      style={styles.toggleHit}>
      <Animated.View
        style={[styles.toggle, { backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [C.fill, C.fillOn] }) }]}>
        <Animated.View
          style={[
            styles.knob,
            {
              backgroundColor: v.interpolate({ inputRange: [0, 1], outputRange: [C.dim, C.onFill] }),
              transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 18] }) }],
            },
          ]}
        />
      </Animated.View>
    </Press>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 28,
    paddingTop: 24,
    paddingBottom: TAB_BAR_HEIGHT + 48,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  toggleHit: { borderRadius: 14 },
  toggle: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11 },
});
