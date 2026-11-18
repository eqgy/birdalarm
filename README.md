# Dawn Chorus

A free, open-source alarm that wakes you to a different real bird song every morning and tells you who was singing. No account, no tracking, no subscription.

Status: early. The alarm logic is tested, the preview app runs in Expo Go, and the iPhone alarm module is written but not yet built. Bird recordings and snooze are next.

## Layout

| Path | What | State |
|---|---|---|
| `shared/` | Plain TypeScript: bird rotation, schedule math, the rolling 14-alarm queue | Done, 28 tests |
| `pipeline/` | License checker (7 tests), photo fetcher (Wikimedia Commons), audio curation (not started) | Partly done |
| `app/` | Expo (React Native) app: Today, Alarm, Birds, Settings, Credits; 42 birds with photos | Preview works in Expo Go |
| `app/modules/dawn-alarm/` | Swift, AlarmKit (iOS 26+) | Written, not yet compiled |
| Android alarm module | Kotlin, AlarmManager + foreground audio service | Not started |
| `docs/install-iphone.md` | Building in the cloud and installing through TestFlight | Done |
| `audio/` | Bundled `.caf` (iPhone alarms) and `.m4a` (playback) clips | Empty |
| `birds.json` | The bird library | Empty |

## Run the tests

```
cd shared && npm install && npm test
python -m unittest discover -s pipeline/tests
python pipeline/check_birds.py birds.json --audio-dir audio
```

## How the alarm logic works

- **Rotation** (`shared/src/rotation.ts`): the library is shuffled into a deck; one bird is dealt per alarm; no repeats until the deck runs out; a new deck never starts with the bird that ended the last one. Blocked or removed birds are skipped.
- **Schedule** (`shared/src/schedule.ts`): turns "weekdays 6:45" into exact instants in an explicit time zone. On the spring-forward day an alarm in the missing hour rings an hour later (2:30 → 3:30); on the fall-back day an ambiguous time rings at its first occurrence.
- **Queue** (`shared/src/queue.ts`): `planTopUp()` is a pure function the app calls every time it opens. It returns the native calls to make (`schedule`, `cancel`) to keep the next 14 alarms per rule scheduled, each with its own bird, and records which bird each alarm played for the morning card. Unchanged alarms are left alone, so opening the app twice does nothing.
- **Backup alarms** (also `queue.ts`): after the 14 main alarms, 14 more one-off alarms are scheduled with a single backup bird, so you still wake up for 28 days if the app is never opened. There's no repeating alarm, so nothing rings twice. When a backup day moves into the main 14-day window it's cancelled and rescheduled under the same id with a dealt bird; the native module must apply cancels before schedules. If you block the backup bird, the first unblocked bird is used instead.

## Building for iPhone from Windows

Xcode only runs on a Mac, so the iOS build goes through **EAS Build** (Expo's cloud build service, which has a free tier). It needs an Apple Developer Program membership to install on a real phone via TestFlight or ad-hoc. The alternative is borrowing a Mac.

## Open design questions

- **Number of scheduled alarms.** With backups that's 28 one-off alarms per rule. Check AlarmKit's per-app limit during the spike; `queueSize` and `backupCount` are parameters.
- **Code license.** MIT or GPL-3.0, still open. Audio keeps its own per-file CC licenses (see `CREDITS.md`).

## Audio licensing

Only CC0, CC BY and CC BY-SA recordings are allowed. Every bird needs recordist, license and xeno-canto number; `pipeline/check_birds.py` fails CI otherwise.
