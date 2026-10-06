import { addDays, MASTERED_STEP } from './daily';
import type { LearnMap, Mushroom, Streak } from './types';

/** Streak, collection and milestones: the reasons to come back tomorrow. */

export const NO_STREAK: Streak = { last: '', count: 0, best: 0 };

/** The exam was finished today: extend the streak, or start a new one after a missed day. */
export function extendStreak(streak: Streak, today: string): Streak {
  if (streak.last === today) return streak;
  const count = streak.last === addDays(today, -1) ? streak.count + 1 : 1;
  return { last: today, count, best: Math.max(streak.best, count) };
}

/** The streak as it stands today: still alive until today's exam is due, gone after a missed day. */
export function currentStreak(streak: Streak, today: string): number {
  return streak.last === today || streak.last === addDays(today, -1) ? streak.count : 0;
}

/** Mushrooms met in a lesson: the user's collection. */
export function collectedCount(deck: Mushroom[], learn: LearnMap): number {
  return deck.filter((m) => learn[m.id]).length;
}

/** Mushrooms that passed every review. */
export function masteredCount(deck: Mushroom[], learn: LearnMap): number {
  return deck.filter((m) => (learn[m.id]?.step ?? 0) >= MASTERED_STEP).length;
}

export interface Milestone {
  id: string;
  emoji: string;
  label: string;
  /** Progress towards it, e.g. 7 of 10. */
  value: number;
  target: number;
  done: boolean;
}

export function milestones(input: { collected: number; mastered: number; bestStreak: number; total: number }) {
  const { collected, mastered, bestStreak, total } = input;
  const list: Omit<Milestone, 'done'>[] = [
    { id: 'collect-1', emoji: '🍄', label: 'First mushroom', value: collected, target: 1 },
    { id: 'collect-10', emoji: '🧺', label: '10 mushrooms collected', value: collected, target: 10 },
    { id: 'collect-25', emoji: '🔎', label: '25 mushrooms collected', value: collected, target: 25 },
    { id: 'collect-all', emoji: '🏆', label: `All ${total} mushrooms collected`, value: collected, target: total },
    { id: 'streak-3', emoji: '🔥', label: '3-day streak', value: bestStreak, target: 3 },
    { id: 'streak-7', emoji: '📅', label: '7-day streak', value: bestStreak, target: 7 },
    { id: 'streak-30', emoji: '🌕', label: '30-day streak', value: bestStreak, target: 30 },
    { id: 'master-1', emoji: '🎓', label: 'First mushroom mastered', value: mastered, target: 1 },
    { id: 'master-10', emoji: '🧠', label: '10 mushrooms mastered', value: mastered, target: 10 },
  ];
  return list.map((m) => ({ ...m, value: Math.min(m.value, m.target), done: m.value >= m.target }));
}

/** The unfinished milestone closest to done, to show as the next goal. */
export function nextMilestone(list: Milestone[]): Milestone | undefined {
  return list.filter((m) => !m.done).sort((a, b) => b.value / b.target - a.value / a.target)[0];
}
