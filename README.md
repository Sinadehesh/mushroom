# ShroomLock

An app blocker that teaches you mushrooms instead of just saying "no". It's the sister app of
[FloraLock](https://github.com/sinadehesh/flora) and is built from the same code.

You choose the apps that eat your time and how many mushrooms you want to learn a day. Each day's lesson shows each
new mushroom once (photos, field clues, edibility and the look-alikes it's mistaken for), then a short
multiple-choice exam. When you open a locked app, ShroomLock shows a photo of one of your mushrooms with four names,
and the wrong names are its real look-alikes first.

- **Correct:** the app unlocks for your chosen window (default 10 minutes).
- **Wrong (the Genius Penalty):** the screen freezes for 10 seconds and shows the right name, its edibility and a
  fact. If you picked a real look-alike, it says so (in red if it's deadly) and shows how to tell them apart.
- **Escape hatches, so people don't uninstall:** "I don't need Instagram right now" (the best outcome), plus a few
  emergency unlocks per day (configurable, default 2).

Everything runs offline; nothing leaves the phone ([privacy policy](PRIVACY.md)).

> **Safety:** ShroomLock teaches recognition, not foraging. Never eat a wild mushroom because an app or a photo told
> you it's edible. Have every find checked in person by an expert. The app says this in setup, on every lesson card
> and on every mushroom page.

## What ShroomLock adds over FloraLock

| Feature       | FloraLock          | ShroomLock                                                                                                |
| ------------- | ------------------ | --------------------------------------------------------------------------------------------------------- |
| Wrong answers | Same group         | The mushroom's real look-alikes first, even from other groups, with a how-to-tell note after a wrong pick |
| Danger        | —                  | Edibility on every card (choice edible → deadly); deadly species marked ☠️ everywhere                     |
| Lesson cards  | Name and a fact    | Field clues: cap, underneath, stem, spore print, where, when, and the one feature that tells it apart     |
| Repeats       | Once, the next day | Spaced reviews after 1, 3, 7, 14 and 30 days; a miss starts over from tomorrow; then it's mastered        |
| Progress      | Botany IQ          | Mycology IQ, a daily streak, a collection (collected and mastered), and milestones                        |

## Status

| Piece                                                         | State                                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| First-launch setup: safety, mushrooms per day, apps, the lock | ✅ Built                                                                                                                 |
| Daily lesson + exam, spaced reviews, lock-screen quiz         | ✅ Built and unit-tested                                                                                                 |
| Look-alike distractors, field clues, streaks and milestones   | ✅ Built and unit-tested                                                                                                 |
| Mushroom database                                             | ✅ 71 species (35 gilled, 16 pores & brackets, 20 ridges, spines and more)                                               |
| Photos                                                        | ✅ 3 real iNaturalist photos per species, CC0 / CC BY / CC BY-SA, bundled                                                |
| Android app lock (UsageStats + foreground service)            | ✅ Same module as FloraLock; emulator test on Android 8, 10, 13 and 15                                                   |
| ShroomLock Plus (one-time purchase, Google Play Billing)      | ✅ Built; product `shroomlock_plus` must be created in Play Console                                                      |
| Play Store signing and privacy policy                         | ⏳ Needs the signing secrets in this repo and hosting for the privacy page; see [docs/PLAY_STORE.md](docs/PLAY_STORE.md) |
| iOS shield (Screen Time API)                                  | ⏳ Not started. See [docs/PLATFORM_INTEGRATION.md](docs/PLATFORM_INTEGRATION.md)                                         |

## Learning model

Pure rules in `src/core/`, covered by `npm test`:

- **Lesson** (`daily.ts`): each day brings the next _n_ mushrooms you haven't met (1–10, set in setup or Settings).
  Each is shown once on a study card, then the exam asks one question per mushroom.
- **Spaced reviews** (`daily.ts`): a mushroom comes back 1 day after its lesson, then 3, 7, 14 and 30 days after
  each right answer. A miss, in an exam or on the lock screen, starts it over from tomorrow. After the fifth
  review it's mastered. A day's exam asks at most 15 reviews, the most overdue first.
- **Lock screen:** asks about today's exam mushrooms first (those not yet answered right today), then anything
  you've learned.
- **Look-alikes** (`quiz.ts`): wrong choices are the mushroom's real look-alikes first, then the same group in
  your deck. Pairs only need listing on one side in `src/data/mushrooms.ts`.
- **Progress** (`progress.ts`, `stats.ts`): a streak of days with the exam done; collected and mastered counts;
  milestones; and Mycology IQ from 60 to 160 (a fifth for meeting a mushroom, the rest grows with each review).

## Run it

```bash
npm install
npx expo start         # press a / i / w for Android, iOS or web
npm test               # core logic tests (vitest)
npm run typecheck
```

The lock is native code (`modules/app-blocker`), so it doesn't run in Expo Go. On iOS and the web the lock
isn't available; **Preview the lock screen** on the Today tab shows the challenge instead.

## Android builds

Every push to `main` or a `claude/**` branch runs [.github/workflows/main.yml](.github/workflows/main.yml) on
GitHub Actions:

1. **build:** typecheck and tests, then a signed, R8-optimized AAB for the Play Store (`shroomlock-aab`) and an
   APK for the emulator tests.
2. **lock-test:** installs the APK on Android 8, 10, 13 and 15 emulators and runs [e2e/lock.yaml](e2e/lock.yaml):
   setup, locking the Settings app, the challenge appearing over it, an emergency unlock, the daily lesson and
   the Plus screen. Then it reinstalls the app over itself, as an update does, and checks that the lock
   restarts on its own and the user's progress is kept ([e2e/update.yaml](e2e/update.yaml)). When all pass,
   the APK is deleted, so the run's only download is the AAB.

[.github/workflows/fgs-video.yml](.github/workflows/fgs-video.yml) records the foreground service demo video
Play Console asks for.

## Layout

```
src/
  app/                  Expo Router screens
    onboarding.tsx        First launch: safety, mushrooms per day, apps to lock, the lock
    (tabs)/index.tsx      Today: lesson card, streak, next goal, Mycology IQ, trouble mushrooms
    (tabs)/browse.tsx     Collection: collected and mastered, milestones, searchable guide
    (tabs)/settings.tsx   Lock, Plus, mushrooms per day, unlock window, penalty, emergency unlocks, deck
    upgrade.tsx           ShroomLock Plus: what it adds, purchase and restore
    lesson.tsx            Study cards (clues, edibility, look-alikes), then the exam
    challenge.tsx         The lock-screen intercept (shroomlock://challenge?source=Instagram)
    mushroom/[id].tsx     Mushroom page: clues, look-alikes, your reviews
    privacy.tsx, credits.tsx
  core/                 Pure TypeScript, no React, unit-tested
    daily.ts              Daily lessons, spaced reviews, lock-screen picker
    progress.ts           Streaks, collection, milestones
    quiz.ts               Look-alike distractors
    challenge.ts          Lock-screen state machine (question → penalty → unlocked)
    stats.ts              Mycology IQ, accuracy, trouble mushrooms
    plus.ts               What's free and what Plus unlocks
    saved.ts              Saved progress: reading older saves after an app update
  data/                 Mushrooms, field clues, photos (generated), privacy policy
  blocker/              Bridge to the native Android lock
  state/store.tsx       App state, persisted to AsyncStorage
modules/app-blocker/    Native Android lock: foreground service, overlay fallback, boot receiver
modules/play-billing/   Google Play Billing for the one-time Plus purchase
```

## Photos

Photos come from [iNaturalist](https://www.inaturalist.org) observers, identified to species and checked by the
community. ShroomLock uses only **CC0, CC BY and CC BY-SA** photos (no NC licences) and credits each photographer
on the Photo credits screen. The lock screen picks one of each mushroom's photos at random, so you learn the
mushroom, not one picture.

```bash
npm run photos:find -- chanterelle   # candidates from the iNaturalist API, with preview links
# paste the ones you like into scripts/mushroom-photos.json
npm run photos:download              # downloads from iNaturalist's open-data bucket, resizes to 1000px
```

## Next steps

1. Add the signing secrets to this repo and host the privacy page (see [docs/PLAY_STORE.md](docs/PLAY_STORE.md)).
2. Grow the deck to 300–500 species, with regional decks (Europe, North America) so the look-alikes match what
   grows near the user.
3. Build the iOS blocker with Apple's Screen Time API; request the Family Controls entitlement early.
