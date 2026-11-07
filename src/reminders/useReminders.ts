import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { dayKey, reviewsDueOn } from '../core/daily';
import { currentStreak } from '../core/progress';
import { reminderText, reminderTimes } from '../core/reminders';
import type { LearnMap, Mushroom, Settings, Streak } from '../core/types';
import { useDeck, useStore } from '../state/store';

const CHANNEL = 'daily-reminder';
// Android only for now; there is no iOS build yet, and the web has no scheduled notifications.
const supported = Platform.OS === 'android';

/** Asks for notification permission (Android 13+) when the user turns reminders on. */
export async function allowReminders(): Promise<boolean> {
  if (!supported) return false;
  if ((await Notifications.getPermissionsAsync()).granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

interface Plan {
  deck: Mushroom[];
  learn: LearnMap;
  settings: Settings;
  examDoneOn: string;
  streak: Streak;
}

/** Replaces the scheduled reminders with a fresh week of them (none if reminders are off). */
async function schedule({ deck, learn, settings, examDoneOn, streak }: Plan) {
  await Notifications.cancelAllScheduledNotificationsAsync();
  if (!settings.reminders || !settings.onboarded) return;
  if (!(await Notifications.getPermissionsAsync()).granted) return;
  await Notifications.setNotificationChannelAsync(CHANNEL, {
    name: 'Daily lesson reminder',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
  const now = new Date();
  const today = dayKey(now.getTime());
  const unlearned = deck.filter((p) => !learn[p.id]).length;
  const newCount = Math.min(settings.mushroomsPerDay, unlearned);
  const days = reminderTimes(now, examDoneOn === today)
    // Once every mushroom is learned, remind only on days with reviews to do.
    .filter((time) => unlearned > 0 || reviewsDueOn(deck, learn, dayKey(time.getTime())) > 0);
  for (const [i, time] of days.entries()) {
    await Notifications.scheduleNotificationAsync({
      content: {
        ...reminderText({ newCount, streak: currentStreak(streak, today), things: 'mushrooms', first: i === 0 }),
        data: { url: '/lesson' },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: time, channelId: CHANNEL },
    });
  }
}

// One plan at a time, so overlapping updates can't leave duplicate reminders.
let queue: Promise<void> = Promise.resolve();
const replan = (plan: Plan) => {
  queue = queue.then(() => schedule(plan)).catch(() => {});
};

/**
 * Keeps the daily reminder in step with progress: re-planned when ShroomLock opens, comes back
 * to the front, or a lesson is finished. Tapping a reminder opens the lesson.
 */
export function useReminders() {
  const { state } = useStore();
  const deck = useDeck();
  const { hydrated, settings, examDoneOn, streak, learn } = state;

  useEffect(() => {
    if (!supported || !hydrated) return;
    const plan = { deck, learn, settings, examDoneOn, streak };
    replan(plan);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && replan(plan));
    return () => sub.remove();
  }, [hydrated, deck, learn, settings, examDoneOn, streak]);

  useEffect(() => {
    if (!supported) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const url = response?.notification.request.content.data?.url;
      if (typeof url !== 'string') return;
      Notifications.clearLastNotificationResponseAsync().catch(() => {});
      // After the navigator has mounted (a cold start from the notification).
      setTimeout(() => {
        try {
          router.push(url as '/lesson');
        } catch {}
      }, 0);
    };
    // Opened from a reminder while ShroomLock wasn't running, then any taps from now on.
    Notifications.getLastNotificationResponseAsync().then(open).catch(() => {});
    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, []);
}
