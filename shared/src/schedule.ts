/**
 * Turning an AlarmRule ("weekdays 6:45") into concrete instants, in an explicit
 * IANA time zone so the math is the same on every device and in tests.
 *
 * DST rules:
 * - Spring forward: a wall-clock time that doesn't exist (02:30 on the change day
 *   in the US) rings one hour later in wall-clock terms (03:30), never skipped.
 * - Fall back: an ambiguous time (01:30) rings at the first occurrence.
 */
import type { AlarmRule } from "./types";

interface LocalParts {
  y: number;
  m: number; // 1-12
  d: number;
  h: number;
  mi: number;
}

const formatters = new Map<string, Intl.DateTimeFormat>();
function formatter(timeZone: string): Intl.DateTimeFormat {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

export function localParts(utcMs: number, timeZone: string): LocalParts & { s: number } {
  const out: Record<string, number> = {};
  for (const p of formatter(timeZone).formatToParts(new Date(utcMs))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return { y: out.year!, m: out.month!, d: out.day!, h: out.hour!, mi: out.minute!, s: out.second! };
}

/** Offset of the zone from UTC at a given instant, in ms (e.g. -5h for EST). */
function offsetMs(utcMs: number, timeZone: string): number {
  const p = localParts(utcMs, timeZone);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi, p.s);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in a zone -> UTC epoch ms, with the DST rules above. */
export function localToUtc(p: LocalParts, timeZone: string): number {
  const guess = Date.UTC(p.y, p.m - 1, p.d, p.h, p.mi);
  const o1 = offsetMs(guess, timeZone);
  const t1 = guess - o1;
  const o2 = offsetMs(t1, timeZone);
  if (o1 === o2) return t1;
  const t2 = guess - o2;
  if (offsetMs(t2, timeZone) === o2) return Math.min(t1, t2); // ambiguous: first occurrence
  return Math.max(t1, t2); // gap: push forward
}

export const isoDate = (y: number, m: number, d: number): string =>
  `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

export interface Occurrence {
  fireAt: number;
  localDate: string;
}

/** The next `count` times a rule rings strictly after `fromMs`. */
export function nextOccurrences(
  rule: AlarmRule,
  fromMs: number,
  count: number,
  timeZone: string,
): Occurrence[] {
  if (!rule.enabled || rule.days.length === 0 || count <= 0) return [];
  const start = localParts(fromMs, timeZone);
  const skip = new Set(rule.skipDates);
  const out: Occurrence[] = [];

  // Walk calendar days. 7 * count + 7 covers any weekday pattern plus skips up to a point;
  // cap at ~2 years so a rule with every day skipped can't loop forever.
  for (let i = 0; out.length < count && i < 730; i++) {
    const day = new Date(Date.UTC(start.y, start.m - 1, start.d + i));
    const y = day.getUTCFullYear();
    const m = day.getUTCMonth() + 1;
    const d = day.getUTCDate();
    if (!rule.days.includes(day.getUTCDay())) continue;
    const localDate = isoDate(y, m, d);
    if (skip.has(localDate)) continue;
    const fireAt = localToUtc({ y, m, d, h: rule.hour, mi: rule.minute }, timeZone);
    if (fireAt > fromMs) out.push({ fireAt, localDate });
  }
  return out;
}
