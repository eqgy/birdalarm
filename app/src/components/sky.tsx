/**
 * The moving sky behind every screen: a gradient for the time of day, a slowly breathing
 * glow near the horizon, drifting cloud, and twinkling stars at night.
 * It is a mood, not a forecast: no network, no location.
 */
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTheme } from '@/components/ui';
import { phaseFor, type Phase } from '@/theme';

const NATIVE = Platform.OS !== 'web';

// How strong each layer is at each time of day. Colours come from the chosen look.
const PHASES: Record<Phase, { glowStrength: number; stars: number; cloud: number }> = {
  dawn: { glowStrength: 0.3, stars: 0.25, cloud: 1 },
  day: { glowStrength: 0.18, stars: 0, cloud: 1 },
  dusk: { glowStrength: 0.26, stars: 0.4, cloud: 0.8 },
  night: { glowStrength: 0.14, stars: 1, cloud: 0.45 },
};

/** A soft-edged blob built from nested translucent ellipses (React Native has no blur on iOS). */
function Soft({ w, h, rgb, alpha, steps = 7 }: { w: number; h: number; rgb: string; alpha: number; steps?: number }) {
  return (
    <View style={{ width: w, height: h, alignItems: 'center', justifyContent: 'center' }}>
      {Array.from({ length: steps }, (_, i) => {
        const f = 1 - i / steps;
        return (
          <View
            key={i}
            style={{
              position: 'absolute',
              width: w * f,
              height: h * f,
              borderRadius: (h * f) / 2,
              backgroundColor: `rgba(${rgb},${alpha / steps})`,
            }}
          />
        );
      })}
    </View>
  );
}

function useLoop(duration: number, moving: boolean, pingPong = false, delay = 0) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!moving) return;
    const to = (toValue: number) =>
      Animated.timing(v, {
        toValue,
        duration,
        easing: pingPong ? Easing.inOut(Easing.sin) : Easing.linear,
        useNativeDriver: NATIVE,
      });
    const loop = Animated.loop(pingPong ? Animated.sequence([to(1), to(0)]) : to(1));
    const timer = setTimeout(() => loop.start(), delay);
    return () => {
      clearTimeout(timer);
      loop.stop();
    };
  }, [v, duration, moving, pingPong, delay]);
  return v;
}

const CLOUDS = [
  { top: 0.12, w: 1.5, h: 150, secs: 140, start: 0.1, alpha: 0.16 },
  { top: 0.34, w: 1.9, h: 200, secs: 210, start: 0.55, alpha: 0.12 },
  { top: 0.58, w: 1.3, h: 130, secs: 170, start: 0.8, alpha: 0.14 },
];

function Cloud({ c, width, height, moving, strength }: {
  c: (typeof CLOUDS)[number]; width: number; height: number; moving: boolean; strength: number;
}) {
  const v = useLoop(c.secs * 1000, moving);
  const w = width * c.w;
  // Start part-way across so the sky isn't empty at launch, then wrap around.
  const from = -w + (width + w) * c.start;
  const translateX = v.interpolate({
    inputRange: [0, 1 - c.start, 1 - c.start + 0.0001, 1],
    outputRange: [from, width, -w, from],
  });
  return (
    <Animated.View style={{ position: 'absolute', top: height * c.top, left: 0, transform: [{ translateX }] }}>
      <Soft w={w} h={c.h} rgb="255,255,255" alpha={c.alpha * strength} />
    </Animated.View>
  );
}

// Fixed star positions (fractions of the screen), so they don't jump between renders.
const STARS = Array.from({ length: 34 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * n) * 10000;
    return x - Math.floor(x);
  };
  return { x: r(12.9898), y: r(78.233) * 0.62, size: 1 + r(39.425) * 1.6, group: i % 3 };
});

function Stars({ width, height, moving, strength }: { width: number; height: number; moving: boolean; strength: number }) {
  const twinkles = [useLoop(4200, moving, true), useLoop(5600, moving, true, 900), useLoop(7100, moving, true, 1800)];
  return (
    <>
      {STARS.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: s.x * width,
            top: s.y * height,
            width: s.size,
            height: s.size,
            borderRadius: s.size,
            backgroundColor: '#fff',
            opacity: twinkles[s.group]!.interpolate({ inputRange: [0, 1], outputRange: [0.2 * strength, 0.85 * strength] }),
          }}
        />
      ))}
    </>
  );
}

export function Sky() {
  const { width, height } = useWindowDimensions();
  const [hour, setHour] = useState(() => new Date().getHours());
  const [moving, setMoving] = useState(true);
  const theme = useTheme();

  useEffect(() => {
    const t = setInterval(() => setHour(new Date().getHours()), 60_000);
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => setMoving(!reduce)).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', (reduce) => setMoving(!reduce));
    return () => {
      clearInterval(t);
      sub.remove();
    };
  }, []);

  const phase = phaseFor(hour);
  const look = { ...PHASES[phase], ...theme.look.sky[phase] };
  const breath = useLoop(9000, moving, true);
  const glowSize = Math.max(width, 420) * 1.5;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <LinearGradient colors={look.stops} style={StyleSheet.absoluteFill} />
      {look.stars > 0 && <Stars width={width} height={height} moving={moving} strength={look.stars} />}
      <Animated.View
        style={{
          position: 'absolute',
          left: (width - glowSize) / 2,
          top: height - glowSize * 0.42,
          opacity: breath.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
          transform: [{ scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }],
        }}>
        <Soft w={glowSize} h={glowSize} rgb={look.glow} alpha={look.glowStrength} steps={10} />
      </Animated.View>
      {CLOUDS.map((c, i) => (
        <Cloud key={i} c={c} width={width} height={height} moving={moving} strength={look.cloud} />
      ))}
    </View>
  );
}
