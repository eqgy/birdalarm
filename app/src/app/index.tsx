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
import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect, useLocalSearchParams, useNavigation } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo, Animated, Easing, type ScrollViewInstance, Platform, StyleSheet, Text, View, useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { lastFired } from '@shared/queue';

import { Body, FadeIn, Label, TAB_BAR_HEIGHT, useTheme, Press } from '@/components/ui';
import { birdById, birdByName, birdOfDay, familyMates, localDateKey, lookalikePhoto, photoFor, recordingFor, type LibraryBird } from '@/data/birds';
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
        // Dark well before the words start, so they never sit on bright photo.
        colors={[rgba(shade, 0), rgba(shade, 0.55), rgba(shade, 0.88), rgba(shade, 1)]}
        locations={[0, 0.3, 0.6, 1]}
        style={[styles.fade, { bottom: -1, height: height * 0.5 }]}
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
    <Press onPress={onPress} hitSlop={12} accessibilityRole="button" style={styles.more}>
      <Text style={{ color: C.dim, fontFamily: SANS, fontSize: 13 }}>More about the {bird.commonName}</Text>
      <Animated.Text
        style={{ color: C.dim, fontSize: 16, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, 4] }) }] }}>
        ↓
      </Animated.Text>
    </Press>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const { C } = useTheme();
  return (
    <View style={[styles.section, { borderTopColor: C.line }]}>
      <Label>{title}</Label>
      <View style={{ marginTop: 8 }}>
        {typeof children === 'string' ? <Body style={{ color: C.text, opacity: 0.88 }}>{children}</Body> : children}
      </View>
    </View>
  );
}

/** A rounded tag. With onPress it links to another bird. */
function Chip({ children, onPress }: { children: string; onPress?: () => void }) {
  const { C, SANS } = useTheme();
  const text = <Text style={{ color: onPress ? C.text : C.dim, fontFamily: SANS, fontSize: 13 }}>{children}{onPress ? '  →' : ''}</Text>;
  const style = [styles.chip, { borderColor: onPress ? C.dim : C.line }];
  return onPress ? (
    <Press onPress={onPress} accessibilityRole="link" hitSlop={4} style={style}>{text}</Press>
  ) : (
    <View style={style}>{text}</View>
  );
}

const MONTHS = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

/** Twelve cells, January to December, brighter in the months the bird is around. */
function MonthBar({ months, caption }: { months: string; caption: string }) {
  const { C, LABEL } = useTheme();
  const now = new Date().getMonth();
  return (
    <View accessibilityLabel={`${caption}: ${seasonWords(months)}`}>
      <View style={styles.months}>
        {MONTHS.map((m, i) => {
          const level = months[i];
          return (
            <View key={i} style={{ flex: 1, alignItems: 'center', gap: 6 }}>
              <View style={[styles.month, { backgroundColor: C.text, opacity: level === '2' ? 0.75 : level === '1' ? 0.32 : 0.07 }]} />
              <Text style={{ color: i === now ? C.text : C.faint, fontFamily: LABEL, fontSize: 10 }}>{m}</Text>
              <View style={[styles.nowDot, i === now && { backgroundColor: C.text }]} />
            </View>
          );
        })}
      </View>
      <Text style={{ color: C.faint, fontFamily: LABEL, fontSize: 10, marginTop: 4 }}>{caption.toUpperCase()}</Text>
    </View>
  );
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function seasonWords(months: string) {
  if (!months.includes('0')) return 'all year';
  return `mostly ${MONTH_NAMES.filter((_, i) => months[i] === '2').join(', ')}`;
}

function RoundPhoto({ source, focusX, size }: { source?: number; focusX?: number; size: number }) {
  const { C } = useTheme();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', backgroundColor: C.fill }}>
      {source && (
        <Image source={source} style={{ width: size, height: size }} contentFit="cover"
          contentPosition={{ left: `${Math.round((focusX ?? 0.5) * 100)}%`, top: '50%' }} transition={300} />
      )}
    </View>
  );
}

