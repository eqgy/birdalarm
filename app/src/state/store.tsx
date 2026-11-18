import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { emptyQueue, planTopUp, type QueueState } from '@shared/queue';
import type { AlarmRule } from '@shared/types';

import { birdsFor, detectRegion, type LibraryBird } from '@/data/birds';
import { DEFAULT_LOOK, DEFAULT_TYPE } from '@/theme';

const KEY = 'dawn-chorus/v1';

export interface Settings {
  rule: AlarmRule;
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
  rule: { id: 'main', hour: 6, minute: 45, days: [1, 2, 3, 4, 5], skipDates: [], enabled: true },
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
  updateRule: (patch: Partial<AlarmRule>) => void;
  toggleBlocked: (id: string) => void;
}

const Ctx = createContext<Store | null>(null);

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
  // In this preview build the plan's schedule/cancel lists go nowhere: Expo Go can't ring.
  // The native alarm module will consume them later.
  return planTopUp(queue, [settings.rule], {
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
  const detected = useMemo(detectRegion, []);
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
      commit({
        ...DEFAULT_SETTINGS,
        ...saved.settings,
        rule: { ...DEFAULT_SETTINGS.rule, ...saved.settings?.rule },
      });
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

  const store = useMemo<Store>(
    () => ({
      ready,
      settings,
      queue,
      region,
      detectedRegion: detected,
      library,
      update: (patch) => commit({ ...latest.current.settings, ...patch }),
      updateRule: (patch) => {
        const s = latest.current.settings;
        commit({ ...s, rule: { ...s.rule, ...patch } });
      },
      toggleBlocked: (id) => {
        const s = latest.current.settings;
        const blocked = s.blocked.includes(id) ? s.blocked.filter((b) => b !== id) : [...s.blocked, id];
        commit({ ...s, blocked });
      },
    }),
    [ready, settings, queue, region, detected, library, commit],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider missing');
  return s;
}
