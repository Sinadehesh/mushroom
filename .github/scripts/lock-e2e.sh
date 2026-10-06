#!/usr/bin/env bash
# Runs inside reactivecircus/android-emulator-runner: installs the APK, grants the lock's
# permissions the way a user would in system settings, then drives the app with Maestro, then
# checks that an update (a reinstall over the top) keeps the lock running and the user's progress.
# On failure it prints what's needed to diagnose it straight into the job log.
set -uxo pipefail

PKG=com.shroomlock.app
APK=$(ls apk/*.apk | head -n 1)
OUT=e2e-output
mkdir -p "$OUT"

# A just-booted emulator can report boot complete before its package manager answers
# ("Broken pipe" on install). Wait for it, and retry the install a couple of times.
for _ in $(seq 1 30); do adb shell pm path android >/dev/null 2>&1 && break; sleep 2; done
installed=0
for attempt in 1 2 3; do
  if adb install -r "$APK"; then installed=1; break; fi
  echo "Install attempt $attempt failed; retrying in 10 s"
  sleep 10
done
[ "$installed" = 1 ] || exit 1

# Usage access and "Display over other apps" are app-ops the user toggles in Settings.
adb shell appops set "$PKG" GET_USAGE_STATS allow
adb shell appops set "$PKG" SYSTEM_ALERT_WINDOW allow
# Android 13+ notification permission (the lock works without it; avoids a dialog in the flow).
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb logcat -c 2>/dev/null || true
# CI emulators sometimes flag their own System UI as "not responding" just after a cold boot,
# and that system dialog covers whatever app is in front. Hide system error dialogs and close
# any that is already showing (this changes the emulator only, not ShroomLock).
adb shell settings put global hide_error_dialogs 1 || true
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true

# Runs a Maestro flow and copies Maestro's own logs (it keeps them in ~/.maestro/tests) into $OUT.
# On the Android 15 emulator, adb sometimes drops the device ("device offline") just as Maestro
# restarts the app. Only when Maestro's log shows it lost the device: reconnect, wait for the
# emulator and run the flow once more, with a warning on the run. A failed step is never retried.
run_flow() {
  local flow=$1 name=$2 rc logs
  for attempt in 1 2; do
    rc=0
    touch "$OUT/.started"
    maestro test "$flow" --format junit --output "$OUT/$name-report.xml" || rc=$?
    logs=$(find "$HOME/.maestro/tests" -mindepth 1 -maxdepth 1 -type d -newer "$OUT/.started" 2>/dev/null | head -n 1)
    [ -n "$logs" ] && cp -r "$logs" "$OUT/maestro-$name-$attempt"
    [ "$rc" -eq 0 ] && return 0
    if [ "$attempt" = 2 ] \
      || ! grep -rqsE 'device offline|DeviceServerDiedException|device .* not found' "$OUT/maestro-$name-$attempt"; then
      return "$rc"
    fi
    echo "::warning::The emulator went offline during $flow; reconnecting and running it once more."
    adb reconnect offline || true
    adb wait-for-device
    for _ in $(seq 1 60); do [ "$(adb shell getprop sys.boot_completed 2>/dev/null | tr -d '\r')" = 1 ] && break; sleep 2; done
    sleep 5
  done
}

status=0
run_flow e2e/lock.yaml lock || status=$?

# Updating must keep everything. Reinstall over the top (as a Play Store update does) and, without
# opening ShroomLock, check the lock restarts on its own; then that setup and progress survived.
if [ "$status" -eq 0 ]; then
  adb install -r "$APK" || status=1
  restarted=0
  for _ in $(seq 1 30); do
    adb shell dumpsys activity services "$PKG" | grep -q BlockerService && { restarted=1; break; }
    sleep 1
  done
  if [ "$restarted" = 0 ]; then
    echo "::error::The lock did not restart by itself after the update"
    status=1
  fi
fi
if [ "$status" -eq 0 ]; then
  run_flow e2e/update.yaml update || status=$?
fi

adb logcat -d -v time > "$OUT/logcat.txt" 2>/dev/null || true

if [ "$status" -ne 0 ]; then
  set +x
  echo "::group::Maestro steps"
  python3 - "$OUT" <<'PY' || true
import json, pathlib, sys
for f in sorted(pathlib.Path(sys.argv[1]).rglob('commands-*.json')):
    for c in json.load(open(f)):
        cmd = {k: v for k, v in c.get('command', {}).items() if v}
        meta = c.get('metadata', {})
        err = (meta.get('error') or {}).get('message', '')
        print(f"{meta.get('status', '?'):10} {json.dumps(cmd)[:160]} {err[:200]}")
PY
  echo "::endgroup::"
  echo "::group::Maestro errors and log"
  grep -h -A3 '<failure' "$OUT"/*-report.xml 2>/dev/null | head -n 20 || true
  find "$OUT" -path "$OUT/maestro-*" -name 'maestro.log' -exec tail -n 60 {} \; 2>/dev/null || true
  echo "::endgroup::"
  echo "::group::Text on screen at failure"
  adb shell uiautomator dump /sdcard/ui.xml >/dev/null 2>&1 && adb shell cat /sdcard/ui.xml \
    | grep -oE '(text|content-desc|resource-id)="[^"]+"' | head -80 || true
  echo "::endgroup::"
  echo "::group::Crashes and app errors (logcat)"
  grep -E "FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|ShroomLockBlocker|$PKG" "$OUT/logcat.txt" | tail -80 || true
  echo "::endgroup::"
  echo "::group::Lock service"
  adb shell dumpsys activity services "$PKG" | head -30 || true
  echo "::endgroup::"
fi
exit "$status"