/** A square photo with the bird's name under it; a link when it's a library bird. */
function ThumbCard({ source, focusX, name, onPress }: { source?: number; focusX?: number; name: string; onPress?: () => void }) {
  const { C, SANS } = useTheme();
  const body = (
    <>
      <View style={[styles.thumb, { backgroundColor: C.fill }]}>
        {source && (
          <Image source={source} style={StyleSheet.absoluteFill} contentFit="cover"
            contentPosition={{ left: `${Math.round((focusX ?? 0.5) * 100)}%`, top: '50%' }} transition={300} />
        )}
      </View>
      <Text numberOfLines={2} style={{ color: C.text, fontFamily: SANS, fontSize: 13, marginTop: 8, textDecorationLine: onPress ? 'underline' : 'none' }}>
        {name}{onPress ? ' →' : ''}
      </Text>
    </>
  );
  return onPress ? (
    <Press onPress={onPress} accessibilityRole="link" style={{ flex: 1 }}>{body}</Press>
  ) : (
    <View style={{ flex: 1 }}>{body}</View>
  );
}

// Typical length in cm for each size class, and the three reference birds.
const SIZE_CM: Record<string, number> = {
  'Smaller than a sparrow': 12, 'About the size of a sparrow': 15, 'Between a sparrow and a robin': 20,
  'About the size of a robin': 25, 'Between a robin and a crow': 33, 'About the size of a crow': 45,
};
const REFERENCES = [{ name: 'Sparrow', cm: 15 }, { name: 'Robin', cm: 25 }, { name: 'Crow', cm: 45 }];

/** Circles sized by body length: sparrow, robin and crow outlines, with this bird's photo slotted in. */
function SizeScale({ size, source, focusX }: { size: string; source?: number; focusX?: number }) {
  const { C, LABEL } = useTheme();
  const cm = SIZE_CM[size];
  if (!cm) return null;
  const px = (n: number) => n * 2.1;
  const items = [
    ...REFERENCES.filter((r) => r.cm !== cm).map((r) => ({ ...r, self: false })),
    { name: 'This bird', cm: cm + 0.1, self: true },
  ].sort((a, b) => a.cm - b.cm);
  return (
    <View style={styles.scale} accessibilityLabel={size}>
      {items.map((it) => (
        <View key={it.name} style={{ alignItems: 'center', gap: 8 }}>
          {it.self ? (
            <View style={{ borderWidth: 2, borderColor: C.text, borderRadius: px(it.cm) }}>
              <RoundPhoto source={source} focusX={focusX} size={px(it.cm)} />
            </View>
          ) : (
            <View style={{ width: px(it.cm), height: px(it.cm), borderRadius: px(it.cm), borderWidth: 1, borderStyle: 'dashed', borderColor: C.dim }} />
          )}
          <Text style={{ color: it.self ? C.text : C.faint, fontFamily: LABEL, fontSize: 10 }}>{it.name.toUpperCase()}</Text>
        </View>
      ))}
    </View>
  );
}

/** Play button for the bird's song, with the recordist credit beside it. */
function SongPlayer({ bird, shade, still }: { bird: LibraryBird; shade: string; still: boolean }) {
  const { C, SANS } = useTheme();
  const rec = recordingFor(bird.id);
  const player = useAudioPlayer(rec?.source ?? null);
  const status = useAudioPlayerStatus(player);
  // Play even with the ring switch on silent, like the alarm would.
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => {});
  }, []);
  // Stop when you leave the page.
  useFocusEffect(useCallback(() => () => player.pause(), [player]));
  const playing = status.playing;
  const toggle = () => {
    if (playing) return player.pause();
    if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.2)) player.seekTo(0);
    player.play();
  };
  const progress = status.duration > 0 ? Math.min(1, status.currentTime / status.duration) : 0;
  return (
    <View style={styles.playRow}>
      <View style={styles.playWrap}>
        <Breath color={C.text} still={still || !rec || playing} />
        <Press
          disabled={!rec}
          onPress={toggle}
          accessibilityLabel={rec ? (playing ? 'Pause song' : `Play the ${bird.commonName}'s song`) : 'No recording yet'}
          depth={0.9}
          style={[styles.play, { borderColor: C.dim, backgroundColor: rgba(shade, 0.35), opacity: rec ? 1 : 0.4 }]}>
          {playing ? (
            <View style={styles.pause}>
              <View style={[styles.pauseBar, { backgroundColor: C.text }]} />
              <View style={[styles.pauseBar, { backgroundColor: C.text }]} />
            </View>
          ) : (
            <View style={[styles.triangle, { borderLeftColor: C.text }]} />
          )}
        </Press>
      </View>
      <View style={{ flex: 1 }}>
        {rec ? (
          <>
            <Text style={[styles.note, { color: C.dim, fontFamily: SANS }]}>
              {playing ? 'Listening…' : 'Hear its song'}
            </Text>
            <View style={[styles.track, { backgroundColor: C.line }]}>
              <View style={[styles.trackFill, { backgroundColor: C.text, width: `${progress * 100}%` }]} />
            </View>
            <Text style={[styles.note, { color: C.faint, fontFamily: SANS, marginTop: 6 }]}>
              {rec.recordist} · {rec.xcNumber} · {rec.licenseFull}
            </Text>
          </>
        ) : (
          <Text style={[styles.note, { color: C.faint, fontFamily: SANS }]}>No recording for this bird yet</Text>
        )}
      </View>
    </View>
  );
}

