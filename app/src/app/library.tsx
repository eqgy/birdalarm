import { Text, View } from 'react-native';

import { Body, Row, Screen, Title, Toggle, useTheme } from '@/components/ui';
import { REGION_NAMES } from '@/data/birds';
import { useStore } from '@/state/store';

export default function LibraryScreen() {
  const { library, settings, region, toggleBlocked } = useStore();
  const { C, ITALIC, display } = useTheme();
  const where = settings.worldwide || !region ? 'worldwide' : `from ${REGION_NAMES[region]}`;

  return (
    <Screen>
      <Title>Birds</Title>
      <Body style={{ marginBottom: 12 }}>
        {library.length} sample birds {where}. Switch one off and it will never wake you.
      </Body>
      {library.map((bird) => {
        const on = !settings.blocked.includes(bird.id);
        return (
          <Row key={bird.id}>
            <View style={{ flex: 1, opacity: on ? 1 : 0.45 }}>
              <Text style={[{ color: C.text }, display(19)]}>{bird.commonName}</Text>
              <Text style={{ color: C.dim, fontFamily: ITALIC, fontSize: 14, marginTop: 3 }}>{bird.scientificName}</Text>
            </View>
            <Toggle label={`Wake me with ${bird.commonName}`} value={on} onChange={() => toggleBlocked(bird.id)} />
          </Row>
        );
      })}
    </Screen>
  );
}
