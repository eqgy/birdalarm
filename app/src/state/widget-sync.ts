/**
 * Shares what the Lock Screen widget shows. For today and the next 7 days: the date's bird,
 * a teaser line and hint for the evening before, the sunset time and the first alarm of the
 * day. The widget (targets/alarm-widget/BirdWidget.swift) then shows:
 *   - from the morning alarm (or 6 am) to sunset: the bird that woke you / today's bird
 *   - from sunset until the next morning's alarm: a mystery teaser for that bird
 * so it stays right without the app running. Written as JSON to the shared App Group.
 * In Expo Go and on the web ExtensionStorage does nothing.
 */
import { ExtensionStorage } from '@bacons/apple-targets';
import { useEffect } from 'react';

import { dayNumber } from '@shared/daily';
import type { QueueState } from '@shared/queue';

import { birdOfDay, localDateKey, type LibraryBird } from '@/data/birds';
import { sunsetMs } from '@/data/sun';
import { hintFor, teaserFor } from '@/data/teasers';

export const APP_GROUP = 'group.io.github.dawnchorus.app';
const storage = new ExtensionStorage(APP_GROUP);

export function useWidgetSync(
  queue: QueueState,
  library: LibraryBird[],
  blocked: string[],
  region: string | undefined,
  ready: boolean,
) {
  const alarms = [...queue.fired.slice(-3), ...queue.upcoming.slice(0, 20)];
  const sig = `${library.length}|${blocked.join(',')}|${region}|${alarms.map((a) => `${a.localDate}@${a.fireAt}`).join(',')}`;

  useEffect(() => {
    if (!ready || !library.length) return;
    const days = Array.from({ length: 8 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const key = localDateKey(date);
      const n = dayNumber(key);
      const bird = birdOfDay(key, library, blocked);
      const first = alarms.filter((a) => a.localDate === key).map((a) => a.fireAt).sort((x, y) => x - y)[0];
      return {
        day: key,
        name: bird.commonName,
        sci: bird.scientificName,
        teaser: teaserFor(n),
        hint: hintFor(n, bird),
        sunset: Math.round(sunsetMs(date.getFullYear(), date.getMonth() + 1, date.getDate(), region) / 1000),
        alarm: first ? Math.round(first / 1000) : 0,
      };
    });
    try {
      storage.set('widget', JSON.stringify({ days, alarms: queue.upcoming.slice(0, 20).map((a) => Math.round(a.fireAt / 1000)) }));
      ExtensionStorage.reloadWidget();
    } catch {}
    // `sig` captures everything the payload depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready]);
}