export default function TodayScreen() {
  const { ready, queue, library, settings } = useStore();
  const params = useLocalSearchParams<{ bird?: string }>();
  const navigation = useNavigation();
  // Leaving the tab forgets the opened bird, so Today shows today's bird when you come back.
  useFocusEffect(
    useCallback(() => () => navigation.setParams({ bird: undefined } as never), [navigation]),
  );
  const [today] = useState(() => localDateKey());
  if (!ready) return <View style={{ flex: 1 }} />;

  // The bird that actually woke you, if an alarm has rung; otherwise a bird of the day.
  const woke = birdById(lastFired(queue)?.birdId);
  const todays = woke ?? birdOfDay(today, library, settings.blocked);
  // A bird opened from the Birds list or a link on this page.
  const picked = birdById(params.bird);
  const bird = picked ?? todays;
  const label = picked && picked.id !== todays.id ? 'From the library' : woke ? 'Who woke you up' : "Today's bird";
  // A fresh scene per bird, so the page starts at the top.
  return <BirdScene key={bird.id} bird={bird} label={label} showBack={label === 'From the library'} />;
}

function BirdScene({ bird, label, showBack }: { bird: LibraryBird; label: string; showBack: boolean }) {
  const { C, ITALIC, SANS, ds, display, look } = useTheme();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const still = useReduceMotion();
  const [scrollY] = useState(() => new Animated.Value(0));
  const scroller = useRef<ScrollViewInstance>(null);
  const [detailsY, setDetailsY] = useState(0);
  const open = (id: string) => router.push({ pathname: '/', params: { bird: id } });
  const photo = photoFor(bird.id);
  const { library } = useStore();
  const mates = familyMates(bird, library);
  const caption = bird.regions.includes('north-america') ? 'Across most of the US' : 'Across western Europe';
  const shade = look.onFill;
  const textShadow = { textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 10, textShadowOffset: { width: 0, height: 1 } };

  // Tall, portrait photo: up to 1.65x as tall as it is wide, at most 80% of the screen.
  const headerH = photo ? Math.min(width * 1.65, height * 0.8) : height * 0.3;
  const spacer = headerH * 0.66;

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
            <Label style={[{ color: C.text, opacity: 0.8 }, textShadow]}>{label}</Label>
          </FadeIn>
          <FadeIn delay={1200}>
            <Text style={[styles.name, { color: C.text, lineHeight: ds(50) + 6 }, display(50), textShadow]}>
              {bird.commonName}
            </Text>
            <Text style={[styles.sci, { color: C.text, opacity: 0.85, fontFamily: ITALIC }, textShadow]}>{bird.scientificName}</Text>
          </FadeIn>
          <FadeIn delay={2000}>
            <Body style={[styles.fact, { color: C.text, opacity: 0.88 }]}>{bird.fact}</Body>
          </FadeIn>
          <FadeIn delay={2800}>
            <SongPlayer bird={bird} shade={shade} still={still} />
          </FadeIn>
          <FadeIn delay={3400}>
            <MoreHint
              bird={bird}
              still={still}
              onPress={() => scroller.current?.scrollTo({ y: Math.max(0, detailsY - insets.top - 24), animated: true })}
            />
          </FadeIn>

          <View onLayout={(e) => setDetailsY(e.nativeEvent.layout.y + spacer)} style={styles.details}>
            {bird.marks && (
              <Section title="Field marks">
                {bird.marks.map((m) => (
                  <View key={m} style={styles.bullet}>
                    <View style={[styles.bulletDot, { backgroundColor: C.dim }]} />
                    <Body style={{ color: C.text, opacity: 0.88, flex: 1 }}>{m}</Body>
                  </View>
                ))}
              </Section>
            )}
            {bird.listen && <Section title="Listen for">{bird.listen}</Section>}
            {bird.lookalikes && (
              <Section title="Lookalikes">
                {bird.lookalikes.map((l) => {
                  const other = birdByName(l.name);
                  return (
                    <View key={l.name} style={[styles.compare, { borderColor: C.line }]}>
                      <View style={styles.compareRow}>
                        <ThumbCard source={photo?.source} focusX={photo?.credit.focusX} name={bird.commonName} />
                        <Text style={[styles.vs, { color: C.faint, fontFamily: ITALIC }]}>vs</Text>
                        <ThumbCard
                          source={lookalikePhoto(l.name)?.source}
                          focusX={lookalikePhoto(l.name)?.credit.focusX}
                          name={l.name}
                          onPress={other ? () => open(other.id) : undefined}
                        />
                      </View>
                      <Body style={{ color: C.text, opacity: 0.85, marginTop: 12 }}>{l.tell}</Body>
                    </View>
                  );
                })}
              </Section>
            )}
            {bird.plumage && <Section title="Male, female and young">{bird.plumage}</Section>}
            {bird.months && (
              <Section title="When to see it">
                <MonthBar months={bird.months} caption={caption} />
                {bird.seasonNote && <Body style={{ color: C.text, opacity: 0.88, marginTop: 14 }}>{bird.seasonNote}</Body>}
              </Section>
            )}
            {bird.habitat && <Section title="Where to look">{bird.habitat}</Section>}
            {bird.size && (
              <Section title="Size">
                <SizeScale size={bird.size} source={photo?.source} focusX={photo?.credit.focusX} />
                <Body style={{ color: C.text, opacity: 0.88, marginTop: 12 }}>{bird.size}</Body>
              </Section>
            )}
            {bird.family && (
              <Section title="Family">
                <Body style={{ color: C.text, opacity: 0.88 }}>{bird.family}</Body>
                {mates.length > 0 && (
                  <>
                    <Text style={{ color: C.dim, fontFamily: SANS, fontSize: 13, marginTop: 12 }}>Also in the library</Text>
                    <View style={styles.mates}>
                      {mates.map((m) => (
                        <Press key={m.id} onPress={() => open(m.id)} accessibilityRole="link" style={styles.mate}>
                          <RoundPhoto source={photoFor(m.id)?.source} focusX={photoFor(m.id)?.credit.focusX} size={64} />
                          <Text numberOfLines={2} style={{ color: C.text, fontFamily: SANS, fontSize: 12, textAlign: 'center', marginTop: 6 }}>
                            {m.commonName}
                          </Text>
                        </Press>
                      ))}
                    </View>
                  </>
                )}
              </Section>
            )}
            {bird.groups && (
              <Section title="Categories">
                <View style={[styles.chips, { marginTop: 0 }]}>
                  {bird.groups.map((g) => (
                    <Chip key={g}>{g}</Chip>
                  ))}
                </View>
              </Section>
            )}
            {bird.nameNote && <Section title="The name">{bird.nameNote}</Section>}
            {showBack && (
              <Press onPress={() => router.setParams({ bird: undefined })} accessibilityRole="button" style={styles.back}>
                <Text style={{ color: C.text, fontFamily: SANS, fontSize: 14 }}>{'← Back to today’s bird'}</Text>
              </Press>
            )}
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
  pause: { flexDirection: 'row', gap: 5 },
  pauseBar: { width: 4, height: 16, borderRadius: 2 },
  track: { height: 2, borderRadius: 1, marginTop: 8, overflow: 'hidden', maxWidth: 220 },
  trackFill: { height: 2 },
  more: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 34, paddingVertical: 8 },
  details: { marginTop: 28 },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingVertical: 20 },
  credit: { fontSize: 11, lineHeight: 16, marginTop: 12 },
  bullet: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 6 },
  bulletDot: { width: 5, height: 5, borderRadius: 3, marginTop: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7 },
  months: { flexDirection: 'row', gap: 4, marginTop: 4 },
  month: { alignSelf: 'stretch', height: 22, borderRadius: 4 },
  nowDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'transparent' },
  compare: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 14, marginBottom: 12 },
  compareRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  vs: { fontSize: 15 },
  thumb: { width: '100%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden' },
  mates: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 12 },
  mate: { width: 72, alignItems: 'center' },
  scale: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', paddingVertical: 8 },
  back: { alignSelf: 'center', paddingVertical: 14, paddingHorizontal: 18, marginTop: 8 },
});
