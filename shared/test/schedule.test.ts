import { describe, expect, it } from "vitest";
import { localParts, localToUtc, nextOccurrences } from "../src";
import { ALL_DAYS, NY, rule } from "./helpers";

const ny = (y: number, m: number, d: number, h: number, mi = 0) => localToUtc({ y, m, d, h, mi }, NY);
const wall = (ms: number, tz = NY) => {
  const p = localParts(ms, tz);
  return `${p.h}:${String(p.mi).padStart(2, "0")}`;
};

describe("nextOccurrences", () => {
  it("weekdays 6:45 starting Thursday morning", () => {
    const from = ny(2026, 11, 12, 10); // Thu 10:00, today's alarm already passed
    const occ = nextOccurrences(rule(), from, 5, NY);
    expect(occ.map((o) => o.localDate)).toEqual([
      "2026-11-13", "2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19",
    ]);
    for (const o of occ) expect(wall(o.fireAt)).toBe("6:45");
  });

  it("includes today when the alarm time is still ahead", () => {
    const occ = nextOccurrences(rule(), ny(2026, 11, 12, 5), 1, NY);
    expect(occ[0]!.localDate).toBe("2026-11-12");
  });

  it("stays at 6:45 local across the fall-back change", () => {
    const occ = nextOccurrences(rule({ days: ALL_DAYS }), ny(2026, 10, 28, 12), 10, NY);
    for (const o of occ) expect(wall(o.fireAt)).toBe("6:45");
    // Gap between Oct 31 and Nov 1 alarms is 25 hours in real time.
    const i = occ.findIndex((o) => o.localDate === "2026-11-01");
    expect(occ[i]!.fireAt - occ[i - 1]!.fireAt).toBe(25 * 3600_000);
  });

  it("spring forward: a 2:30 alarm that doesn't exist rings at 3:30", () => {
    const occ = nextOccurrences(rule({ hour: 2, minute: 30, days: ALL_DAYS }), ny(2027, 3, 13, 12), 2, NY);
    expect(occ[0]!.localDate).toBe("2027-03-14");
    expect(wall(occ[0]!.fireAt)).toBe("3:30");
    expect(wall(occ[1]!.fireAt)).toBe("2:30");
  });

  it("fall back: an ambiguous 1:30 alarm rings at the first 1:30 (EDT)", () => {
    const [o] = nextOccurrences(rule({ hour: 1, minute: 30, days: ALL_DAYS }), ny(2026, 10, 31, 12), 1, NY);
    expect(new Date(o!.fireAt).toISOString()).toBe("2026-11-01T05:30:00.000Z");
  });

  it("skips skip-dates", () => {
    const occ = nextOccurrences(rule({ skipDates: ["2026-11-16"] }), ny(2026, 11, 12, 10), 2, NY);
    expect(occ.map((o) => o.localDate)).toEqual(["2026-11-13", "2026-11-17"]);
  });

  it("returns nothing for disabled or empty rules", () => {
    expect(nextOccurrences(rule({ enabled: false }), 0, 5, NY)).toEqual([]);
    expect(nextOccurrences(rule({ days: [] }), 0, 5, NY)).toEqual([]);
  });

  it("works in a zone without DST and one east of UTC", () => {
    const tz = "Asia/Tokyo";
    const from = localToUtc({ y: 2026, m: 11, d: 12, h: 10, mi: 0 }, tz);
    const occ = nextOccurrences(rule({ days: ALL_DAYS }), from, 3, tz);
    expect(occ.map((o) => o.localDate)).toEqual(["2026-11-13", "2026-11-14", "2026-11-15"]);
    for (const o of occ) expect(wall(o.fireAt, tz)).toBe("6:45");
  });
});
