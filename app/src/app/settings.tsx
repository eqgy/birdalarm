import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { Body, Label, Row, Screen, Title, Toggle, useTheme, Press } from '@/components/ui';
import { REGION_NAMES } from '@/data/birds';
import { useStore } from '@/state/store';
import { LOOKS, TYPES, themeFor } from '@/theme';

export default function SettingsScreen() {
  const { settings, region, detectedRegion, update } = useStore();
  const { C, SANS, look: current, type: currentType } = useTheme();
  const regionName = region ? REGION_NAMES[region] : undefined;

  return (
    <Screen>
      <Title>Settings</Title>

      <Label style={{ marginBottom: 4 }}>Type</Label>
      {TYPES.map((type) => {
        const t = themeFor(current.id, type.id);
        const selected = type.id === currentType.id;
        return (
          <Press
            key={type.id}
            onPress={() => update({ type: type.id })}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${type.name}: ${type.blurb}`}
            style={[styles.look, { borderBottomColor: C.line }]}>
            <View style={{ flex: 1 }}>
              {/* Each option is written in its own fonts so you can compare them here. */}
              <Text style={[{ color: C.text }, t.display(30)]}>{type.name}</Text>
              <Text style={{ color: C.dim, fontFamily: t.ITALIC, fontSize: 14, marginTop: 4 }}>Turdus migratorius</Text>
              <Text style={{ color: C.dim, fontFamily: t.SANS, fontSize: 13, lineHeight: 18, marginTop: 4 }}>{type.blurb}</Text>
              <Text style={{ color: C.faint, fontFamily: t.LABEL, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 6 }}>
                {type.fontNames}
              </Text>
            </View>
            <View style={[styles.radio, { borderColor: C.dim }]}>
              {selected && <View style={[styles.radioDot, { backgroundColor: C.text }]} />}
            </View>
          </Press>
        );
      })}

      <Label style={{ marginTop: 32, marginBottom: 4 }}>Colours</Label>
      {LOOKS.map((look) => {
        const selected = look.id === current.id;
        return (
          <Press
            key={look.id}
            onPress={() => update({ look: look.id })}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${look.name}: ${look.blurb}`}
            style={[styles.look, { borderBottomColor: C.line }]}>
            <LinearGradient colors={look.sky.dawn.stops} style={[styles.swatch, { borderColor: selected ? C.text : 'transparent' }]} />
            <View style={{ flex: 1 }}>
              <Text style={{ color: C.text, fontFamily: SANS, fontSize: 16 }}>{look.name}</Text>
              <Text style={{ color: C.dim, fontFamily: SANS, fontSize: 13, lineHeight: 18, marginTop: 3 }}>{look.blurb}</Text>
            </View>
            <View style={[styles.radio, { borderColor: C.dim }]}>
              {selected && <View style={[styles.radioDot, { backgroundColor: C.text }]} />}
            </View>
          </Press>
        );
      })}

      <Label style={{ marginTop: 32, marginBottom: 12 }}>Your region</Label>
      <View style={styles.chips}>
        {[
          { id: 'auto', name: detectedRegion ? `Auto (${REGION_NAMES[detectedRegion]})` : 'Auto' },
          ...Object.entries(REGION_NAMES).map(([id, name]) => ({ id, name })),
        ].map((opt) => {
          const selected = settings.region === opt.id;
          return (
            <Press
              key={opt.id}
              onPress={() => update({ region: opt.id })}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              style={[styles.chip, { backgroundColor: selected ? C.fillOn : C.fill }]}>
              <Text style={{ fontFamily: SANS, fontSize: 14, color: selected ? C.onFill : C.dim }}>{opt.name}</Text>
            </Press>
          );
        })}
      </View>
      <Body style={{ fontSize: 13, lineHeight: 19, marginTop: 10 }}>
        Auto uses your phone&apos;s region setting, never your location.
      </Body>

      <Label style={{ marginTop: 32, marginBottom: 4 }}>Birds</Label>
      <Row>
        <View style={{ flex: 1 }}>
          <Text style={{ color: C.text, fontFamily: SANS, fontSize: 16 }}>Worldwide birds</Text>
          <Body style={{ fontSize: 13, lineHeight: 19, marginTop: 4 }}>
            {regionName
              ? `Off: only birds from ${regionName}.`
              : "Your region isn't in the library yet, so all birds are used."}
          </Body>
        </View>
        <Toggle
          label="Worldwide birds"
          value={settings.worldwide || !regionName}
          onChange={(worldwide) => update({ worldwide })}
        />
      </Row>

      <Body style={{ marginTop: 32, fontSize: 13, lineHeight: 19, color: C.faint }}>
        No account, no tracking, no network. Everything stays on this phone.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 18 },
  look: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  swatch: { width: 46, height: 46, borderRadius: 10, borderWidth: 1.5 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 10, height: 10, borderRadius: 5 },
});
