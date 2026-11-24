import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform, StyleSheet, Text, View } from 'react-native';

import { coverageEnds } from '@shared/queue';
import type { AlarmRule } from '@shared/types';

import { Body, Label, Screen, Title, Toggle, useTheme, Press } from '@/components/ui';
import { useStore } from '@/state/store';

const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SNOOZE_OPTIONS = [0, 5, 9, 15];

const fmtDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/** "Today", "Tomorrow", "Friday" within the week, otherwise "Thursday 3 December". */
function whenDay(ms: number) {
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOf(new Date(ms)) - startOf(new Date())) / 86_400_000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return new Date(ms).toLocaleDateString(undefined, { weekday: 'long' });
  return fmtDate(ms);
}

/** "Weekdays", "Weekends", "Every day", or "Mon, Wed, Fri". */
function daysLabel(days: number[]) {
  const set = [...days].sort().join();
  if (set === '0,1,2,3,4,5,6') return 'Every day';
  if (set === '1,2,3,4,5') return 'Weekdays';
  if (set === '0,6') return 'Weekends';
  if (!days.length) return 'No days picked';
  return [...days].sort().map((d) => DAY_NAMES[d]!.slice(0, 3)).join(', ');
}

function Stepper({ value, onStep, label }: { value: string; onStep: (d: number) => void; label: string }) {
  const { C, SERIF, SANS, ds } = useTheme();
  const glyph = [styles.stepGlyph, { color: C.dim, fontFamily: SANS }];
  return (
    <View style={styles.stepper}>
      <Press onPress={() => onStep(1)} hitSlop={10} accessibilityLabel={`${label} up`} style={styles.stepBtn}>
        <Text style={glyph}>+</Text>
      </Press>
      <Text style={[styles.digits, { color: C.text, fontFamily: SERIF, fontSize: ds(52), lineHeight: ds(52) + 8 }]}>{value}</Text>
      <Press onPress={() => onStep(-1)} hitSlop={10} accessibilityLabel={`${label} down`} style={styles.stepBtn}>
        <Text style={glyph}>−</Text>
      </Press>
    </View>
  );
}

function AlarmCard({ rule, index }: { rule: AlarmRule; index: number }) {
  const { updateRule, removeRule } = useStore();
  const { C, SERIF, SANS, ds } = useTheme();
  const set = (patch: Partial<AlarmRule>) => updateRule(rule.id, patch);
  const toggleDay = (d: number) =>
    set({ days: rule.days.includes(d) ? rule.days.filter((x) => x !== d) : [...rule.days, d].sort() });

  return (
    <View style={[styles.card, { borderColor: C.line, backgroundColor: C.fill }]}>
      <View style={styles.cardHead}>
        <Text style={{ color: rule.enabled ? C.text : C.dim, fontFamily: SANS, fontSize: 15 }}>
          {daysLabel(rule.days)}
        </Text>
        <Toggle label={`${daysLabel(rule.days)} alarm ${index + 1} on`} value={rule.enabled} onChange={(enabled) => set({ enabled })} />
      </View>

      <View style={[styles.time, !rule.enabled && { opacity: 0.4 }]}>
        <Stepper label="Hour" value={String(rule.hour).padStart(2, '0')} onStep={(d) => set({ hour: (rule.hour + d + 24) % 24 })} />
        <Text style={[styles.colon, { color: C.dim, fontFamily: SERIF, fontSize: ds(44) }]}>:</Text>
        <Stepper
          label="Minute"
          value={String(rule.minute).padStart(2, '0')}
          onStep={(d) => set({ minute: (rule.minute + d * 5 + 60) % 60 })}
        />
      </View>

      <View style={[styles.days, !rule.enabled && { opacity: 0.4 }]}>
        {DAYS.map((letter, d) => {
          const on = rule.days.includes(d);
          return (
            <Press
              key={d}
              onPress={() => toggleDay(d)}
              accessibilityLabel={DAY_NAMES[d]}
              accessibilityState={{ selected: on }}
              style={[styles.day, { backgroundColor: on ? C.fillOn : 'transparent', borderColor: on ? C.fillOn : C.line }]}>
              <Text style={{ fontFamily: SANS, fontSize: 14, color: on ? C.onFill : C.dim }}>{letter}</Text>
            </Press>
          );
        })}
      </View>

      <Press onPress={() => removeRule(rule.id)} hitSlop={8} accessibilityRole="button" style={styles.remove}>
        <Text style={{ color: C.faint, fontFamily: SANS, fontSize: 13 }}>Delete</Text>
      </Press>
    </View>
  );
}

