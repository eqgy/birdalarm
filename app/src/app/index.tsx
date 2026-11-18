import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { lastFired } from '@shared/queue';

import { Body, FadeIn, Label, Screen, useTheme } from '@/components/ui';
import { birdById, photoFor } from '@/data/birds';
import { useStore } from '@/state/store';

export default function TodayScreen() {
  const { ready, queue, library } = useStore();
  const { C, ITALIC, SANS, ds, display } = useTheme();
  if (!ready) return <Screen scroll={false}>{null}</Screen>;

  // The bird that actually woke you, if an alarm has rung; otherwise a bird of the day.
  const woke = birdById(lastFired(queue)?.birdId);
  const dayNumber = Math.floor(Date.now() / 86_400_000);
  const bird = woke ?? library[dayNumber % library.length]!;
  const photo = photoFor(bird.id);

  return (
    <Screen scroll={false} animate={false}>
      <View style={styles.center}>
        {photo && (
          <FadeIn style={styles.piece}>
            <Image
              source={photo.source}
              style={[styles.photo, { borderColor: C.line }]}
              contentFit="cover"
              transition={600}
              accessibilityLabel={`Photo of a ${bird.commonName}`}
            />
            <Text style={[styles.credit, { color: C.faint, fontFamily: SANS }]} numberOfLines={1}>
              Photo: {photo.credit.artist}, {photo.credit.license}
            </Text>
          </FadeIn>
        )}
        <FadeIn style={styles.piece}>
          <Label>{woke ? 'Who woke you up' : "Today's bird"}</Label>
        </FadeIn>
        <FadeIn delay={350} style={styles.piece}>
          <Text style={[styles.name, { color: C.text, lineHeight: ds(44) + 8 }, display(44)]}>
            {bird.commonName}
          </Text>
          <Text style={[styles.sci, { color: C.dim, fontFamily: ITALIC, fontSize: 17 }]}>{bird.scientificName}</Text>
        </FadeIn>
        <FadeIn delay={900} style={styles.piece}>
          <Body style={styles.fact}>{bird.fact}</Body>
        </FadeIn>
        <FadeIn delay={1500} style={styles.piece}>
          <Pressable
            disabled
            accessibilityLabel="Play recording (not available yet)"
            style={[styles.play, { borderColor: C.line }]}>
            <View style={[styles.triangle, { borderLeftColor: C.text }]} />
          </Pressable>
          <Text style={[styles.note, { color: C.faint, fontFamily: SANS }]}>Recordings arrive with the audio library</Text>
        </FadeIn>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  piece: { alignItems: 'center' },
  photo: { width: 200, height: 200, borderRadius: 100, borderWidth: 1 },
  credit: { fontSize: 10, marginTop: 8, marginBottom: 22, maxWidth: 260 },
  name: { textAlign: 'center', marginTop: 18 },
  sci: { marginTop: 10 },
  fact: { textAlign: 'center', marginTop: 22, maxWidth: 340 },
  play: {
    marginTop: 32,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    opacity: 0.6,
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
  note: { fontSize: 12, marginTop: 14 },
});
