# Releasing ShroomLock on Google Play

## 1. Signing (once)

Google Play only accepts an AAB signed with your **upload key**. The build workflow signs with it when these
two repository secrets exist (GitHub → Settings → Secrets and variables → Actions → New repository secret):

| Secret                      | Value                                   |
| --------------------------- | --------------------------------------- |
| `ANDROID_KEYSTORE_BASE64`   | The keystore file as one line of base64 |
| `ANDROID_KEYSTORE_PASSWORD` | Its password                            |

The key alias defaults to `upload` and the key password to the keystore password. Set `ANDROID_KEY_ALIAS` and
`ANDROID_KEY_PASSWORD` only if your keystore differs.

To make a new upload key yourself:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore shroomlock-upload-key.jks -alias upload \
  -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=ShroomLock, O=ShroomLock"
base64 -w0 shroomlock-upload-key.jks   # paste the output into ANDROID_KEYSTORE_BASE64
```

Never commit the `.jks` file (`.gitignore` excludes it). Keep it and the password in a password manager. With
Play App Signing (the default), Google holds the key users' phones see; if the upload key is lost or leaked,
Play support can reset it.

After the next push, the build job's **Show signing certificate** step prints the SHA-256 of the key that signed
the build. It should match the upload key, and Play Console → Setup → App signing after the first upload.

## 2. Play Console (once)

1. Create the app with package name `com.shroomlock.app`, then upload `shroomlock-aab` from a workflow run to
   **Testing → Internal testing**.
2. **App content:**
   - **Privacy policy:** `https://www.sinadehesh.com/shroomlock/privacy/`. The page is generated into `site/`
     (at `privacy/` and `shroomlock/privacy/`) from `src/data/privacyPolicy.ts` by `npm run privacy`, together
     with PRIVACY.md and the in-app screen. It's served from FloraLock's website (the Flora repo's
     `site/shroomlock/privacy/`), so after changing the policy, copy `site/shroomlock/privacy/index.html`
     there. ShroomLock's landing page is `https://www.sinadehesh.com/shroomlock/`.
   - **Data safety:** the app collects and shares no user data (everything stays on the device), so answer "No"
     to collecting or sharing data.
   - **Ads:** no ads. **Target audience:** 13+ is simplest. **Content rating:** fill in the questionnaire.
   - **Foreground service permissions:** declare `FOREGROUND_SERVICE_SPECIAL_USE`. Describe it as: "Keeps the
     app lock running: watches which app is in front so ShroomLock can show a learning question before an app the
     user chose to lock." For the screen recording Google asks for, run the **Foreground service demo video**
     workflow (Actions tab): it records the lock on an Android 14 emulator with captions (download
     `fgs-demo-video`), and `timestamps.txt` lists the chapters for the YouTube description. Upload it to
     YouTube as **Unlisted**.
3. **Policy risks to know about:**
   - Usage access and "Display over other apps" are allowed for app blockers, but the listing should say
     clearly that locking apps is the core feature.
   - Battery-optimisation exemption (`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`) is only allowed when the core
     feature breaks without it. If Google objects, remove that permission and keep the "open battery settings"
     fallback.
4. New personal developer accounts must run a closed test with at least 12 testers for 14 days before
   publishing to production.

## 3. ShroomLock Plus (the in-app purchase)

The free version locks up to 2 apps and teaches the 35 gilled mushrooms. **ShroomLock Plus** is a one-time purchase
that unlocks unlimited apps and the 36 boletes, brackets, chanterelles, morels, puffballs and other fungi. The rules live in `src/core/plus.ts`; the purchase goes
through Google Play Billing in `modules/play-billing`.

1. **Payments profile:** Play Console → Setup → Payments profile. Add your bank and tax details; Google won't
   let you sell anything without it.
2. **Upload a build first.** Play Console only allows in-app products once a build that includes Google Play
   Billing has been uploaded (any testing track is fine).
3. **Create the product:** Monetize with Play → Products → One-time products → Create:
   - Product ID: `shroomlock_plus` (must match exactly; it can never be changed or reused)
   - Name: ShroomLock Plus · Description: Unlimited locked apps and all 71 mushrooms.
   - Price: for example $5.99 (Play converts it for other countries), then **Activate** it.
4. **Test without paying:** Setup → License testing → add your Google account. On a phone signed in with that
   account, install ShroomLock from the internal testing link (not the APK from GitHub: purchases only work
   for installs from Google Play). The purchase sheet then offers test cards that are never charged.

Until the product exists and is active, the Plus screen says "ShroomLock Plus isn't on sale yet". On phones
without the Play Store it explains that purchases need Google Play. Refunds are handled automatically: the next
time ShroomLock opens, Google Play reports Plus as not owned and the extra locked apps are released.

**App access (for Google's reviewers):** answer **Yes, part of the app is restricted** (Plus is paid) and
give the review code with these steps: open ShroomLock → Settings → "See what Plus adds" → "Have a review code?"
→ enter the code → "Apply code". The code is kept out of this repository: `src/core/plus.ts` holds only its
SHA-256 hash in `REVIEW_CODE_HASHES`. To replace a code, generate a new random one, add the hash of its
normalized form (uppercase, letters and digits only), and update the answer in Play Console.

**Data safety:** purchases are processed by Google Play; ShroomLock itself doesn't collect or send purchase data.
If Play Console asks about purchase history, answer according to Google's current guidance for apps that use
Google Play Billing only.

## 4. Each release

Push to `main` or a `claude/**` branch. The workflow sets `versionCode` from the run number, so every build can
be uploaded. Release builds are optimized with R8 (code shrinking and optimization, "DEX code optimization" in
Play Console) and resource shrinking, set in `app.json` through `expo-build-properties`; R8's mapping file is
embedded in the AAB, so Play Console gets deobfuscated crash reports without a separate upload. When the
emulator tests pass, the run's only download is **shroomlock-aab**: upload it in Play Console. (The APK and
test reports are kept only when a test fails, for debugging.)

**Updates keep users' data.** Android keeps an app's storage when Google Play updates it, provided the
package name stays `com.shroomlock.app`, every release is signed with the same upload key and the
`versionCode` goes up (the workflow handles the last two). In the code:

- Progress and settings are saved under the key `shroomlock/v2` (`src/core/saved.ts`); the locked apps and
  the lock's on/off state live in the native `shroomlock_blocker` preferences (`BlockerStore.kt`). Never
  rename either: a new name reads as empty, so every user would start over.
- When the saved shape changes, bump `SAVE_VERSION` and convert older saves in `migrate()`, with a test.
  Values that fail validation fall back to defaults one by one, and the app never saves over a save it
  couldn't read (an unreadable one is copied to `shroomlock/v2-unreadable` first).
- Every build's emulator test reinstalls the app over itself, as an update does, and checks that the lock
  restarts on its own and that setup and progress are still there (`e2e/update.yaml`).
- Never tell users to reinstall or clear storage to fix a problem: that is the one thing that does erase
  their progress.
