import { Pressable, StyleSheet, Text, View } from 'react-native';

import { coverageEnds } from '@shared/queue';

import { Body, Label, Row, Screen, Title, Toggle, useTheme } from '@/components/ui';
import { useStore } from '@/state/store';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

function Stepper({ value, onStep, label }: { value: string; onStep: (d: number) => void; label: string }) {
  const { C, SERIF, SANS, ds } = useTheme();
  const glyph = [styles.stepGlyph, { color: C.dim, fontFamily: SANS }];
  return (
    <View style={styles.stepper}>
      <Pressable onPress={() => onStep(1)} hitSlop={12} accessibilityLabel={`${label} up`} style={styles.stepBtn}>
        <Text style={glyph}>+</Text>
      </Pressable>
      <Text style={[styles.digits, { color: C.text, fontFamily: SERIF, fontSize: ds(68), lineHeight: ds(68) + 10 }]}>{value}</Text>
      <Pressable onPress={() => onStep(-1)} hitSlop={12} accessibilityLabel={`${label} down`} style={styles.stepBtn}>
        <Text style={glyph}>−</Text>
      </Pressable>
    </View>
  );
}

export default function AlarmsScreen() {
  const { settings, queue, updateRule } = useStore();
  const { C, SERIF, SANS, ds } = useTheme();
  const { rule } = settings;
  const next = queue.upcoming[0];
  const ends = coverageEnds(queue);

  const toggleDay = (d: number) =>
    updateRule({ days: rule.days.includes(d) ? rule.days.filter((x) => x !== d) : [...rule.days, d].sort() });

  return (
    <Screen>
      <Title>Alarm</Title>

      <View style={[styles.time, !rule.enabled && { opacity: 0.4 }]}>
        <Stepper
          label="Hour"
          value={String(rule.hour).padStart(2, '0')}
          onStep={(d) => updateRule({ hour: (rule.hour + d + 24) % 24 })}
        />
        <Text style={[styles.colon, { color: C.dim, fontFamily: SERIF, fontSize: ds(56) }]}>:</Text>
        <Stepper
          label="Minute"
          value={String(rule.minute).padStart(2, '0')}
          onStep={(d) => updateRule({ minute: (rule.minute + d * 5 + 60) % 60 })}
        />
      </View>

      <View style={styles.days}>
        {DAYS.map((letter, d) => {
          const on = rule.days.includes(d);
          return (
            <Pressable
              key={d}
              onPress={() => toggleDay(d)}
              accessibilityLabel={DAY_NAMES[d]}
              accessibilityState={{ selected: on }}
              style={[styles.day, { backgroundColor: on ? C.fillOn : C.fill }]}>
              <Text style={{ fontFamily: SANS, fontSize: 14, color: on ? C.onFill : C.dim }}>{letter}</Text>
            </Pressable>
          );
        })}
      </View>

      <Row>
        <Text style={{ color: C.text, fontFamily: SANS, fontSize: 16 }}>Alarm on</Text>
        <Toggle label="Alarm on" value={rule.enabled} onChange={(enabled) => updateRule({ enabled })} />
      </Row>

      <View style={{ marginTop: 28, gap: 8 }}>
        <Label>Next morning</Label>
        {next ? (
          <>
            <Body style={{ color: C.text }}>
              {fmtDate(next.fireAt)} at {fmtTime(next.fireAt)}
            </Body>
            <Body>A different bird each morning. Which one is a surprise.</Body>
            {ends !== undefined && (
              <Body>
                {queue.upcoming.length} mornings are lined up, through {fmtDate(ends)}. Opening the app adds more.
              </Body>
            )}
          </>
        ) : (
          <Body>No alarm set. Turn it on and pick at least one day.</Body>
        )}
      </View>

      <Body style={{ marginTop: 32, fontSize: 13, lineHeight: 19, color: C.faint }}>
        Preview build: this plans your mornings but can&apos;t ring yet. Ringing needs the full app, not Expo Go.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  time: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 10, marginBottom: 28 },
  stepper: { alignItems: 'center' },
  stepBtn: { width: 56, height: 40, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 26, lineHeight: 30 },
  digits: { fontVariant: ['tabular-nums'], minWidth: 96, textAlign: 'center' },
  colon: { lineHeight: 70 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
  day: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
});
