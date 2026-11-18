import type React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { emptyQueue, planTopUp, type QueueState } from '@shared/queue';
import type { AlarmRule } from '@shared/types';

import { birdsFor, detectRegion, type LibraryBird } from '@/data/birds';
import { DEFAULT_LOOK, DEFAULT_TYPE } from '@/theme';

import { useAlarmSync, type AlarmSyncStatus } from './alarm-sync';

const KEY = 'dawn-chorus/v1';

export interface Settings {
  /** Your alarms, e.g. weekdays 6:45 and weekends 8:30. */
  rules: AlarmRule[];
  /** Minutes the Snooze button waits before ringing again. 0 = no Snooze button. */
  snoozeMinutes: number;
  worldwide: boolean;
  /** 'auto' follows the phone's region setting; otherwise a region tag you picked. */
  region: string;
  blocked: string[];
  /** Which font and colour look is active (see theme.ts). */
  look: string;
  /** Which type style is active (see theme.ts). */
  type: string;
}

const DEFAULT_SETTINGS: Settings = {
  rules: [{ id: 'main', hour: 6, minute: 45, days: [1, 2, 3, 4, 5], skipDates: [], enabled: true }],
  snoozeMinutes: 9,
  worldwide: false,
  region: 'auto',
  blocked: [],
  look: DEFAULT_LOOK,
  type: DEFAULT_TYPE,
};

interface Store {
  ready: boolean;
  settings: Settings;
  queue: QueueState;
  region: string | undefined;
  /** What the phone's region setting maps to, whatever you picked. */
  detectedRegion: string | undefined;
  library: LibraryBird[];
  update: (patch: Partial<Settings>) => void;
  updateRule: (id: string, patch: Partial<AlarmRule>) => void;
  /** Adds an alarm and returns its id. */
  addRule: () => string;
  removeRule: (id: string) => void;
  toggleBlocked: (id: string) => void;
  /** Whether the phone's real alarms match the queue. */
  alarmSync: AlarmSyncStatus;
  retryAlarmSync: () => void;
}

// Kept on globalThis so that if the bundler ever loads this file twice (the web dev server's
// lazy route bundles can), every copy shares one context instead of throwing "StoreProvider missing".
const g = globalThis as { __dawnChorusStore?: React.Context<Store | null> };
const Ctx = (g.__dawnChorusStore ??= createContext<Store | null>(null));

function timeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

function topUp(queue: QueueState, settings: Settings, library: LibraryBird[]): QueueState {
  const ids = library.map((b) => b.id);
  // Never let "everything is skipped" leave you with no alarm.
  const blockedAll = ids.every((id) => settings.blocked.includes(id));
  const blocked = new Set(blockedAll ? [] : settings.blocked);
  // Keep the total number of alarms on the phone around 30 however many alarms you set:
  // each alarm gets its share of the dealt mornings and of the backups.
  const active = Math.max(1, settings.rules.filter((r) => r.enabled && r.days.length).length);
  const share = Math.max(5, Math.round(14 / active));
  // The full list is handed to the native module by useAlarmSync, which replaces what's on the phone.
  return planTopUp(queue, settings.rules, {
    queueSize: share,
    backupCount: share,
    now: Date.now(),
    timeZone: timeZone(),
    libraryIds: ids,
    blocked,
    rng: Math.random,
    backupBirdId: ids[0],
  }).state;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [queue, setQueue] = useState<QueueState>(emptyQueue);
  const detected = useMemo(() => detectRegion(), []);
  const region = settings.region === 'auto' ? detected : settings.region;
  const library = useMemo(() => birdsFor(region, settings.worldwide), [region, settings.worldwide]);

  const latest = useRef({ settings, queue });

  const commit = useCallback(
    (nextSettings: Settings) => {
      const lib = birdsFor(nextSettings.region === 'auto' ? detected : nextSettings.region, nextSettings.worldwide);
      const nextQueue = topUp(latest.current.queue, nextSettings, lib);
      latest.current = { settings: nextSettings, queue: nextQueue };
      setSettings(nextSettings);
      setQueue(nextQueue);
      AsyncStorage.setItem(KEY, JSON.stringify(latest.current)).catch(() => {});
    },
    [detected],
  );

  useEffect(() => {
    (async () => {
      let saved: { settings?: Partial<Settings>; queue?: QueueState } = {};
      try {
        const raw = await AsyncStorage.getItem(KEY);
        if (raw) saved = JSON.parse(raw);
      } catch {}
      latest.current.queue = saved.queue ?? emptyQueue();
      // Older saves had a single `rule`; turn it into the first alarm in the list.
      const old = (saved.settings as { rule?: AlarmRule } | undefined)?.rule;
      const rules = saved.settings?.rules ?? (old ? [{ ...DEFAULT_SETTINGS.rules[0]!, ...old }] : DEFAULT_SETTINGS.rules);
      const { rule: _drop, ...rest } = (saved.settings ?? {}) as Partial<Settings> & { rule?: AlarmRule };
      commit({ ...DEFAULT_SETTINGS, ...rest, rules });
      setReady(true);
    })();
  }, [commit]);

  // Top the queue back up whenever the app comes to the foreground.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') commit(latest.current.settings);
    });
    return () => sub.remove();
  }, [commit]);

  const sync = useAlarmSync(queue.upcoming, ready, settings.snoozeMinutes);

  const store = useMemo<Store>(
    () => ({
      ready,
      settings,
      queue,
      region,
      detectedRegion: detected,
      library,
      update: (patch) => commit({ ...latest.current.settings, ...patch }),
      updateRule: (id, patch) => {
        const s = latest.current.settings;
        commit({ ...s, rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)) });
      },
      addRule: () => {
        const s = latest.current.settings;
        const id = `alarm-${Date.now().toString(36)}`;
        const rule: AlarmRule = { id, hour: 8, minute: 30, days: [0, 6], skipDates: [], enabled: true };
        commit({ ...s, rules: [...s.rules, rule] });
        return id;
      },
      removeRule: (id) => {
        const s = latest.current.settings;
        commit({ ...s, rules: s.rules.filter((r) => r.id !== id) });
      },
      alarmSync: sync.status,
      retryAlarmSync: sync.retry,
      toggleBlocked: (id) => {
        const s = latest.current.settings;
        const blocked = s.blocked.includes(id) ? s.blocked.filter((b) => b !== id) : [...s.blocked, id];
        commit({ ...s, blocked });
      },
    }),
    [ready, settings, queue, region, detected, library, commit, sync.status, sync.retry],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
