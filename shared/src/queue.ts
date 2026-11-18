/**
 * AlarmQueue: keeps the next N one-off alarms per rule scheduled, each with its own bird,
 * followed by M backup one-off alarms (all the same backup bird) so you still wake up if
 * the app isn't opened for a while. No repeating alarm is used, so nothing ever rings twice.
 *
 * Pure function: given saved state + rules + now, returns the new state and the native
 * calls to make. The app runs this every time it opens.
 *
 * The native side must apply `cancel` before `schedule`: when a backup alarm moves into the
 * main window it is cancelled and rescheduled under the same id with a dealt bird.
 */
import { dealBird, emptyDeck, type DeckState, type Rng } from "./rotation";
import { nextOccurrences } from "./schedule";
import type { AlarmRule, ScheduledAlarm } from "./types";

export const DEFAULT_QUEUE_SIZE = 14;
export const DEFAULT_BACKUP_COUNT = 14;
const FIRED_HISTORY = 60;

export interface QueueState {
  deck: DeckState;
  upcoming: ScheduledAlarm[];
  /** Alarms whose time has passed, oldest first. The morning card reads from here. */
  fired: ScheduledAlarm[];
}

export const emptyQueue = (): QueueState => ({ deck: emptyDeck(), upcoming: [], fired: [] });

export interface TopUpContext {
  now: number;
  timeZone: string;
  libraryIds: readonly string[];
  blocked: ReadonlySet<string>;
  rng: Rng;
  /** Main alarms per rule, each with a dealt bird. */
  queueSize?: number;
  /** Bird for backup alarms. Omit to schedule no backups. */
  backupBirdId?: string;
  /** Backup alarms per rule after the main queue. */
  backupCount?: number;
}

export interface TopUpPlan {
  state: QueueState;
  schedule: ScheduledAlarm[];
  cancel: string[];
}

const alarmId = (ruleId: string, localDate: string) => `${ruleId}:${localDate}`;

/** The configured backup bird, or the first usable library bird if it's blocked or missing. */
export function resolveBackupBird(ctx: TopUpContext): string | undefined {
  if (ctx.backupBirdId === undefined) return undefined;
  const usable = (id: string) => ctx.libraryIds.includes(id) && !ctx.blocked.has(id);
  return usable(ctx.backupBirdId) ? ctx.backupBirdId : ctx.libraryIds.find(usable);
}

export function planTopUp(prev: QueueState, rules: readonly AlarmRule[], ctx: TopUpContext): TopUpPlan {
  const size = ctx.queueSize ?? DEFAULT_QUEUE_SIZE;
  const backupBird = resolveBackupBird(ctx);
  const backups = backupBird === undefined ? 0 : (ctx.backupCount ?? DEFAULT_BACKUP_COUNT);

  // 1. Anything at or before now has rung (or should have): move it to history.
  const justFired = prev.upcoming.filter((a) => a.fireAt <= ctx.now);
  const stillUpcoming = prev.upcoming.filter((a) => a.fireAt > ctx.now);
  const fired = [...prev.fired, ...justFired].sort((a, b) => a.fireAt - b.fireAt).slice(-FIRED_HISTORY);

  // 2. Work out which alarms *should* exist now: main window first, then backups.
  interface Wanted { ruleId: string; fireAt: number; localDate: string; backup: boolean }
  const wanted = new Map<string, Wanted>();
  for (const rule of rules) {
    nextOccurrences(rule, ctx.now, size + backups, ctx.timeZone).forEach((occ, i) => {
      wanted.set(alarmId(rule.id, occ.localDate), { ruleId: rule.id, ...occ, backup: i >= size });
    });
  }

  // 3. Keep existing alarms that still match exactly; cancel the rest.
  const library = new Set(ctx.libraryIds);
  const keep: ScheduledAlarm[] = [];
  const cancel: string[] = [];
  for (const a of stillUpcoming) {
    const w = wanted.get(a.id);
    const birdOk = w?.backup
      ? a.birdId === backupBird
      : library.has(a.birdId) && !ctx.blocked.has(a.birdId);
    if (w && w.fireAt === a.fireAt && w.backup === !!a.backup && birdOk) {
      keep.push(a);
      wanted.delete(a.id);
    } else {
      cancel.push(a.id);
    }
  }

  // 4. Deal birds for new main alarms in chronological order; backups get the backup bird.
  let deck = prev.deck;
  const schedule: ScheduledAlarm[] = [];
  for (const [id, w] of [...wanted].sort((x, y) => x[1].fireAt - y[1].fireAt)) {
    const base = { id, ruleId: w.ruleId, fireAt: w.fireAt, localDate: w.localDate };
    if (w.backup) {
      schedule.push({ ...base, birdId: backupBird!, backup: true });
    } else {
      const dealt = dealBird(deck, ctx.libraryIds, ctx.blocked, ctx.rng);
      deck = dealt.deck;
      schedule.push({ ...base, birdId: dealt.birdId });
    }
  }

  const upcoming = [...keep, ...schedule].sort((a, b) => a.fireAt - b.fireAt);
  return { state: { deck, upcoming, fired }, schedule, cancel };
}

/** Which bird a given alarm played (or will play). Used for the "Who woke you up" card. */
export function birdForAlarm(state: QueueState, id: string): string | undefined {
  return (state.fired.find((a) => a.id === id) ?? state.upcoming.find((a) => a.id === id))?.birdId;
}

/** The most recent alarm that has rung, for opening the app after waking. */
export const lastFired = (state: QueueState): ScheduledAlarm | undefined => state.fired.at(-1);

/** When the last scheduled alarm (main or backup) rings; after this, nothing will wake you. */
export function coverageEnds(state: QueueState, ruleId?: string): number | undefined {
  const list = state.upcoming.filter((a) => ruleId === undefined || a.ruleId === ruleId);
  return list.at(-1)?.fireAt;
}
