/**
 * Keeps the phone's real alarms (AlarmKit) in step with the queue in the app's saved state.
 * Whenever the list of upcoming alarms changes, the whole list is handed to the native module,
 * which replaces everything it had. In Expo Go and on the web there is no native module, so
 * this reports 'unavailable' and does nothing.
 */
import { useEffect, useRef, useState } from 'react';

import type { ScheduledAlarm } from '@shared/types';

import { birdById } from '@/data/birds';

import { DawnAlarm, type AlarmAuthorization } from '../../modules/dawn-alarm';

export type AlarmSyncStatus =
  | { kind: 'unavailable' }
  | { kind: 'syncing' }
  | { kind: 'ok'; count: number }
  | { kind: 'denied' }
  | { kind: 'error'; message: string };

const signature = (alarms: ScheduledAlarm[], snooze: number) =>
  `${snooze}#` + alarms.map((a) => `${a.id}@${a.fireAt}@${a.birdId}`).join('|');

export function useAlarmSync(upcoming: ScheduledAlarm[], ready: boolean, snoozeMinutes: number) {
  const [status, setStatus] = useState<AlarmSyncStatus>(DawnAlarm ? { kind: 'syncing' } : { kind: 'unavailable' });
  const [auth, setAuth] = useState<AlarmAuthorization | 'unavailable'>(DawnAlarm ? 'notDetermined' : 'unavailable');
  const [attempt, setAttempt] = useState(0);
  const last = useRef<string>('');

  const sig = signature(upcoming, snoozeMinutes);

  useEffect(() => {
    if (!DawnAlarm || !ready) return;
    if (sig === last.current && attempt === 0) return;
    let cancelled = false;
    setStatus({ kind: 'syncing' });
    DawnAlarm.replaceAll(
      upcoming.map((a) => ({
        id: a.id,
        fireAt: a.fireAt,
        title: 'Good morning',
        // Shown on the Live Activity while snoozing, after you've already heard it.
        birdName: birdById(a.birdId)?.commonName ?? 'Your bird',
        snoozeMinutes,
        // Bundled bird recordings aren't in the app yet, so AlarmKit plays its default sound.
      })),
    )
      .then((count) => {
        if (cancelled) return;
        last.current = sig;
        setStatus({ kind: 'ok', count });
        setAuth('authorized');
      })
      .catch(async (e: unknown) => {
        if (cancelled) return;
        const state = await DawnAlarm!.authorizationStatus().catch(() => 'notDetermined' as const);
        setAuth(state);
        setStatus(state === 'denied' ? { kind: 'denied' } : { kind: 'error', message: String((e as Error)?.message ?? e) });
      });
    return () => {
      cancelled = true;
    };
    // `upcoming` is captured through `sig`, which changes whenever the list does.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready, attempt]);

  return { status, auth, retry: () => setAttempt((n) => n + 1) };
}
