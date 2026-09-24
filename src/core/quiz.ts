import type { Mushroom } from './types';
import type { Rng } from './srs';

export function shuffle<T>(items: T[], rng: Rng = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** True if either mushroom lists the other as a look-alike, so the data only needs one direction. */
export function areLookalikes(a: Mushroom, b: Mushroom): boolean {
  return a.id !== b.id && (a.lookalikes.includes(b.id) || b.lookalikes.includes(a.id));
}

/** Everything `mushroom` is commonly mistaken for, from `allMushrooms`. */
export function lookalikesOf(mushroom: Mushroom, allMushrooms: Mushroom[]): Mushroom[] {
  return allMushrooms.filter((m) => areLookalikes(mushroom, m));
}

/**
 * Easy Mode options: the answer plus distractors drawn from its look-alikes first
 * (chanterelle next to jack-o'-lantern is the lesson that matters), then the same
 * category (a morel next to three gilled mushrooms is too easy), then the rest.
 */
export function buildChoices(
  answer: Mushroom,
  allMushrooms: Mushroom[],
  count = 4,
  rng: Rng = Math.random,
): Mushroom[] {
  const others = allMushrooms.filter((m) => m.id !== answer.id && m.commonName !== answer.commonName);
  const lookalikes = shuffle(
    others.filter((m) => areLookalikes(answer, m)),
    rng,
  );
  const unrelated = others.filter((m) => !areLookalikes(answer, m));
  const sameCategory = shuffle(
    unrelated.filter((m) => m.category === answer.category),
    rng,
  );
  const rest = shuffle(
    unrelated.filter((m) => m.category !== answer.category),
    rng,
  );
  const distractors = [...lookalikes, ...sameCategory, ...rest].slice(0, count - 1);
  return shuffle([answer, ...distractors], rng);
}
