/**
 * Today: a full-screen scene for the bird of the morning.
 * The photo comes into focus like eyes adjusting at dawn, then drifts very slowly (a gentle
 * pan and zoom), with specks of light floating up through it. The words arrive one by one
 * at the bottom, over a fade into the colour of the chosen look.
 * Everything holds still when the phone's Reduce Motion setting is on.
 */
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, Image as RNImage, Platform, Pressable, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { lastFired } from '@shared/queue';

import { Body, FadeIn, Label, TAB_BAR_HEIGHT, useTheme } from '@/components/ui';
import { birdById, photoFor } from '@/data/birds';
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

/** Slow pan-and-zoom plus a soft-focus reveal, restarted each time the tab is opened. */
function PhotoScene({ source, still, shade }: { source: number; still: boolean; shade: string }) {
  const { width, height } = useWindowDimensions();
  // Size the sharp photo to its real proportions so the edge fades line up with its edges.
  const asset = RNImage.resolveAssetSource?.(source);
  const aspect = asset?.width && asset?.height ? asset.width / asset.height : 1.5;
  const frameH = Math.min(width / aspect, height * 0.56);
  const frameW = Math.min(width, frameH * aspect);
  const fade = Math.round(frameH * 0.32);
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

  const transform = [
    { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1.16] }) },
    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-10, 12] }) },
    { translateY: drift.interpolate({ inputRange: [0, 1], outputRange: [6, -10] }) },
  ];

  // Most photos are wider than a phone screen, so cropping them to fill it can cut the bird off.
  // Instead the whole photo sits in the upper part of the screen, over a blurred, enlarged copy
  // of itself that fills the rest with the photo's own colours.
  const smallDrift = [
    { scale: drift.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] }) },
    { translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [-4, 5] }) },
  ];

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { opacity: focus.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 1, 1] }) }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { transform }]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover" blurRadius={40} />
        <View style={[StyleSheet.absoluteFill, { backgroundColor: rgba(shade, 0.62) }]} />
      </Animated.View>
      <Animated.View
        style={[styles.photoFrame, { width: frameW, height: frameH, top: height * 0.06 + Math.max(0, (height * 0.56 - frameH) / 3) }, { transform: smallDrift }]}>
        <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" />
        {/* Soft-focus copy on top that fades away as the photo "comes into focus". */}
        <Animated.View
          style={[StyleSheet.absoluteFill, { opacity: focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }) }]}>
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="contain" blurRadius={24} />
        </Animated.View>
        {/* Feather the photo's edges into the tinted blur behind it. */}
        <LinearGradient pointerEvents="none" colors={[rgba(shade, 0.85), rgba(shade, 0.3), rgba(shade, 0)]} style={[styles.edge, { top: 0, height: fade }]} />
        <LinearGradient pointerEvents="none" colors={[rgba(shade, 0), rgba(shade, 0.3), rgba(shade, 0.85)]} style={[styles.edge, { bottom: 0, height: fade }]} />
        {frameW < width && (
          <>
            <LinearGradient pointerEvents="none" start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={[rgba(shade, 0.85), rgba(shade, 0.3), rgba(shade, 0)]} style={[styles.side, { left: 0, width: fade }]} />
            <LinearGradient pointerEvents="none" start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} colors={[rgba(shade, 0), rgba(shade, 0.3), rgba(shade, 0.85)]} style={[styles.side, { right: 0, width: fade }]} />
          </>
        )}
      </Animated.View>
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

function Mote({ m, width, height, moving }: { m: (typeof MOTES)[number]; width: number; height: number; moving: boolean }) {
  const [v] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!moving) return;
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: m.secs * 1000, easing: Easing.linear, useNativeDriver: NATIVE }),
    );
    const t = setTimeout(() => loop.start(), m.delay);
    return () => {
      clearTimeout(t);
      loop.stop();
    };
  }, [v, m, moving]);
  if (!moving) return null;
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
          { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [height * 0.95, height * 0.25] }) },
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

export default function TodayScreen() {
  const { ready, queue, library } = useStore();
  const { C, ITALIC, SANS, ds, display, look } = useTheme();
  const { width, height } = useWindowDimensions();
  const still = useReduceMotion();
  if (!ready) return <View style={{ flex: 1 }} />;

  // The bird that actually woke you, if an alarm has rung; otherwise a bird of the day.
  const woke = birdById(lastFired(queue)?.birdId);
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const bird = woke ?? library[dayNumber % library.length]!;
  const photo = photoFor(bird.id);
  const shade = look.onFill;
  const textShadow = { textShadowColor: 'rgba(0,0,0,0.45)', textShadowRadius: 12, textShadowOffset: { width: 0, height: 1 } };

  return (
    <View style={{ flex: 1 }}>
      {photo && <PhotoScene key={bird.id} source={photo.source} still={still} shade={shade} />}
      {/* Fade from the photo into the look's darkest colour, so the words sit on calm ground. */}
      <LinearGradient
        pointerEvents="none"
        colors={[rgba(shade, 0.3), rgba(shade, 0), rgba(shade, 0), rgba(shade, 0.8), rgba(shade, 0.97)]}
        locations={[0, 0.12, 0.5, 0.68, 0.88]}
        style={StyleSheet.absoluteFill}
      />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {MOTES.map((m, i) => (
          <Mote key={i} m={m} width={width} height={height} moving={!still} />
        ))}
      </View>

      <SafeAreaView style={{ flex: 1 }} edges={['top', 'left', 'right']}>
        {photo && (
          <FadeIn delay={2400} style={styles.creditWrap}>
            <Text style={[styles.credit, { color: C.faint, fontFamily: SANS }]} numberOfLines={1}>
              Photo: {photo.credit.artist}, {photo.credit.license}
            </Text>
          </FadeIn>
        )}

        <View style={styles.words}>
          <FadeIn delay={700}>
            <Label style={textShadow}>{woke ? 'Who woke you up' : "Today's bird"}</Label>
          </FadeIn>
          <FadeIn delay={1200}>
            <Text style={[styles.name, { color: C.text, lineHeight: ds(52) + 6 }, display(52), textShadow]}>
              {bird.commonName}
            </Text>
            <Text style={[styles.sci, { color: C.dim, fontFamily: ITALIC }, textShadow]}>{bird.scientificName}</Text>
          </FadeIn>
          <FadeIn delay={2000}>
            <Body style={[styles.fact, { color: C.text, opacity: 0.86 }]}>{bird.fact}</Body>
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
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  photoFrame: { position: 'absolute', alignSelf: 'center' },
  edge: { position: 'absolute', left: 0, right: 0 },
  side: { position: 'absolute', top: 0, bottom: 0 },
  creditWrap: { alignItems: 'flex-end', paddingHorizontal: 20, paddingTop: 8 },
  credit: { fontSize: 10, maxWidth: 280 },
  words: {
    flex: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 28,
    paddingBottom: TAB_BAR_HEIGHT + 36,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  name: { marginTop: 10 },
  sci: { fontSize: 17, marginTop: 6 },
  fact: { marginTop: 18, maxWidth: 420 },
  playRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 28 },
  playWrap: { width: 60, height: 60, alignItems: 'center', justifyContent: 'center' },
  breath: { position: 'absolute', width: 60, height: 60, borderRadius: 30, borderWidth: 1 },
  play: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
});
