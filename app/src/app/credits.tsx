import { Body, Label, Screen, Title, useTheme } from '@/components/ui';

export default function CreditsScreen() {
  const { C } = useTheme();
  return (
    <Screen>
      <Title>Credits</Title>
      <Label>Recordings</Label>
      <Body style={{ marginTop: 8 }}>
        No recordings are bundled yet. When they are, every one will be listed here with its recordist, its Creative
        Commons license and its xeno-canto number.
      </Body>
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
