import { describe, expect, it } from "vitest";
import { dailyBird, dailyOrder, dayNumber, emptyQueue, localToUtc, planTopUp } from "../src";
import { NY, birds, mulberry32, rule } from "./helpers";

const dates = (from: string, count: number) => {
  const start = Date.UTC(...(from.split("-").map(Number) as [number, number, number])) - 30 * 86_400_000;
  return Array.from({ length: count }, (_, i) => new Date(start + 30 * 86_400_000 + i * 86_400_000).toISOString().slice(0, 10));
};

describe("dailyBird", () => {
  const lib = birds(69);

  it("is the same for everyone with the same list, whatever order it arrives in", () => {
    const shuffled = [...lib].reverse();
    for (const d of dates("2026-11-20", 30)) expect(dailyBird(d, shuffled)).toBe(dailyBird(d, lib));
  });

  it("uses every bird once before any repeats", () => {
    const run = dates("2026-01-01", lib.length).map((d) => dailyBird(d, lib));
    expect(new Set(run).size).toBe(lib.length);
  });

  it("skips a bird you've switched off, and only on your phone", () => {
    const day = "2026-11-20";
    const usual = dailyBird(day, lib)!;
    const mine = dailyBird(day, lib, new Set([usual]));
    expect(mine).not.toBe(usual);
    expect(mine).toBe(dailyOrder(lib)[(dayNumber(day) + 1) % lib.length]);
  });

  it("returns undefined only when every bird is off", () => {
    expect(dailyBird("2026-11-20", lib, new Set(lib))).toBeUndefined();
    expect(dailyBird("2026-11-20", [])).toBeUndefined();
  });

  it("counts days from the calendar date", () => {
    expect(dayNumber("1970-01-02")).toBe(1);
    expect(dayNumber("2026-11-21") - dayNumber("2026-11-20")).toBe(1);
  });
});

describe("planTopUp with birdForDate", () => {
  const lib = birds(69);
  const ctx = (now: number) => ({
    now,
    timeZone: NY,
    libraryIds: lib,
    blocked: new Set<string>(),
    rng: mulberry32(1),
    backupBirdId: lib[0],
    birdForDate: (d: string) => dailyBird(d, lib),
  });
  const start = localToUtc({ y: 2026, m: 11, d: 20, h: 10, mi: 0 }, NY);

  it("gives every alarm, backups included, its date's bird", () => {
    const plan = planTopUp(emptyQueue(), [rule()], ctx(start));
    expect(plan.schedule.length).toBe(28);
    for (const a of plan.schedule) expect(a.birdId).toBe(dailyBird(a.localDate, lib));
  });

  it("keeps the same alarms when opened again", () => {
    const first = planTopUp(emptyQueue(), [rule()], ctx(start));
    const again = planTopUp(first.state, [rule()], ctx(start + 3600_000));
    expect(again.schedule).toEqual([]);
    expect(again.cancel).toEqual([]);
  });

  it("two alarms on the same morning play the same bird", () => {
    const early = { ...rule(), id: "early", hour: 6 };
    const late = { ...rule(), id: "late", hour: 7 };
    const plan = planTopUp(emptyQueue(), [early, late], ctx(start));
    const byDate = new Map<string, Set<string>>();
    for (const a of plan.schedule) byDate.set(a.localDate, (byDate.get(a.localDate) ?? new Set()).add(a.birdId));
    for (const set of byDate.values()) expect(set.size).toBe(1);
  });
});
