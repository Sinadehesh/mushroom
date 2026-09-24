# Platform integration: how the lock actually reaches the user

The JS app (quiz, spaced repetition, Fungarium) is platform-neutral. The part that
intercepts Instagram/TikTok is native and differs a lot between iOS and Android.
All of it plugs into the `AppBlocker` interface in `src/blocker/index.ts`. The
challenge screen already calls `blocker.grantTemporaryAccess(source, minutes)`
on a correct answer.

Both platforms open the same route: `mycolock://challenge?source=<app name>`.

---

## iOS: Screen Time API (FamilyControls, ManagedSettings, DeviceActivity)

### Correction to the original pitch

Apple lets you customise the shield, but **the shield itself cannot host the
quiz.** A `ShieldConfigurationDataSource` can only set a background colour/blur,
an icon, a title, a subtitle and up to two buttons. There are no custom views,
text fields or image galleries in it. A `ShieldActionDelegate` can react to those
button taps, but it **cannot open your app directly**.

The flow used by shipping apps (Opal, one sec, etc.) works around this:

1. The shield shows a 🍄 icon, "Instagram is resting", "Name a mushroom to unlock",
   and the primary button **"Identify a mushroom"**.
2. The `ShieldAction` extension handles the tap by posting a **local notification**
   ("Tap to identify your mushroom") whose payload deep-links to
   `mycolock://challenge?source=Instagram`, and responds `.close`/`.defer`.
3. The user taps the notification. MycoLock opens on the challenge screen.
4. On a correct answer, the app removes that app's token from the
   `ManagedSettingsStore` shield set and starts a `DeviceActivity` schedule of
   `unlockMinutes`. The `DeviceActivityMonitor` extension re-applies the
   shield when the interval ends, even if MycoLock is killed.

That's one extra tap. It feels fine, and the notification step adds a little
friction of its own.

### Other iOS constraints

- **Entitlement:** `com.apple.developer.family-controls` works in development
  right away. **Distribution (TestFlight/App Store) needs Apple's approval**, which
  you request via the Family Controls entitlement request form. Request it early:
  it can take weeks.
- **Opaque tokens:** `FamilyActivityPicker` returns `ApplicationToken`s, not bundle
  IDs or names. You can't show "Instagram" in your own UI from a token, but
  `Label(token)` in SwiftUI renders the name and icon. For the `source` query
  param, pass the app's display name from the shield extension, which receives the
  `Application` and its `localizedDisplayName`.
- **Extensions share state via an App Group** (`group.com.mycolock.app`):
  selected tokens, unlock expiry, difficulty.
- **Implementation path in Expo:** the
  [`react-native-device-activity`](https://github.com/kingstinct/react-native-device-activity)
  package ships an Expo config plugin that generates the ShieldConfiguration,
  ShieldAction and DeviceActivityMonitor extension targets. It exposes the picker
  and shield APIs to JS. Start there before writing your own targets.

## Android: UsageStats + overlay permission

### What the pitch gets right, and what needs adjusting

- **Detection:** `UsageStatsManager.queryEvents()` polled from a **foreground
  service** (every ~500 ms while the screen is on) catches `ACTIVITY_RESUMED`
  for blocked packages. It needs the special **Usage Access** permission
  (`PACKAGE_USAGE_STATS`), which the user grants in system settings.
- **Showing the quiz:** rather than drawing a `SYSTEM_ALERT_WINDOW` overlay with
  custom views, launch MycoLock's own activity with the deep link
  (`FLAG_ACTIVITY_NEW_TASK`). That reuses the React Native challenge screen.
  Android 10+ blocks background activity starts, **but apps holding
  `SYSTEM_ALERT_WINDOW` ("Display over other apps") are exempt**, so you still
  request that permission, just for a different reason.
- **Foreground service type:** Android 14+ requires a declared type. Use
  `specialUse` with a
  `PROPERTY_SPECIAL_USE_FGS_SUBTYPE` explanation, and expect Play to ask about it.
- **Do not use AccessibilityService** for this. Google Play restricts it to
  accessibility tools, and it's the "hacky" route the pitch rightly avoids.
- **Play Console declarations:** Usage Access and the special-use foreground
  service both require a declaration and a short video of the feature. The
  Fungarium's standalone study value helps the "core functionality" argument.
- **Battery optimisation:** some OEMs (Xiaomi, Huawei, Samsung) kill foreground
  services aggressively. Add a "keep MycoLock running" help screen that links
  to the battery optimisation exemption.
- **Unlock window:** the service keeps `unlockedUntil[package]` and ignores that
  package until the window expires.

**Implementation path in Expo:** a local Expo module (`modules/app-blocker`)
written in Kotlin, with a config plugin that adds the permissions and the
service to the manifest. `npx create-expo-module@latest --local` scaffolds it.

## Shared: offline content

- Everything works offline. Photos are bundled under `assets/mushrooms/`, and
  progress lives in AsyncStorage.
- Budget: 3 photos per mushroom at 1000 px (mozjpeg, quality 74) averages about
  110 KB per photo, so today's 71 mushrooms take 23 MB. At 400 mushrooms that
  would be about 130 MB. At that size, bundle 1–2 photos per mushroom and
  download the rest on demand, or switch to WebP.
- **Licensing:** photos come from iNaturalist. Only CC0, CC BY and CC BY-SA
  are allowed; CC BY-NC is excluded because the app may be sold. CC BY and
  CC BY-SA require visible attribution. The credit line under each photo and
  the Credits screen cover that. `scripts/download-mushroom-photos.mjs` enforces the
  licence allow-list, and `scripts/mushroom-photos.json` records each photo's author and source.
