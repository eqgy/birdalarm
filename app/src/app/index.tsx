/**
 * Today: a full-screen, scrollable scene for the bird of the morning.
 *
 * - A tall photo fills the top of the screen. It comes into focus like eyes adjusting at dawn,
 *   then drifts in a very slow pan and zoom. Its bottom melts into the page's solid colour,
 *   so there is no hard edge.
 * - The name and fact sit over that fade. Scrolling slides the page up over the photo
 *   (the photo moves slower, for depth) into more about the bird: what to listen for,
 *   where to look, its size and its family.
 * - Specks of light float up through the scene. Everything holds still with Reduce Motion.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, type ScrollViewInstance, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lastFired } from '@shared/queue';

import { Body, FadeIn, Label, TAB_BAR_HEIGHT, useTheme } from '@/components/ui';
import { birdById, photoFor, type LibraryBird } from '@/data/birds';
import { useStore } from '@/state/store';

const NATIVE = Platform.OS !== 'web';

function useReduceMotion() {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduce).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => sub.remove();
  }, []);
  return reduce;
}

function rgba(hex: string, alpha: number) {
  const n = parseInt(hex.replace('#', ''), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}

/** The photo: soft-focus reveal plus a slow pan and zoom, restarted each time the tab opens. */
function PhotoHeader({
  source, focusX, still, shade, height, scrollY,
}: { source: number; focusX: number; still: boolean; shade: string; height: number; scrollY: Animated.Value }) {
  // Aim the crop at the bird: most photos are wider than this frame.
  const position = { left: `${Math.round(focusX * 100)}%`, top: '50%' } as const;
  const [drift] = useState(() => new Animated.Value(0));
  const [focus] = useState(() => new Animated.Value(0));

  useFocusEffect(
    useCallback(() => {
      focus.setValue(still ? 1 : 0);
      drift.setValue(0);
      if (still) return;
      const reveal = Animated.timing(focus, {
        toValue: 1, duration: 2600, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE,
      });
      const pan = Animated.loop(
        Animated.sequence([
          Animated.timing(drift, { toValue: 1, duration: 32000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
          Animated.timing(drift, { toValue: 0, duration: 32000, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        ]),
      );
      reveal.start();
      pan.start();
      return () => {
        reveal.stop();
        pan.stop();
      };
    }, [drift, focus, still]),
  );

  // Parallax: the photo moves up at 40% of the scroll speed, and stretches if you pull down.
  const parallax = [
    { translateY: scrollY.interpolate({ inputRange: [-200, 0, height], outputRange: [0, 0, -height * 0.4], extrapolateRight: 'clamp' }) },
    { scale: scrollY.interpolate({ inputRange: [-200, 0], outputRange: [1.35, 1], extrapolate: 'clamp' }) },
  ];
  const kenBurns = [
    { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.12] }) },
    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-8, 10] }) },
    { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [4, -8] }) },
  ];

  return (
    <Animated.View
      style={[
        styles.header,
        // Dim the photo as the page scrolls over it, so the text stays readable.
        { height, transform: parallax, opacity: scrollY.interpolate({ inputRange: [0, height * 0.6], outputRange: [1, 0.22], extrapolate: 'clamp' }) },
      ]}
      pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { overflow: 'hidden', opacity: focus.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }) }]}>
        <Animated.View style={[StyleSheet.absoluteFill, { transform: kenBurns }]}>
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={position} />
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
            <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition={position} blurRadius={24} />
          </Animated.View>
        </Animated.View>
      </Animated.View>
      {/* Top: darken behind the status bar. Bottom: a long fade that ends in exactly the page colour. */}
      <LinearGradient colors={[rgba(shade, 0.55), rgba(shade, 0)]} style={[styles.fade, { top: 0, height: height * 0.22 }]} />
      <LinearGradient
        colors={[rgba(shade, 0), rgba(shade, 0.35), rgba(shade, 0.8), rgba(shade, 1)]}
        locations={[0, 0.35, 0.7, 1]}
        style={[styles.fade, { bottom: -1, height: height * 0.55 }]}
      />
    </Animated.View>
  );
}

// Specks of light drifting upward, like dust in early sun. Fixed layout so they don't jump.
const MOTES = Array.from({ length: 16 }, (_, i) => {
  const r = (n: number) => {
    const x = Math.sin((i + 1) * n) * 10000;
    return x - Math.floor(x);
  };
  return { x: r(12.9898), size: 2 + r(39.42) * 3, secs: 18 + r(7.13) * 16, delay: r(3.7) * 14000, sway: 8 + r(5.1) * 18 };
});

function Mote({ m, width, height }: { m: (typeof MOTES)[number]; width: number; height: number }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: m.secs * 1000, easing: Easing.linear, useNativeDriver: NATIVE }),
    );
    const t = setTimeout(() => loop.start(), m.delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, m]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: m.x * width,
        top: 0,
        width: m.size,
        height: m.size,
        borderRadius: m.size,
        backgroundColor: '#fff6e0',
        opacity: v.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.55, 0.35, 0] }),
        transform: [
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [height * 0.95, height * 0.2] }) },
          { translateX: v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, m.sway, 0] }) },
        ],
      }}
    />
  );
}

/** A slow ring that breathes around the play button. */
function Breath({ color, still }: { color: string; still: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 4200, easing: Easing.out(Easing.quad), useNativeDriver: NATIVE }),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  if (still) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.breath,
        {
          borderColor: color,
          opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
          transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.7] }) }],
        },
      ]}
    />
  );
}