export default function AlarmsScreen() {
  const { settings, queue, addRule, update, alarmSync, retryAlarmSync } = useStore();
  const { C, SANS, display } = useTheme();
  const next = queue.upcoming[0];
  const ends = coverageEnds(queue);

  return (
    <Screen>
      <Title>Alarms</Title>

      {settings.rules.map((rule, i) => (
        <AlarmCard key={rule.id} rule={rule} index={i} />
      ))}

      <Press onPress={addRule} accessibilityRole="button" style={[styles.add, { borderColor: C.dim }]}>
        <Text style={{ color: C.text, fontFamily: SANS, fontSize: 15 }}>+ Another alarm</Text>
      </Press>

      <View style={{ marginTop: 30, gap: 10 }}>
        <Label>Snooze</Label>
        <View style={styles.snoozeRow}>
          {SNOOZE_OPTIONS.map((m) => {
            const on = settings.snoozeMinutes === m;
            return (
              <Press
                key={m}
                onPress={() => update({ snoozeMinutes: m })}
                accessibilityState={{ selected: on }}
                style={[styles.snooze, { backgroundColor: on ? C.fillOn : C.fill }]}>
                <Text style={{ fontFamily: SANS, fontSize: 14, color: on ? C.onFill : C.dim }}>{m ? `${m} min` : 'Off'}</Text>
              </Press>
            );
          })}
        </View>
        <Body style={{ fontSize: 14, lineHeight: 20 }}>
          {settings.snoozeMinutes
            ? `Snooze gives you ${settings.snoozeMinutes} more minutes, then the same bird sings again.`
            : 'No snooze. Stop is the only button.'}
        </Body>
      </View>

      <View style={{ marginTop: 28, gap: 8 }}>
        <Label>Next alarm</Label>
        {next ? (
          <>
            <Text style={[{ color: C.text }, display(26)]}>
              {whenDay(next.fireAt)} at {fmtTime(next.fireAt)}
            </Text>
            <Body>You&apos;ll find out which bird it is when it goes off.</Body>
            {ends !== undefined && (
              <Body>
                Your alarms are set through {fmtDate(ends)}. Opening the app now and then keeps them going.
              </Body>
            )}
          </>
        ) : (
          <Body>Nothing set yet. Turn an alarm on and pick at least one day.</Body>
        )}
      </View>

      <View style={{ marginTop: 32, gap: 10 }}>
        <Body style={{ fontSize: 13, lineHeight: 19, color: alarmSync.kind === 'ok' ? C.dim : C.faint }}>
          {alarmSync.kind === 'unavailable' &&
            (Platform.OS === 'ios' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient
              ? "This copy of the app can't ring. It was built without its alarm code (modules/dawn-alarm/ios)."
              : "This is a preview, so it won't ring. The installed app will.")}
          {alarmSync.kind === 'syncing' && 'Setting your alarms…'}
          {alarmSync.kind === 'ok' && 'All set on this phone.'}
          {alarmSync.kind === 'denied' &&
            'Alarms are turned off for Dawn Chorus. You can turn them on in Settings › Apps › Dawn Chorus.'}
          {alarmSync.kind === 'error' && `Something went wrong setting your alarms (${alarmSync.message}).`}
        </Body>
        {(alarmSync.kind === 'denied' || alarmSync.kind === 'error') && (
          <Press onPress={retryAlarmSync} style={[styles.retry, { backgroundColor: C.fillOn }]}>
            <Text style={{ fontFamily: SANS, fontSize: 14, color: C.onFill }}>Try again</Text>
          </Press>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 16, marginBottom: 14 },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  time: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginVertical: 6 },
  stepper: { alignItems: 'center' },
  stepBtn: { width: 52, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontSize: 24, lineHeight: 28 },
  digits: { fontVariant: ['tabular-nums'], minWidth: 80, textAlign: 'center' },
  colon: { lineHeight: 58 },
  days: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  day: { width: 36, height: 36, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  remove: { alignSelf: 'center', marginTop: 14, paddingVertical: 4 },
  add: { borderWidth: 1, borderStyle: 'dashed', borderRadius: 18, paddingVertical: 16, alignItems: 'center' },
  snoozeRow: { flexDirection: 'row', gap: 8 },
  snooze: { paddingVertical: 9, paddingHorizontal: 16, borderRadius: 18 },
  retry: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 18, borderRadius: 20 },
});
