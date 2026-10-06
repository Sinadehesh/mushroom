import type { Rng } from './daily';
import type { Mushroom } from './types';

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

/** Everything `mushroom` is commonly mistaken for, from `all`. */
export function lookalikesOf(mushroom: Mushroom, all: Mushroom[]): Mushroom[] {
  return all.filter((m) => areLookalikes(mushroom, m));
}

/**
 * Multiple-choice options: the answer plus distractors drawn from its real look-alikes first,
 * from anywhere in `all` (chanterelle next to jack-o'-lantern is the lesson that matters), then
 * the same group in the user's deck (a morel next to three gilled mushrooms is too easy), then
 * the rest of the deck, then anything.
 */
export function buildChoices(
  answer: Mushroom,
  deck: Mushroom[],
  all: Mushroom[] = deck,
  count = 4,
  rng: Rng = Math.random,
): Mushroom[] {
  const usable = (m: Mushroom) => m.id !== answer.id && m.commonName !== answer.commonName;
  const lookalikes = shuffle(
    all.filter((m) => usable(m) && areLookalikes(answer, m)),
    rng,
  );
  const taken = new Set(lookalikes.map((m) => m.id));
  const fromDeck = deck.filter((m) => usable(m) && !taken.has(m.id));
  const sameCategory = shuffle(
    fromDeck.filter((m) => m.category === answer.category),
    rng,
  );
  const restOfDeck = shuffle(
    fromDeck.filter((m) => m.category !== answer.category),
    rng,
  );
  const inDeck = new Set(deck.map((m) => m.id));
  const anything = shuffle(
    all.filter((m) => usable(m) && !taken.has(m.id) && !inDeck.has(m.id)),
    rng,
  );
  const distractors = [...lookalikes, ...sameCategory, ...restOfDeck, ...anything].slice(0, count - 1);
  return shuffle([answer, ...distractors], rng);
}
