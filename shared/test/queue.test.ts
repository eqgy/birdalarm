import { describe, expect, it } from "vitest";
import { birdForAlarm, coverageEnds, emptyQueue, lastFired, localToUtc, planTopUp, resolveBackupBird, type QueueState } from "../src";
import { ALL_DAYS, NY, birds, mulberry32, rule } from "./helpers";

const ny = (y: number, m: number, d: number, h: number) => localToUtc({ y, m, d, h, mi: 0 }, NY);
const DAY = 24 * 3600_000;

const ctx = (now: number, over: Partial<Parameters<typeof planTopUp>[2]> = {}) => ({
  now,
  timeZone: NY,
  libraryIds: birds(60),
  blocked: new Set<string>(),
  rng: mulberry32(42),
  ...over,
});

describe("planTopUp", () => {
  const start = ny(2026, 11, 12, 10);

  it("schedules 14 alarms with 14 different birds on first run", () => {
    const plan = planTopUp(emptyQueue(), [rule()], ctx(start));
    expect(plan.schedule).toHaveLength(14);
    expect(plan.cancel).toEqual([]);
    expect(new Set(plan.schedule.map((a) => a.birdId)).size).toBe(14);
    expect(plan.state.upcoming).toEqual(plan.schedule);
  });

  it("is a no-op when nothing has changed", () => {
    const first = planTopUp(emptyQueue(), [rule()], ctx(start));
    const again = planTopUp(first.state, [rule()], ctx(start + 60_000));
    expect(again.schedule).toEqual([]);
    expect(again.cancel).toEqual([]);
    expect(again.state.upcoming).toEqual(first.state.upcoming);
  });

  it("after a few days, moves rung alarms to history and tops back up to 14", () => {
    const first = planTopUp(emptyQueue(), [rule({ days: ALL_DAYS })], ctx(start));
    const later = planTopUp(first.state, [rule({ days: ALL_DAYS })], ctx(start + 3 * DAY));
    expect(later.cancel).toEqual([]);
    expect(later.schedule).toHaveLength(3);
    expect(later.state.upcoming).toHaveLength(14);
    expect(later.state.fired).toHaveLength(3);
    const morning = lastFired(later.state)!;
    expect(birdForAlarm(later.state, morning.id)).toBe(morning.birdId);
  });

  it("changing the alarm time cancels and reschedules everything", () => {
    const first = planTopUp(emptyQueue(), [rule()], ctx(start));
    const moved = planTopUp(first.state, [rule({ minute: 30 })], ctx(start));
    expect(moved.cancel).toHaveLength(14);
    expect(moved.schedule).toHaveLength(14);
  });

  it("disabling the rule cancels everything and schedules nothing", () => {
    const first = planTopUp(emptyQueue(), [rule()], ctx(start));
    const off = planTopUp(first.state, [rule({ enabled: false })], ctx(start));
    expect(off.cancel).toHaveLength(14);
    expect(off.state.upcoming).toEqual([]);
  });

  it("blocking a bird replaces only the alarm that would have played it", () => {
    const first = planTopUp(emptyQueue(), [rule()], ctx(start));
    const victim = first.state.upcoming[5]!;
    const plan = planTopUp(first.state, [rule()], ctx(start, { blocked: new Set([victim.birdId]) }));
    expect(plan.cancel).toEqual([victim.id]);
    expect(plan.schedule).toHaveLength(1);
    expect(plan.schedule[0]!.fireAt).toBe(victim.fireAt);
    expect(plan.schedule[0]!.birdId).not.toBe(victim.birdId);
  });

  it("over a full library cycle, opening the app daily, no bird repeats", () => {
    let state: QueueState = emptyQueue();
    const rng = mulberry32(9);
    const dealt: string[] = [];
    for (let d = 0; d < 120; d++) {
      const plan = planTopUp(state, [rule({ days: ALL_DAYS })], ctx(start + d * DAY, { rng }));
      expect(plan.cancel).toEqual([]);
      dealt.push(...plan.schedule.map((a) => a.birdId));
      state = plan.state;
    }
    expect(new Set(dealt.slice(0, 60)).size).toBe(60);
    expect(new Set(dealt.slice(60, 120)).size).toBe(60);
    for (let i = 1; i < dealt.length; i++) expect(dealt[i]).not.toBe(dealt[i - 1]);
    expect(state.fired).toHaveLength(60); // history is capped
  });
});

