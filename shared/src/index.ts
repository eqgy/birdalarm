export * from "./types";
export * from "./rotation";
export * from "./schedule";
export * from "./queue";

/** The interface both native alarm modules (and the web stub) implement. */
export interface AlarmModule {
  /** Schedule a one-off alarm. `soundFile` is the exact bundled filename, e.g. "amro.caf". */
  scheduleAlarm(id: string, fireAt: Date, soundFile: string): Promise<void>;
  cancelAlarm(id: string): Promise<void>;
  listAlarms(): Promise<{ id: string; fireAt: Date }[]>;
}
