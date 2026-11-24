/**
 * Credits for the recordings, photos and fonts, shown in Settings. Folded up by default;
 * tapping a group opens it.
 */
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Label, Press, useTheme } from '@/components/ui';
import { LOOKALIKE_CREDITS, PHOTO_CREDITS, RECORDING_CREDITS } from '@/data/birds';

function Group({ title, note, lines }: { title: string; note: string; lines: { key: string; who: string; rest: string }[] }) {
  const { C, SANS } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={[styles.group, { borderBottomColor: C.line }]}>
      <Press onPress={() => setOpen(!open)} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.head} depth={0.985}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontFamily: SANS, fontSize: 16 }}>{title}</Text>
          <Text style={{ color: C.dim, fontFamily: SANS, fontSize: 13, marginTop: 3 }}>{note}</Text>
        </View>
        <Text style={{ color: C.dim, fontFamily: SANS, fontSize: 18 }}>{open ? '−' : '+'}</Text>
      </Press>
      {open &&
        lines.map((l) => (
          <Text key={l.key} style={{ color: C.dim, fontFamily: SANS, fontSize: 13, lineHeight: 19, marginTop: 6 }}>
            <Text style={{ color: C.text }}>{l.who}</Text>: {l.rest}
          </Text>
        ))}
      {open && <View style={{ height: 12 }} />}
    </View>
  );
}

export function Credits() {
  const { C } = useTheme();
  return (
    <View>
      <Label style={{ marginBottom: 4 }}>Credits</Label>
      <Group
        title="Bird songs"
        note={`${RECORDING_CREDITS.length} recordings from xeno-canto, shared under Creative Commons`}
        lines={RECORDING_CREDITS.map((r) => ({ key: r.bird, who: r.bird, rest: `${r.recordist}, ${r.licenseFull}, ${r.xcNumber}` }))}
      />
      <Group
        title="Bird photos"
        note={`${PHOTO_CREDITS.length} photos from Wikimedia Commons`}
        lines={PHOTO_CREDITS.map((p) => ({ key: p.bird, who: p.bird, rest: `${p.artist}, ${p.license}` }))}
      />
      <Group
        title="Lookalike photos"
        note={`${LOOKALIKE_CREDITS.length} more photos from Wikimedia Commons`}
        lines={LOOKALIKE_CREDITS.map((p) => ({ key: p.bird, who: p.bird, rest: `${p.artist}, ${p.license}` }))}
      />
      <Group
        title="Fonts"
        note="Seven free fonts"
        lines={[
          { key: 'ofl', who: 'SIL Open Font License', rest: 'Fraunces, Figtree, IBM Plex Mono, IBM Plex Sans, Caveat, Nunito' },
          { key: 'apache', who: 'Apache License 2.0', rest: 'Special Elite' },
        ]}
      />
      <Body style={{ marginTop: 16, fontSize: 13, lineHeight: 19, color: C.faint }}>
        The songs are trimmed and evened out in volume for the alarm. The bird write-ups were written for Dawn Chorus.
        The app is free and open source.
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { borderBottomWidth: StyleSheet.hairlineWidth },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14 },
});
