/**
 * JS side of the Dawn Chorus alarm module. On an iPhone build it talks to AlarmKit; in Expo Go,
 * on the web and on Android (not written yet) the native module is missing and `DawnAlarm` is null,
 * so callers must check `alarmsAvailable` first.
 */
import { requireOptionalNativeModule } from 'expo';

export type AlarmAuthorization = 'notDetermined' | 'authorized' | 'denied';

export interface AlarmRequest {
  id: string;
  /** Epoch milliseconds. */
  fireAt: number;
  title: string;
  /** The bird dealt to this morning, for the Live Activity. */
  birdName?: string;
  /** Minutes Snooze waits; 0 or missing = no Snooze button. */
  snoozeMinutes?: number;
  /** Exact bundled sound filename, or omit for the system alarm sound. */
  sound?: string;
}

interface DawnAlarmNative {
  authorizationStatus(): Promise<AlarmAuthorization>;
  requestAuthorization(): Promise<AlarmAuthorization>;
  replaceAll(alarms: AlarmRequest[]): Promise<number>;
  listAlarms(): Promise<{ uuid: string; fireAt?: number }[]>;
  cancelAll(): Promise<void>;
}

export const DawnAlarm = requireOptionalNativeModule<DawnAlarmNative>('DawnAlarm');
export const alarmsAvailable = DawnAlarm !== null;
