/** Licenses the project accepts for bundled audio. See CREDITS.md and pipeline/check_birds.py. */
export type AllowedLicense = "CC0" | "CC BY" | "CC BY-SA";

export interface Bird {
  id: string;
  commonName: string;
  scientificName: string;
  /** Region tags, e.g. "north-america", "europe". */
  regions: string[];
  fact: string;
  /** Exact bundled filename without directory, e.g. "amro.caf". AlarmKit needs the exact string. */
  alarmFile: string;
  /** In-app playback file (AAC .m4a). */
  playbackFile: string;
  recordist: string;
  license: AllowedLicense;
  /** xeno-canto catalogue number, e.g. "XC123456". */
  xcNumber: string;
  sourceUrl: string;
}

/** A user-set alarm, e.g. weekdays 6:45. Times are wall-clock in the device's time zone. */
export interface AlarmRule {
  id: string;
  hour: number; // 0-23
  minute: number; // 0-59
  /** Weekdays it repeats on, 0 = Sunday ... 6 = Saturday. */
  days: number[];
  /** Local dates to skip, "YYYY-MM-DD". */
  skipDates: string[];
  enabled: boolean;
}

/** One concrete one-off alarm handed to the native module. */
export interface ScheduledAlarm {
  id: string;
  ruleId: string;
  /** Epoch milliseconds (UTC). */
  fireAt: number;
  /** Local calendar date it fires on, "YYYY-MM-DD". */
  localDate: string;
  birdId: string;
  /**
   * Backup alarms cover the days after the main queue, in case the app isn't opened.
   * They all use the same backup bird and are swapped for a dealt bird once they move
   * into the main queue window.
   */
  backup?: boolean;
}
