import { MAX_BOX } from './srs';
import type { Mushroom, ProgressMap } from './types';

/**
 * Mycology IQ: 60 for a beginner, 160 when every mushroom in the deck is mastered.
 * Each mushroom contributes its Leitner box / MAX_BOX, so it only rises with
 * repeated, spaced correct answers — not with one lucky guess.
 */
export function mycologyIQ(mushrooms: Mushroom[], progress: ProgressMap): number {
  if (!mushrooms.length) return 60;
  const mastery = mushrooms.reduce((sum, p) => sum + (progress[p.id]?.box ?? 0) / MAX_BOX, 0) / mushrooms.length;
  return Math.round(60 + 100 * mastery);
}

export function accuracy(progress: ProgressMap): number | null {
  let correct = 0;
  let seen = 0;
  for (const p of Object.values(progress)) {
    correct += p.correct;
    seen += p.seen;
  }
  return seen ? correct / seen : null;
}

export function masteredCount(mushrooms: Mushroom[], progress: ProgressMap): number {
  return mushrooms.filter((p) => (progress[p.id]?.box ?? 0) >= MAX_BOX - 1).length;
}

/** Mushrooms the user keeps missing, worst first. */
export function troubleMushrooms(mushrooms: Mushroom[], progress: ProgressMap, limit = 5): Mushroom[] {
  return mushrooms
    .filter((p) => (progress[p.id]?.wrong ?? 0) > 0)
    .sort((a, b) => {
      const pa = progress[a.id];
      const pb = progress[b.id];
      return pb.wrong / pb.seen - pa.wrong / pa.seen || pb.wrong - pa.wrong;
    })
    .slice(0, limit);
}
