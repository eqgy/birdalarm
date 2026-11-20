/**
 * Shares what the Lock Screen widget shows: today's bird (and the next few days', so it
 * changes at midnight even if the app isn't opened) and the upcoming alarm times.
 * Written as JSON to the App Group the widget reads (targets/alarm-widget/BirdWidget.swift).
 * In Expo Go and on the web ExtensionStorage does nothing.
 */
import { ExtensionStorage } from '@bacons/apple-targets';
import { useEffect } from 'react';

import { lastFired, type QueueState } from '@shared/queue';

import { birdById, birdOfDay, localDayNumber, type LibraryBird } from '@/data/birds';

export const APP_GROUP = 'group.io.github.dawnchorus.app';
const storage = new ExtensionStorage(APP_GROUP);

const pad = (n: number) => String(n).padStart(2, '0');
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export function useWidgetSync(queue: QueueState, library: LibraryBird[], ready: boolean) {
  const woke = birdById(lastFired(queue)?.birdId);
  const alarms = queue.upcoming.slice(0, 20).map((a) => Math.round(a.fireAt / 1000));
  const sig = `${woke?.id}|${library.length}|${alarms.join(',')}`;

  useEffect(() => {
    if (!ready || !library.length) return;
    const today = localDayNumber();
    const days = Array.from({ length: 8 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() + i);
      const bird = i === 0 && woke ? woke : birdOfDay(today + i, library);
      return { day: localDate(date), name: bird.commonName, sci: bird.scientificName, woke: i === 0 && woke ? 1 : 0 };
    });
    try {
      storage.set('widget', JSON.stringify({ days, alarms }));
      ExtensionStorage.reloadWidget();
    } catch {}
    // `sig` captures everything the payload depends on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sig, ready]);
}
