/**
 * The daily reminder: one notification a day at REMINDER_HOUR, only on days the lesson isn't
 * done yet. Reminders are scheduled a week ahead and re-planned whenever ShroomLock opens or a
 * lesson is finished, so a finished day gets no reminder.
 */

export const REMINDER_HOUR = 19;
export const REMINDER_DAYS_AHEAD = 7;

/**
 * When to remind: at `hour` on each of the next `days` days, starting today unless today's
 * lesson is already done or the reminder time has passed.
 */
export function reminderTimes(now: Date, doneToday: boolean, hour = REMINDER_HOUR, days = REMINDER_DAYS_AHEAD): Date[] {
  const at = (offset: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, hour);
  const first = !doneToday && at(0).getTime() > now.getTime() ? 0 : 1;
  return Array.from({ length: days }, (_, i) => at(first + i));
}

/**
 * The reminder's text. `things` is the plural noun ("mushrooms"); the first reminder mentions the
 * streak it can still save.
 */
export function reminderText(input: { newCount: number; streak: number; things: string; first: boolean }): {
  title: string;
  body: string;
} {
  const { newCount, streak, things, first } = input;
  const title =
    newCount === 0
      ? 'Time for a quick review'
      : newCount === 1
        ? `1 new ${things.replace(/s$/, '')} is waiting`
        : `${newCount} new ${things} are waiting`;
  const body =
    first && streak > 0 ? `One minute keeps your ${streak}-day streak going 🔥` : 'Your daily lesson takes about a minute.';
  return { title, body };
}
