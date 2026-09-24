import type { Difficulty } from './types';

/**
 * The lock-screen intercept as a pure state machine, so the Genius Penalty
 * can't be bypassed by tapping fast: answers are ignored while frozen, and a
 * retry is refused until the penalty has fully elapsed.
 */
export type ChallengeState =
  | { phase: 'question'; mushroomId: string; attempts: number }
  | { phase: 'penalty'; mushroomId: string; attempts: number; endsAt: number; guess: string }
  | { phase: 'unlocked'; mushroomId: string; attempts: number };

export type ChallengeEvent =
  | { type: 'answer'; correct: boolean; guess: string; now: number; penaltySeconds: number }
  | { type: 'retry'; now: number; nextMushroomId: string };

export function startChallenge(mushroomId: string): ChallengeState {
  return { phase: 'question', mushroomId, attempts: 0 };
}

export function challengeReducer(state: ChallengeState, event: ChallengeEvent): ChallengeState {
  switch (event.type) {
    case 'answer': {
      if (state.phase !== 'question') return state;
      const attempts = state.attempts + 1;
      if (event.correct) return { phase: 'unlocked', mushroomId: state.mushroomId, attempts };
      return {
        phase: 'penalty',
        mushroomId: state.mushroomId,
        attempts,
        endsAt: event.now + event.penaltySeconds * 1000,
        guess: event.guess,
      };
    }
    case 'retry': {
      if (state.phase !== 'penalty' || event.now < state.endsAt) return state;
      return { phase: 'question', mushroomId: event.nextMushroomId, attempts: state.attempts };
    }
  }
}

export function penaltySecondsLeft(state: ChallengeState, now: number): number {
  if (state.phase !== 'penalty') return 0;
  return Math.max(0, Math.ceil((state.endsAt - now) / 1000));
}

/**
 * Which mushroom to ask after a penalty. Hard Mode re-asks the same mushroom: you just
 * stared at its name for 10 seconds, now recall it (retrieval after feedback).
 * Easy Mode moves on, otherwise the retry is a free 1-in-3 guess.
 */
export function retryUsesSameMushroom(difficulty: Difficulty): boolean {
  return difficulty === 'hard';
}
