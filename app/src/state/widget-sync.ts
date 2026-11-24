/**
 * Shares what the widget shows (targets/alarm-widget/BirdWidget.swift). For today and the next
 * 7 days: the date's bird (id for its photo, and name), the evening clue, the sunset time and
 * the first alarm. Also the date you last opened the app. The widget then shows:
 *   - today's bird once that morning's alarm has gone off ("Woke you up"), or, on a day with
 *     no alarm, once you've opened the app that day ("Today's bird")
 *   - from sunset: a clue to tomorrow's bird, until its alarm goes off
 * Written as JSON to the shared App Group every time the app opens or the alarms change.
 * In Expo Go and on the web ExtensionStorage does nothing.
 */
import { ExtensionStorage } from '@bacons/apple-targets';
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { dayNumber } from '@shared/daily';
import type { QueueState } from '@shared/queue';

import { birdOfDay, localDateKey, type LibraryBird } from '@/data/birds';
import { sunsetMs } from '@/data/sun';
import { clueFor } from '@/data/teasers';

export const APP_GROUP = 'group.io.github.dawnchorus.app';
const storage = new ExtensionStorage(APP_GROUP);

function write(queue: QueueState, library: LibraryBird[], blocked: string[], region: string | undefined) {
  const alarms = [...queue.fired.slice(-5), ...queue.upcoming];
  const days = Array.from({ length: 8 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const key = localDateKey(date);
    const bird = birdOfDay(key, library, blocked);
    const first = alarms.filter((a) => a.localDate === key).map((a) => a.fireAt).sort((x, y) => x - y)[0];
    return {
      day: key,
      id: bird.id,
      name: bird.commonName,
      clue: clueFor(dayNumber(key), bird),
      sunset: Math.round(sunsetMs(date.getFullYear(), date.getMonth() + 1, date.getDate(), region) / 1000),
      alarm: first ? Math.round(first / 1000) : 0,
    };
  });
  try {
    storage.set(
      'widget',
      JSON.stringify({
        v: 2,
        opened: localDateKey(),
        days,
        alarms: queue.upcoming.slice(0, 20).map((a) => Math.round(a.fireAt / 1000)),
      }),
    );
    ExtensionStorage.reloadWidget();
  } catch {}
}

export function useWidgetSync(
  queue: QueueState,
  library: LibraryBird[],
  blocked: string[],
  region: string | undefined,
  ready: boolean,
) {
  const sig = `${library.length}|${blocked.join(',')}|${region}|${queue.upcoming.map((a) => `${a.localDate}@${a.fireAt}`).join(',')}|${queue.fired.length}`;

  // Whenever the alarms or settings change...
  useEffect(() => {
    if (ready && library.length) write(queue, library, blocked, region);
    // `sig` captures everything the payload depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready]);

  // ...and every time the app comes to the front, so "opened today" and the days stay fresh.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && ready && library.length) write(queue, library, blocked, region);
    });
    return () => sub.remove();
  }, [queue, library, blocked, region, ready]);
}
