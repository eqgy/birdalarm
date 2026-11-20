/**
 * The bird of the day: decided only by the calendar date, so everyone using the same bird list
 * (the same region, or Worldwide) gets the same bird all day, and the alarm that morning plays it.
 *
 * The list is put into one fixed shuffled order (same seed on every phone), and day N uses
 * position N. That way there are no repeats until every bird has had its day. If you've
 * switched a bird off, your phone skips ahead to the next bird in the order on that day.
 */

/** "YYYY-MM-DD" -> whole days since 1970-01-01. */
export function dayNumber(localDate: string): number {
  const [y, m, d] = localDate.split("-").map(Number);
  return Math.round(Date.UTC(y!, m! - 1, d!) / 86_400_000);
}

/** Small, fast seeded random generator (mulberry32). */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Same order on every phone for the same list and seed. */
export function dailyOrder(libraryIds: readonly string[], seed = DAILY_SEED): string[] {
  const order = [...libraryIds].sort();
  const rand = seeded(seed);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

export const DAILY_SEED = 20261120;

/** The bird for a date, skipping any you've switched off. Undefined only if every bird is off. */
export function dailyBird(
  localDate: string,
  libraryIds: readonly string[],
  blocked: ReadonlySet<string> = new Set(),
  seed = DAILY_SEED,
): string | undefined {
  const order = dailyOrder(libraryIds, seed);
  const n = order.length;
  if (!n) return undefined;
  const start = ((dayNumber(localDate) % n) + n) % n;
  for (let k = 0; k < n; k++) {
    const id = order[(start + k) % n]!;
    if (!blocked.has(id)) return id;
  }
  return undefined;
}
