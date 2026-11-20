# Dawn Chorus

A free, open-source alarm that wakes you to a different real bird song every morning and tells you who was singing. No account, no tracking, no subscription.

Status: ready for its first iPhone build. 69 birds with real songs and photos, multiple alarms with snooze, and a Lock Screen Live Activity. The alarm logic is tested and the app runs in Expo Go; the native iPhone parts (AlarmKit module and widget) are written but haven't been compiled yet. Android isn't started.

## Layout

| Path | What | State |
|---|---|---|
| `shared/` | Plain TypeScript: bird of the day, schedule math, the rolling alarm queue | Done, 36 tests |
| `pipeline/` | License checker (7 tests), photo fetchers (Wikimedia Commons), audio converter (`fetch_audio.py`), icon generator | Done |
| `app/` | Expo (React Native) app: Today, Alarm, Birds, Settings, Credits; 69 birds with photos, lookalikes, multiple alarms with snooze | Preview works in Expo Go |
| `app/modules/dawn-alarm/` | Swift, AlarmKit (iOS 26+) | Written, not yet compiled |
| Android alarm module | Kotlin, AlarmManager + foreground audio service | Not started |
| `HOW-TO-UPLOAD.md` | Building in the cloud and uploading to TestFlight (for the Apple account holder) | Done |
| `app/targets/alarm-widget/` | Live Activity shown on the Lock Screen and Dynamic Island while ringing or snoozed | Written, not yet compiled |
| `app/assets/sounds/`, `app/assets/audio/` | 69 `.caf` alarm sounds (28 s) and `.m4a` playback clips (45 s), from xeno-canto | Done |
| `birds.json` | The bird library with recordist, license and xeno-canto number for each song | Done, 69 birds |

## Set up

Everything needed to build is in this repo; only installed packages are left out (`node_modules`), and `npm install` recreates them from the lock files.

- **App:** Node.js LTS, then `cd app && npm install && npx expo start`. Scan the QR code with Expo Go to preview (the preview can't ring; alarms need the real build).
- **iPhone build:** see `HOW-TO-UPLOAD.md` (EAS Build in the cloud; no Mac needed).
- **Pipeline (only to change birds, photos or songs):** Python 3.11+, Pillow and ffmpeg. `python pipeline/fetch_audio.py --from-folder <folder of xeno-canto downloads>` converts recordings and looks up each license on its xeno-canto page.

## Run the tests

```
cd shared && npm install && npm test
python -m unittest discover -s pipeline/tests
python pipeline/check_birds.py birds.json
```

## How the alarm logic works

- **Bird of the day** (`shared/src/daily.ts`): the bird depends only on the date. The bird list is put in one fixed shuffled order (same seed on every phone) and each date takes the next bird, so everyone with the same region (or Worldwide) hears the same bird all day, with no repeats until every bird has had a turn. A bird you've switched off is skipped on your phone only. Every alarm that day, backups included, plays it.
- **Rotation** (`shared/src/rotation.ts`, used only when no date bird is given): the library is shuffled into a deck; one bird is dealt per alarm; no repeats until the deck runs out; a new deck never starts with the bird that ended the last one. Blocked or removed birds are skipped.
- **Schedule** (`shared/src/schedule.ts`): turns "weekdays 6:45" into exact instants in an explicit time zone. On the spring-forward day an alarm in the missing hour rings an hour later (2:30 → 3:30); on the fall-back day an ambiguous time rings at its first occurrence.
- **Queue** (`shared/src/queue.ts`): `planTopUp()` is a pure function the app calls every time it opens. It returns the native calls to make (`schedule`, `cancel`) to keep the next 14 alarms per rule scheduled, each with its own bird, and records which bird each alarm played for the morning card. Unchanged alarms are left alone, so opening the app twice does nothing.
- **Backup alarms** (also `queue.ts`): after the 14 main alarms, 14 more one-off alarms are scheduled with a single backup bird, so you still wake up for 28 days if the app is never opened. There's no repeating alarm, so nothing rings twice. When a backup day moves into the main 14-day window it's cancelled and rescheduled under the same id with a dealt bird; the native module must apply cancels before schedules. If you block the backup bird, the first unblocked bird is used instead.

## Building for iPhone from Windows

Xcode only runs on a Mac, so the iOS build goes through **EAS Build** (Expo's cloud build service, which has a free tier). It needs an Apple Developer Program membership to install on a real phone via TestFlight or ad-hoc. The alternative is borrowing a Mac.

## Open design questions

- **Number of scheduled alarms.** With backups that's 28 one-off alarms per rule. Check AlarmKit's per-app limit during the spike; `queueSize` and `backupCount` are parameters.

## Audio licensing

Only CC0, CC BY and CC BY-SA recordings are allowed. Every bird needs recordist, license and xeno-canto number; `pipeline/check_birds.py` fails CI otherwise.

## License

The code is under the MIT License (see `LICENSE`). Bird recordings and photos are not covered by it: each keeps its own Creative Commons license, listed with its author in `CREDITS.md`, `app/src/data/photos.json` and `app/src/data/lookalike-photos.json`. The recordings are CC BY-SA, so the trimmed alarm and playback clips made from them are shared under CC BY-SA too.
