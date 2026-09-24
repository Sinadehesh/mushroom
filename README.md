# MycoLock

An app blocker that teaches you mushrooms instead of just saying "no". It's the sister app of
[FloraLock](https://github.com/sinadehesh/flora), built on the same architecture.

When you open Instagram or TikTok, MycoLock shows you a photo of a mushroom instead. To get in, you have to name it.
Easy Mode gives you four choices, and the wrong ones are the mushroom's real look-alikes first (chanterelle vs.
jack-o'-lantern, morel vs. false morel). Hard Mode makes you type the name, and small typos are OK.

- **Correct:** the app unlocks for your chosen window (default 10 minutes).
- **Wrong (the Genius Penalty):** the screen freezes for 10 seconds and shows the right name, its edibility and a
  one-sentence fact. If you picked a known look-alike, it says so. Taps during the freeze are ignored. In Hard
  Mode you then have to recall the mushroom you just saw. In Easy Mode you get a new mushroom, so tapping at random
  doesn't pay off.
- **Escape hatches, so people don't uninstall:** "I don't need Instagram right now" (the best outcome), plus a few
  emergency unlocks per day (configurable, default 2).

Opening MycoLock itself takes you to the **Fungarium**. It shows your Mycology IQ, the mushrooms you keep missing,
flashcard practice and a browsable mushroom guide. Everything runs offline.

> **Safety:** MycoLock teaches recognition, not foraging. Never eat a wild mushroom because an app or a photo told
> you it's edible. Have every find checked in person by a local expert. The app repeats this on every mushroom
> page.

## Status

| Piece                                               | State                                                                                    |
| --------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| Challenge flow (easy/hard, penalty, retry, unlock)  | ✅ Built and unit-tested                                                                 |
| Look-alike distractors                              | ✅ Built and unit-tested                                                                 |
| Spaced repetition (Leitner boxes) + Mycology IQ     | ✅ Built and unit-tested                                                                 |
| Fungarium, mushroom guide, mushroom pages, settings | ✅ Built                                                                                 |
| Mushroom database                                   | ✅ 71 species (35 gilled, 16 pores & brackets, 20 ridges/spines/other), each with a fact |
| Photos                                              | ✅ 213 real iNaturalist photos, 3 per species, CC0 / CC BY / CC BY-SA with credits       |
| iOS shield (Screen Time API)                        | ⏳ Not started. See [docs/PLATFORM_INTEGRATION.md](docs/PLATFORM_INTEGRATION.md)         |
| Android blocker (UsageStats + foreground service)   | ⏳ Not started. See [docs/PLATFORM_INTEGRATION.md](docs/PLATFORM_INTEGRATION.md)         |

Until the native blockers exist, `src/blocker/index.ts` is a simulated blocker. Use **Preview the lock screen** on the
Fungarium tab to try the full intercept flow.

## Run it

```bash
npm install
npx expo start         # press i / a / w for iOS, Android or web
```

```bash
npm test               # core logic tests (vitest)
npm run typecheck
```

## Build for Android

Builds run in the cloud on [EAS Build](https://docs.expo.dev/build/introduction/). You need a free Expo
account, but not Android Studio. Log in once with `npx eas-cli@latest login`. The first build asks to create
the project and an Android signing key. Let EAS generate and store the key; you need that same key for
every future Play Store update.

| Command                    | Output | Use it for                                                                     |
| -------------------------- | ------ | ------------------------------------------------------------------------------ |
| `npm run build:apk`        | `.apk` | Installing directly on phones: you, friends, testers. The link opens a QR.     |
| `npm run build:playstore`  | `.aab` | The Play Store. The version code increases automatically on each build.        |
| `npm run submit:playstore` | —      | Uploads the latest `.aab` to Play Console's internal testing track as a draft. |

Before the first Play Store upload:

- Create the app in [Play Console](https://play.google.com/console) with the package name `com.mycolock.app`.
  Upload the first `.aab` by hand; after that, `submit:playstore` works.
- For `submit:playstore`, create a Google Cloud service account with Play Console access and give its JSON key
  to EAS ([guide](https://docs.expo.dev/submit/android/)).
- New personal developer accounts must run a closed test with at least 12 testers for 14 days before
  publishing to production.
- Both builds currently have the simulated blocker. Blocking other apps needs the native Android module
  (see [docs/PLATFORM_INTEGRATION.md](docs/PLATFORM_INTEGRATION.md)). That module's permissions, Usage Access
  and a special-use foreground service, need Play Console declarations.

## Layout

```
src/
  app/                  Expo Router screens
    (tabs)/index.tsx      Fungarium: Mycology IQ, trouble mushrooms, practice
    (tabs)/browse.tsx     Searchable mushroom guide with mastery dots
    (tabs)/settings.tsx   Mode, unlock window, penalty, emergency unlocks, deck
    challenge.tsx         The lock-screen intercept (mycolock://challenge?source=Instagram)
    mushroom/[id].tsx     Mushroom page: edibility, look-alikes, your record
    credits.tsx           Photo attributions
  core/                 Pure TypeScript, no React, fully unit-tested
    challenge.ts          Lock-screen state machine (question → penalty → unlocked)
    matching.ts           Hard Mode answer checking (aliases, plurals, typo tolerance)
    srs.ts                Leitner spaced repetition + next-mushroom picker
    quiz.ts               Easy Mode distractors (look-alikes first, then same group)
    stats.ts              Mycology IQ, accuracy, trouble mushrooms
  data/mushrooms.ts     The mushroom database
  blocker/              OS app-blocker bridge (simulated for now)
  state/store.tsx       App state, persisted to AsyncStorage
scripts/mushroom-photos.json            Curated photo list (iNaturalist photo id, license, author)
scripts/download-mushroom-photos.mjs    Downloads + resizes those photos, regenerates credits
scripts/find-mushroom-photos.mjs        Finds candidate photos for a mushroom via the iNaturalist API
```

### The deck

Mushrooms fall into three groups, by the first thing you check when you pick one up. You can switch each group on
or off in Settings.

- **Gilled:** amanitas, field mushrooms, ink caps, parasols, russulas and the other agarics.
- **Pores & brackets:** boletes and polypores.
- **Ridges, spines & more:** chanterelles, hedgehogs, morels, puffballs, jelly fungi, cups and stinkhorns.

Each mushroom has an edibility rating (choice edible, edible, inedible, poisonous or deadly) and a list of
look-alikes. You only have to list a look-alike on one side of the pair; the app matches pairs in both directions.
Look-alikes come first as Easy Mode distractors, even when they're in a different group, because telling them
apart is the skill that matters.

### Learning model

Each mushroom sits in a Leitner box from 0 to 6. The review intervals are 2 min, 20 min, 4 h, 1 d, 3 d, 8 d and
21 d. A correct answer moves the mushroom up one box. A miss sends it back to box 0, so it returns within minutes.
People hit the lock screen many times a day, which makes those short early intervals work well. The next mushroom
shown is the weakest overdue one, then an unseen one, then whichever is due soonest.

**Mycology IQ** goes from 60 to 160. It is 60 + 100 × (average box ÷ 6) across the enabled deck, so it only rises
with spaced, repeated correct answers.

## Photos

Photos come from [iNaturalist](https://www.inaturalist.org). Its observers have uploaded millions of fungus photos,
each identified to species and checked by the community. Many are released under open licences. MycoLock uses only
**CC0, CC BY and CC BY-SA** photos. It skips the common CC BY-NC licence, which forbids commercial use. Each
photo's author is shown under the photo and on the Credits screen.

Each mushroom can have several photos, and the lock screen picks one at random. That way you learn the mushroom,
not one particular picture. Aim for at least one photo that shows the cap and one that shows the underside
(gills, pores or spines).

To add or swap photos:

```bash
npm run photos:find -- chanterelle   # candidates from the iNaturalist API, with preview links
# paste the ones you like into scripts/mushroom-photos.json
npm run photos:download              # downloads from iNaturalist's open-data bucket, resizes to 1000px
```

`photos:find` needs the iNaturalist API. If a network policy blocks it (it answers 403 in some sandboxes), you can
pick photos from iNaturalist's [open-data bucket](https://github.com/inaturalist/inaturalist-open-data) instead,
which `photos:download` already uses. Its `taxa`, `observations` and `photos` tables list every observation with its
licence. That's how the bundled set was chosen: research-grade observations only, photos at least 700 px, and 12
candidates per species reviewed on contact sheets.

## Next steps

1. Build the iOS blocker with `react-native-device-activity`, and request the Family Controls distribution
   entitlement from Apple now, since approval takes time.
2. Build the Android blocker as a local Expo module (Kotlin foreground service + UsageStats).
3. Grow the deck to 300–500 species, with regional decks (Europe, North America) so the look-alikes match what
   grows near the user.
