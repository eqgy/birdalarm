/**
 * Rough sunset time without asking for location. Longitude comes from the phone's standard
 * time zone offset (15 degrees per hour) and latitude from the region (North America ~40°N,
 * Europe ~50°N). Good to within about half an hour for most people, which is all the widget
 * needs to know when evening has come. Uses NOAA's simplified solar equations.
 */
const LATITUDE: Record<string, number> = { 'north-america': 40, europe: 50 };

/** Standard (not daylight-saving) offset east of UTC, in hours. */
function standardOffsetHours(year: number): number {
  const jan = new Date(year, 0, 1).getTimezoneOffset();
  const jul = new Date(year, 6, 1).getTimezoneOffset();
  return -Math.max(jan, jul) / 60;
}

/** Sunset for a local calendar date, as epoch milliseconds. Falls back to 18:00 near the poles. */
export function sunsetMs(year: number, month: number, day: number, region?: string): number {
  const lat = (LATITUDE[region ?? ''] ?? 40) * (Math.PI / 180);
  const lon = standardOffsetHours(year) * 15; // degrees east
  const start = Date.UTC(year, 0, 1);
  const n = Math.round((Date.UTC(year, month - 1, day) - start) / 86_400_000) + 1;
  const g = ((2 * Math.PI) / 365) * (n - 1);
  const decl =
    0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g) +
    0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const eqTime =
    229.18 * (0.000075 + 0.001868 * Math.cos(g) - 0.032077 * Math.sin(g) - 0.014615 * Math.cos(2 * g) -
      0.040849 * Math.sin(2 * g));
  const cosHa = Math.cos((90.833 * Math.PI) / 180) / (Math.cos(lat) * Math.cos(decl)) - Math.tan(lat) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return new Date(year, month - 1, day, 18).getTime();
  const ha = (Math.acos(cosHa) * 180) / Math.PI;
  const minutesUtc = 720 - 4 * (lon - ha) - eqTime;
  return Date.UTC(year, month - 1, day) + minutesUtc * 60_000;
}