describe("backup alarms", () => {
  const start = ny(2026, 11, 12, 10);
  const daily = [rule({ days: ALL_DAYS })];
  const withBackup = (now: number, over: Partial<Parameters<typeof planTopUp>[2]> = {}) =>
    ctx(now, { backupBirdId: "bird0", ...over });

  it("schedules 14 dealt alarms followed by 14 backups with the backup bird", () => {
    const plan = planTopUp(emptyQueue(), daily, withBackup(start));
    expect(plan.schedule).toHaveLength(28);
    const main = plan.schedule.filter((a) => !a.backup);
    const backup = plan.schedule.filter((a) => a.backup);
    expect(main).toHaveLength(14);
    expect(backup).toHaveLength(14);
    expect(backup.every((a) => a.birdId === "bird0")).toBe(true);
    expect(Math.min(...backup.map((a) => a.fireAt))).toBeGreaterThan(Math.max(...main.map((a) => a.fireAt)));
  });

  it("only one alarm per day, so nothing rings twice", () => {
    const { state } = planTopUp(emptyQueue(), daily, withBackup(start));
    const dates = state.upcoming.map((a) => a.localDate);
    expect(new Set(dates).size).toBe(dates.length);
  });

  it("is a no-op when nothing has changed", () => {
    const first = planTopUp(emptyQueue(), daily, withBackup(start));
    const again = planTopUp(first.state, daily, withBackup(start + 60_000));
    expect(again.schedule).toEqual([]);
    expect(again.cancel).toEqual([]);
  });

  it("promotes backups into the main window with dealt birds as days pass", () => {
    const first = planTopUp(emptyQueue(), daily, withBackup(start));
    const firstBackups = first.state.upcoming.filter((a) => a.backup).slice(0, 3).map((a) => a.id);
    const later = planTopUp(first.state, daily, withBackup(start + 3 * DAY));
    expect(later.cancel).toEqual(firstBackups);
    const promoted = later.schedule.filter((a) => firstBackups.includes(a.id));
    expect(promoted).toHaveLength(3);
    expect(promoted.every((a) => !a.backup)).toBe(true);
    expect(later.schedule.filter((a) => a.backup)).toHaveLength(3);
    expect(later.state.upcoming).toHaveLength(28);
  });

  it("keeps waking you for 28 days if the app is never opened", () => {
    const { state } = planTopUp(emptyQueue(), daily, withBackup(start));
    const cutoff = start + 28 * DAY;
    expect(state.upcoming.filter((a) => a.fireAt <= cutoff)).toHaveLength(28);
    expect(coverageEnds(state)).toBe(state.upcoming.at(-1)!.fireAt);
  });

  it("swaps the backup bird if you block it", () => {
    const first = planTopUp(emptyQueue(), daily, withBackup(start));
    const plan = planTopUp(first.state, daily, withBackup(start, { blocked: new Set(["bird0"]) }));
    const newBackups = plan.schedule.filter((a) => a.backup);
    expect(newBackups).toHaveLength(14);
    expect(newBackups.every((a) => a.birdId === "bird1")).toBe(true);
    expect(resolveBackupBird(withBackup(start, { blocked: new Set(["bird0"]) }))).toBe("bird1");
  });

  it("schedules no backups when no backup bird is set", () => {
    expect(planTopUp(emptyQueue(), daily, ctx(start)).schedule).toHaveLength(14);
  });
});
