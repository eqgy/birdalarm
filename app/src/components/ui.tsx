import { useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View,
  type StyleProp, type TextProps, type ViewStyle,
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

export function Row({ children, onPress }: { children: ReactNode; onPress?: () => void }) {
  const { C } = useTheme();
  const inner = <View style={[styles.row, { borderBottomColor: C.line }]}>{children}</View>;
  return onPress ? (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { opacity: 0.6 }}>
      {inner}
    </Pressable>
  ) : (
    inner
  );
}

export function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  const { C } = useTheme();
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value }}
      accessibilityLabel={label}
      onPress={() => onChange(!value)}
      hitSlop={10}
      style={[styles.toggle, { backgroundColor: value ? C.fillOn : C.fill }]}>
      <View style={[styles.knob, value ? { alignSelf: 'flex-end', backgroundColor: C.onFill } : { backgroundColor: C.dim }]} />
    </Pressable>
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
  toggle: { width: 46, height: 28, borderRadius: 14, padding: 3, justifyContent: 'center' },
  knob: { width: 22, height: 22, borderRadius: 11 },
});
