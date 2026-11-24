import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Press, Screen, Title, Toggle, useTheme } from '@/components/ui';
import { REGION_NAMES, photoFor } from '@/data/birds';
import { useStore } from '@/state/store';

export default function LibraryScreen() {
  const { library, settings, region, toggleBlocked } = useStore();
  const { C, display } = useTheme();
  const where = settings.worldwide || !region ? 'from around the world' : `from ${REGION_NAMES[region]}`;

  return (
    <Screen>
      <Title>Birds</Title>
      <Body style={{ marginBottom: 18 }}>
        {library.length} birds {where}. Turn one off and it won&apos;t wake you. Tap a bird to read about it.
      </Body>
      <View style={styles.grid}>
        {library.map((bird) => {
          const on = !settings.blocked.includes(bird.id);
          const photo = photoFor(bird.id);
          return (
            <View key={bird.id} style={[styles.tile, { borderColor: C.line }]}>
              <Press
                onPress={() => router.push({ pathname: '/', params: { bird: bird.id } })}
                accessibilityRole="link"
                accessibilityLabel={bird.commonName}
                depth={0.97}
                style={[styles.top, { opacity: on ? 1 : 0.45 }]}>
                <View style={[styles.photo, { backgroundColor: C.fill }]}>
                  {photo && (
                    <Image
                      source={photo.source}
                      style={StyleSheet.absoluteFill}
                      contentFit="cover"
                      contentPosition={{ left: `${Math.round((photo.credit.focusX ?? 0.5) * 100)}%`, top: '50%' }}
                      transition={300}
                    />
                  )}
                </View>
                <Text numberOfLines={2} style={[{ color: C.text, marginTop: 8 }, display(15)]}>
                  {bird.commonName}
                </Text>
              </Press>
              <View style={styles.toggleRow}>
                <Toggle label={`Wake me with ${bird.commonName}`} value={on} onChange={() => toggleBlocked(bird.id)} />
              </View>
            </View>
          );
        })}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14 },
  tile: { width: '48%', borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 10 },
  top: {},
  photo: { width: '100%', aspectRatio: 1.25, borderRadius: 10, overflow: 'hidden' },
  toggleRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 8 },
});
