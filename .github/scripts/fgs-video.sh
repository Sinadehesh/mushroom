#!/usr/bin/env bash
# Records the screen video Play Console asks for in the foreground service declaration. Runs inside
# reactivecircus/android-emulator-runner: installs the APK, grants the lock's permissions, then
# records while the e2e/fgs-video flows go through: lock an app and turn the lock on, the service's
# notification, opening the locked app, the right answer, turning the lock off. It writes the raw
# recording and caption timings to video-output/; fgs-video-captions.py adds the captions.
set -uxo pipefail

PKG=com.shroomlock.app
APK=$(ls apk/*.apk | head -n 1)
OUT=video-output
FLOWS=e2e/fgs-video
mkdir -p "$OUT/segments"
: > "$OUT/captions.tsv"

for _ in $(seq 1 30); do adb shell pm path android >/dev/null 2>&1 && break; sleep 2; done
installed=0
for attempt in 1 2 3; do
  if adb install -r "$APK"; then installed=1; break; fi
  echo "Install attempt $attempt failed; retrying in 10 s"
  sleep 10
done
[ "$installed" = 1 ] || exit 1

adb shell appops set "$PKG" GET_USAGE_STATS allow
adb shell appops set "$PKG" SYSTEM_ALERT_WINDOW allow
adb shell pm grant "$PKG" android.permission.POST_NOTIFICATIONS 2>/dev/null || true
adb shell settings put global hide_error_dialogs 1 || true
adb shell am broadcast -a android.intent.action.CLOSE_SYSTEM_DIALOGS >/dev/null 2>&1 || true
adb shell svc power stayon true || true
# A tidy status bar: fixed clock, full battery.
adb shell settings put global sysui_demo_allowed 1 || true
adb shell am broadcast -a com.android.systemui.demo -e command enter >/dev/null 2>&1 || true
adb shell am broadcast -a com.android.systemui.demo -e command clock -e hhmm 1000 >/dev/null 2>&1 || true
adb shell am broadcast -a com.android.systemui.demo -e command battery -e level 100 -e plugged false >/dev/null 2>&1 || true

# Lock a real app when the image has one; otherwise the system Settings app.
if adb shell pm path com.android.chrome >/dev/null 2>&1; then
  LOCK_PKG=com.android.chrome LOCK_SEARCH=chrome LOCK_NAME=Chrome
else
  LOCK_PKG=com.android.settings LOCK_SEARCH=settings LOCK_NAME=Settings
fi
flow() {
  maestro test -e LOCK_PKG="$LOCK_PKG" -e LOCK_SEARCH="$LOCK_SEARCH" "$FLOWS/$1" --debug-output "$OUT/debug/$1"
}

# Before recording: fresh app on the welcome screen (this also warms up Maestro).
flow 0-start.yaml || exit 1

# screenrecord stops after 3 minutes, so record in back-to-back segments until told to stop.
adb shell 'rm -f /sdcard/fgs_*.mp4; touch /data/local/tmp/fgs-recording'
adb shell 'i=0; while [ -f /data/local/tmp/fgs-recording ]; do screenrecord --size 720x1600 --bit-rate 8000000 --time-limit 170 /sdcard/fgs_$i.mp4; i=$((i+1)); done' &
REC=$!
T0=$(date +%s.%N)
sleep 1

# caption "<line 1>" "<line 2>": shown from now until the next caption.
caption() { printf '%s\t%s\t%s\n' "$(awk "BEGIN { print $(date +%s.%N) - $T0 }")" "$1" "$2" >> "$OUT/captions.tsv"; }
shade() {
  adb shell cmd statusbar expand-notifications
  sleep "$1"
  adb shell cmd statusbar collapse
  sleep 1
}
stop_recording() {
  adb shell rm -f /data/local/tmp/fgs-recording
  adb shell pkill -INT screenrecord || true
  wait "$REC"
  sleep 2
  for f in $(adb shell 'ls /sdcard/fgs_*.mp4' | tr -d '\r'); do adb pull "$f" "$OUT/segments/"; done
}

status=0
run() {
  [ "$status" = 0 ] || return
  flow "$1" || status=1
}

caption "ShroomLock: name the mushroom to unlock" "An app lock for Android (com.shroomlock.app)"
sleep 3
caption "1. Pick an app, turn the lock on" "Turning it on starts the foreground service"
run 1-setup.yaml
if [ "$status" = 0 ]; then
  caption "2. The lock runs in the background" "Notification while it runs: “ShroomLock is on”"
  sleep 2
  shade 6
  adb shell dumpsys activity services "$PKG" | grep -E "ServiceRecord|isForeground" || true
fi
caption "3. Open the locked app ($LOCK_NAME)" "The service detects it and asks about a mushroom"
run 3-open-locked-app.yaml
caption "4. Correct answer" "$LOCK_NAME opens for 10 minutes"
run 4-answer.yaml
[ "$status" = 0 ] && sleep 5
caption "5. Turn the lock off" "The service stops and its notification is gone"
run 5-lock-off.yaml
if [ "$status" = 0 ]; then
  sleep 1
  shade 5
  adb shell dumpsys activity services "$PKG" | grep -E "ServiceRecord|isForeground" || echo "No ShroomLock service running"
fi
sleep 1
stop_recording
ls -la "$OUT/segments"
exit "$status"
