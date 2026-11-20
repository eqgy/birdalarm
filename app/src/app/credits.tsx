import { Text } from 'react-native';

import { Body, Label, Screen, Title, useTheme } from '@/components/ui';
import { LOOKALIKE_CREDITS, PHOTO_CREDITS, RECORDING_CREDITS } from '@/data/birds';

export default function CreditsScreen() {
  const { C, SANS } = useTheme();
  return (
    <Screen>
      <Title>Credits</Title>
      <Label>Recordings</Label>
      <Body style={{ marginTop: 8, marginBottom: 6 }}>
        From xeno-canto, via Wikimedia Commons, used under each recordist&apos;s Creative Commons license. Each is
        trimmed, faded and evened out in loudness.
      </Body>
      {RECORDING_CREDITS.map((r) => (
        <Text key={r.bird} style={{ color: C.dim, fontFamily: SANS, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          <Text style={{ color: C.text }}>{r.bird}</Text>: {r.recordist}, {r.licenseFull}, {r.xcNumber}
        </Text>
      ))}
      <Label style={{ marginTop: 28 }}>Photos</Label>
      <Body style={{ marginTop: 8, marginBottom: 6 }}>From Wikimedia Commons, used under each photographer&apos;s license.</Body>
      {PHOTO_CREDITS.map((p) => (
        <Text key={p.bird} style={{ color: C.dim, fontFamily: SANS, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
          <Text style={{ color: C.text }}>{p.bird}</Text>: {p.artist}, {p.license}
        </Text>
      ))}
      <Label style={{ marginTop: 28 }}>Lookalike photos</Label>
      {LOOKALIKE_CREDITS.map((p) => (
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