/** "More about the ..." hint that bobs gently, and scrolls the page when tapped. */
function MoreHint({ bird, still, onPress }: { bird: LibraryBird; still: boolean; onPress: () => void }) {
  const { C, SANS } = useTheme();
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (still) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
        Animated.timing(v, { toValue: 0, duration: 1400, easing: Easing.inOut(Easing.sin), useNativeDriver: NATIVE }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [v, still]);
  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" style={styles.more}>
      <Text style={{ color: C.dim, fontFamily: SANS, fontSize: 13 }}>More about the {bird.commonName}</Text>
      <Animated.Text
        style={{ color: C.dim, fontSize: 16, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }}>
        ↓
      </Animated.Text>
    </Pressable>
  );
}

function Section({ title, children }: { title: string; children: string }) {
  const { C } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: C.line }]}>
      <Label>{title}</Label>
      <Body style={{ color: C.text, opacity: 0.88, marginTop: 8 }}>{children}</Body>
    </View>
  );
}

export default function TodayScreen() {
  const { ready, queue, library } = useStore();
  const { C, ITALIC, SANS, ds, display, look } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  const scrollY = useRef(new Animated.Value(0)).current;
  const scroller = useRef<ScrollViewInstance>(null);
  const [detailsY, setDetailsY] = useState(0);
  if (!ready) return <View style={{ flex: 1 }} />;

  // The bird that actually woke you, if an alarm has rung; otherwise a bird of the day.
  const woke = birdById(lastFired(queue)?.birdId);
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const bird = woke ?? library[dayNumber % library.length]!;
  const photo = photoFor(bird.id);
  const shade = look.onFill;
  const textShadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } };

  // Tall, portrait-leaning photo: up to 1.3x as tall as it is wide, at most 64% of the screen.
  const headerH = photo ? Math.min(width * 1.3, height * 0.64) : height * 0.3;
  const spacer = headerH * 0.72;

  return (
    <View style={{ flex: 1, backgroundColor: shade }}>
      {photo && <PhotoHeader key={bird.id} source={photo.source} focusX={photo.credit.focusX ?? 0.5} still={still} shade={shade} height={headerH} scrollY={scrollY} />}

      <Animated.ScrollView
        ref={scroller}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: NATIVE })}
        contentContainerStyle={{ paddingBottom: TAB_BAR_HEIGHT + insets.bottom + 40 }}>
        {/* Let the photo show through; the words start over its fade. */}
        <View style={{ height: spacer }} />

        <View style={styles.words}>
          <FadeIn delay={700}>
            <Label style={textShadow}>{woke ? 'Who woke you up' : "Today's bird"}</Label>
          </FadeIn>
          <FadeIn delay={1200}>
            <Text style={[styles.name, { color: C.text, lineHeight: ds(50) + 6 }, display(50), textShadow]}>
              {bird.commonName}
            </Text>
            <Text style={[styles.sci, { color: C.dim, fontFamily: ITALIC }, textShadow]}>{bird.scientificName}</Text>
          </FadeIn>
          <FadeIn delay={2000}>
            <Body style={[styles.fact, { color: C.text, opacity: 0.88 }]}>{bird.fact}</Body>
          </FadeIn>
          <FadeIn delay={2800} style={styles.playRow}>
            <View style={styles.playWrap}>
              <Breath color={C.text} still={still} />
              <Pressable
                disabled
                accessibilityLabel="Play recording (not available yet)"
                style={[styles.play, { borderColor: C.dim, backgroundColor: rgba(shade, 0.35) }]}>
                <View style={[styles.triangle, { borderLeftColor: C.text }]} />
              </Pressable>
            </View>
            <Text style={[styles.note, { color: C.faint, fontFamily: SANS }]}>Song coming with the{'\n'}audio library</Text>
          </FadeIn>
          <FadeIn delay={3400}>
            <MoreHint
              bird={bird}
              still={still}
              onPress={() => scroller.current?.scrollTo({ y: Math.max(0, detailsY - insets.top - 24), animated: true })}
            />
          </FadeIn>

          <View onLayout={(e) => setDetailsY(e.nativeEvent.layout.y + spacer)} style={styles.details}>
            {bird.listen && <Section title="Listen for">{bird.listen}</Section>}
            {bird.habitat && <Section title="Where to look">{bird.habitat}</Section>}
            {bird.size && <Section title="Size">{bird.size}</Section>}
            {bird.family && <Section title="Family">{bird.family}</Section>}
            {photo && (
              <Text style={[styles.credit, { color: C.faint, fontFamily: SANS }]}>
                Photo: {photo.credit.artist}, {photo.credit.license}, via Wikimedia Commons
              </Text>
            )}
          </View>
        </View>
      </Animated.ScrollView>

      {!still && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {MOTES.map((m, i) => (
            <Mote key={i} m={m} width={width} height={height} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { position: 'absolute', top: 0, left: 0, right: 0 },
  fade: { position: 'absolute', left: 0, right: 0 },
  words: { paddingHorizontal: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  name: { marginTop: 10 },
  sci: { fontSize: 17, marginTop: 6 },
  fact: { marginTop: 18, maxWidth: 420 },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 26 },
  playWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  breath: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1 },
  play: { width: 60, height: 60, borderRadius: 30, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  triangle: {
    marginLeft: 5,
    width: 0,
    height: 0,
    borderTopWidth: 9,
    borderBottomWidth: 9,
    borderLeftWidth: 15,
    borderTopColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  note: { fontSize: 12, lineHeight: 17 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 34, paddingVertical: 8 },
  details: { marginTop: 28 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 20 },
  credit: { fontSize: 11, lineHeight: 16, marginTop: 12 },
});
