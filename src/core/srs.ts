import type { Mushroom, MushroomProgress, ProgressMap } from './types';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/**
 * Leitner-style intervals by box. Short early steps suit this app: users hit the
 * lock screen many times a day, so a missed mushroom comes back within minutes.
 */
export const BOX_INTERVALS = [2 * MINUTE, 20 * MINUTE, 4 * HOUR, 1 * DAY, 3 * DAY, 8 * DAY, 21 * DAY];
export const MAX_BOX = BOX_INTERVALS.length - 1;

export function emptyProgress(): MushroomProgress {
  return { seen: 0, correct: 0, wrong: 0, box: 0, dueAt: 0, lastSeenAt: 0 };
}

export function recordAnswer(prev: MushroomProgress | undefined, correct: boolean, now: number): MushroomProgress {
  const p = prev ?? emptyProgress();
  const box = correct ? Math.min(p.box + 1, MAX_BOX) : 0;
  return {
    seen: p.seen + 1,
    correct: p.correct + (correct ? 1 : 0),
    wrong: p.wrong + (correct ? 0 : 1),
    box,
    dueAt: now + BOX_INTERVALS[box],
    lastSeenAt: now,
  };
}

export type Rng = () => number;

function pickRandom<T>(items: T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)];
}

/**
 * Choose the next mushroom to show on the lock screen:
 *  1. overdue mushrooms, lowest box (weakest) first;
 *  2. otherwise a mushroom never seen before;
 *  3. otherwise the mushroom that is due soonest.
 * `excludeId` avoids showing the same mushroom twice in a row.
 */
export function pickNextMushroom(
  mushrooms: Mushroom[],
  progress: ProgressMap,
  now: number,
  rng: Rng = Math.random,
  excludeId?: string,
): Mushroom {
  if (mushrooms.length === 0) throw new Error('pickNextMushroom: no mushrooms');
  const pool = mushrooms.length > 1 ? mushrooms.filter((p) => p.id !== excludeId) : mushrooms;

  const due = pool.filter((p) => progress[p.id] && progress[p.id].dueAt <= now);
  if (due.length) {
    const weakest = Math.min(...due.map((p) => progress[p.id].box));
    return pickRandom(
      due.filter((p) => progress[p.id].box === weakest),
      rng,
    );
  }

  const unseen = pool.filter((p) => !progress[p.id]);
  if (unseen.length) return pickRandom(unseen, rng);

  return pool.reduce((best, p) => (progress[p.id].dueAt < progress[best.id].dueAt ? p : best));
}
