import { Text } from 'react-native';

import { Body, Label, Screen, Title, useTheme } from '@/components/ui';
import { PHOTO_CREDITS } from '@/data/birds';

export default function CreditsScreen() {
  const { C, SANS } = useTheme();
  return (
    <Screen>
      <Title>Credits</Title>
      <Label>Recordings</Label>
      <Body style={{ marginTop: 8 }}>
        No recordings are bundled yet. When they are, every one will be listed here with its recordist, its Creative
        Commons license and its xeno-canto number.
      </Body>
      <Label style={{ marginTop: 28 }}>Photos</Label>
      <Body style={{ marginTop: 8, marginBottom: 6 }}>From Wikimedia Commons, used under each photographer&apos;s license.</Body>
      {PHOTO_CREDITS.map((p) => (
        <Text key={p.bird} style={{ color: C.dim, fontFamily: SANS, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          <Text style={{ color: C.text }}>{p.bird}</Text>: {p.artist}, {p.license}
        </Text>
      ))}
      <Label style={{ marginTop: 28 }}>Bird facts</Label>
      <Body style={{ marginTop: 8 }}>Written for Dawn Chorus.</Body>
      <Label style={{ marginTop: 28 }}>Fonts</Label>
      <Body style={{ marginTop: 8 }}>
        Fraunces, Figtree, Special Elite, IBM Plex Mono, IBM Plex Sans, Caveat and Nunito. Special Elite is under
        the Apache License 2.0; the rest are under the SIL Open Font License.
      </Body>
      <Body style={{ marginTop: 32, fontSize: 13, color: C.faint }}>
        Dawn Chorus is free and open source.
      </Body>
    </Screen>
  );
}
