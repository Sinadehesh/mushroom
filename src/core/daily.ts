import type { LearnMap, LearnRecord, Mushroom, StatsMap } from './types';

/**
 * The daily plan:
 *  - each day's lesson introduces `mushroomsPerDay` new mushrooms, shown once each, then examined;
 *  - then each mushroom comes back for review on a widening schedule (REVIEW_DAYS): 1 day later,
 *    then 3, 7, 14 and 30 days after each right answer. A miss, in an exam or on the lock screen,
 *    starts its schedule over from tomorrow. After the last review it's mastered.
 *
 * Days are local calendar days as "YYYY-MM-DD", so they sort as strings.
 */

export type Rng = () => number;

/** Days until the next review, by step. Passing the last one masters the mushroom. */
export const REVIEW_DAYS = [1, 3, 7, 14, 30] as const;
export const MASTERED_STEP = REVIEW_DAYS.length;
/** A day's exam asks at most this many reviews (the most overdue first); the rest wait a day. */
export const MAX_REVIEWS_PER_DAY = 15;

export function dayKey(now: number): string {
  const d = new Date(now);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(day: string, days: number): string {
  const [y, m, d] = day.split('-').map(Number);
  return dayKey(new Date(y, m - 1, d + days).getTime());
}

/** Today's new mushrooms: the ones already studied today, or else the next unlearned ones in deck order. */
export function todaysNewMushrooms(deck: Mushroom[], learn: LearnMap, today: string, perDay: number): Mushroom[] {
  const studied = deck.filter((m) => learn[m.id]?.learnedOn === today);
  if (studied.length) return studied;
  return deck.filter((m) => !learn[m.id]).slice(0, perDay);
}

export function lessonStudied(deck: Mushroom[], learn: LearnMap, today: string): boolean {
  return deck.some((m) => learn[m.id]?.learnedOn === today);
}

const isDue = (r: LearnRecord | undefined, today: string): r is LearnRecord =>
  !!r && r.step < MASTERED_STEP && r.learnedOn < today && r.dueOn <= today;

/** Mushrooms due for review today, the most overdue first, at most MAX_REVIEWS_PER_DAY. */
export function dueReviews(deck: Mushroom[], learn: LearnMap, today: string): Mushroom[] {
  return deck
    .filter((m) => isDue(learn[m.id], today))
    .sort((a, b) => learn[a.id].dueOn.localeCompare(learn[b.id].dueOn) || learn[a.id].step - learn[b.id].step)
    .slice(0, MAX_REVIEWS_PER_DAY);
}

/** Today's exam: the new mushrooms just studied, then the reviews due today. */
export function examMushrooms(deck: Mushroom[], learn: LearnMap, today: string, perDay: number): Mushroom[] {
  const fresh = lessonStudied(deck, learn, today) ? todaysNewMushrooms(deck, learn, today, perDay) : [];
  return [...fresh, ...dueReviews(deck, learn, today)];
}

/** Mark today's new mushrooms as learned (the lesson's study cards were shown). */
export function markStudied(learn: LearnMap, mushroomIds: string[], today: string): LearnMap {
  const next = { ...learn };
  for (const id of mushroomIds) next[id] ??= { learnedOn: today, step: 0, dueOn: addDays(today, REVIEW_DAYS[0]) };
  return next;
}

/**
 * An answer about a learned mushroom. Right on or after its due day: one step further out.
 * Wrong at any time: back to step 0, due tomorrow. Right before it's due: no change.
 */
export function recordReview(learn: LearnMap, mushroomId: string, correct: boolean, today: string): LearnMap {
  const r = learn[mushroomId];
  if (!r) return learn;
  if (!correct) {
    const restart = { ...r, step: 0, dueOn: addDays(today, REVIEW_DAYS[0]) };
    return r.step === restart.step && r.dueOn === restart.dueOn ? learn : { ...learn, [mushroomId]: restart };
  }
  if (!isDue(r, today)) return learn;
  const step = r.step + 1;
  const dueOn = step < MASTERED_STEP ? addDays(today, REVIEW_DAYS[step]) : '';
  return { ...learn, [mushroomId]: { ...r, step, dueOn } };
}

/**
 * Mushrooms the lock screen asks about: today's exam first; once the user has nothing due,
 * anything they've learned; on day one before the lesson, today's new mushrooms (the
 * penalty screen teaches the name).
 */
export function lockScreenPool(deck: Mushroom[], learn: LearnMap, today: string, perDay: number): Mushroom[] {
  const exam = examMushrooms(deck, learn, today, perDay);
  if (exam.length) return exam;
  const learned = deck.filter((m) => learn[m.id]);
  if (learned.length) return learned;
  const fresh = todaysNewMushrooms(deck, learn, today, perDay);
  return fresh.length ? fresh : deck;
}

/**
 * Next lock-screen mushroom: one from the pool not yet answered right today, else any;
 * never the same mushroom twice in a row when there's a choice.
 */
export function pickLockMushroom(
  pool: Mushroom[],
  correctToday: ReadonlySet<string>,
  rng: Rng = Math.random,
  excludeId?: string,
): Mushroom {
  if (!pool.length) throw new Error('pickLockMushroom: empty pool');
  const options = pool.length > 1 ? pool.filter((m) => m.id !== excludeId) : pool;
  const open = options.filter((m) => !correctToday.has(m.id));
  const from = open.length ? open : options;
  return from[Math.floor(rng() * from.length)];
}

export function recordStats(stats: StatsMap, mushroomId: string, correct: boolean): StatsMap {
  const s = stats[mushroomId] ?? { seen: 0, correct: 0, wrong: 0 };
  return {
    ...stats,
    [mushroomId]: { seen: s.seen + 1, correct: s.correct + (correct ? 1 : 0), wrong: s.wrong + (correct ? 0 : 1) },
  };
}

export type LearnStatus = 'new' | 'learning' | 'mastered';

export function learnStatus(learn: LearnMap, mushroomId: string): LearnStatus {
  const r = learn[mushroomId];
  return !r ? 'new' : r.step >= MASTERED_STEP ? 'mastered' : 'learning';
}

/** How many reviews are due on `day` (for "Tomorrow: …" on the Today screen). */
export function reviewsDueOn(deck: Mushroom[], learn: LearnMap, day: string): number {
  return Math.min(MAX_REVIEWS_PER_DAY, deck.filter((m) => isDue(learn[m.id], day)).length);
}
