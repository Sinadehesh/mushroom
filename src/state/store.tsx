import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';

import { dayKey, markStudied, recordReview, recordStats } from '../core/daily';
import { deckCategories } from '../core/plus';
import { extendStreak, NO_STREAK } from '../core/progress';
import { readSaved, SAVE_KEY, serializeSaved, type SavedState } from '../core/saved';
import { DEFAULT_SETTINGS, type Settings } from '../core/types';
import { MUSHROOMS } from '../data/mushrooms';

interface State extends SavedState {
  hydrated: boolean;
}

type Action =
  | { type: 'hydrate'; state: Partial<SavedState> }
  | { type: 'studied'; mushroomIds: string[]; now: number }
  | { type: 'answer'; mushroomId: string; correct: boolean; now: number }
  | { type: 'examDone'; now: number }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'useEmergency'; now: number }
  | { type: 'setPlus'; plus: boolean }
  | { type: 'unlockWithCode' }
  | { type: 'resetProgress' };

const initialState: State = {
  settings: DEFAULT_SETTINGS,
  learn: {},
  stats: {},
  today: { day: '', correct: [] },
  examDoneOn: '',
  streak: NO_STREAK,
  emergency: { day: '', used: 0 },
  plus: false,
  codeUnlock: false,
  hydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        ...action.state,
        settings: { ...DEFAULT_SETTINGS, ...action.state.settings },
        hydrated: true,
      };
    case 'studied':
      return { ...state, learn: markStudied(state.learn, action.mushroomIds, dayKey(action.now)) };
    case 'answer': {
      const day = dayKey(action.now);
      const correctToday = state.today.day === day ? state.today.correct : [];
      return {
        ...state,
        stats: recordStats(state.stats, action.mushroomId, action.correct),
        learn: recordReview(state.learn, action.mushroomId, action.correct, day),
        today: {
          day,
          correct:
            action.correct && !correctToday.includes(action.mushroomId)
              ? [...correctToday, action.mushroomId]
              : correctToday,
        },
      };
    }
    case 'examDone': {
      const day = dayKey(action.now);
      return { ...state, examDoneOn: day, streak: extendStreak(state.streak, day) };
    }
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'useEmergency': {
      const day = dayKey(action.now);
      const used = state.emergency.day === day ? state.emergency.used + 1 : 1;
      return { ...state, emergency: { day, used } };
    }
    case 'setPlus':
      return state.plus === action.plus ? state : { ...state, plus: action.plus };
    case 'unlockWithCode':
      return { ...state, codeUnlock: true };
    case 'resetProgress':
      return { ...state, learn: {}, stats: {}, today: { day: '', correct: [] }, examDoneOn: '', streak: NO_STREAK };
  }
}

const StoreContext = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  // Saving starts only once the save was read, so a failed read never writes defaults over progress.
  const canSave = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(SAVE_KEY)
      .then(async (raw) => {
        const { state: saved, unreadable } = readSaved(raw);
        // Keep a copy of anything that isn't a save rather than lose it to the next write.
        if (unreadable && raw) await AsyncStorage.setItem(`${SAVE_KEY}-unreadable`, raw);
        canSave.current = true;
        dispatch({ type: 'hydrate', state: saved });
      })
      .catch(() => dispatch({ type: 'hydrate', state: {} }));
  }, []);

  useEffect(() => {
    if (!state.hydrated || !canSave.current) return;
    const { hydrated: _, ...saved } = state;
    AsyncStorage.setItem(SAVE_KEY, serializeSaved(saved)).catch(() => {});
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** The mushroom deck: the groups enabled in Settings that the user is entitled to (free: the gilled mushrooms). */
export function useDeck() {
  const { state } = useStore();
  return useMemo(() => {
    const categories = deckCategories(state.settings.categories, hasPlus(state));
    return MUSHROOMS.filter((m) => categories.includes(m.category));
  }, [state.settings.categories, state.plus, state.codeUnlock]);
}

/** Plus is on: bought through Google Play, or unlocked with a review code. */
export function hasPlus(state: Pick<State, 'plus' | 'codeUnlock'>): boolean {
  return state.plus || state.codeUnlock;
}

export function correctToday(state: State, now: number): Set<string> {
  return new Set(state.today.day === dayKey(now) ? state.today.correct : []);
}

export function emergencyLeft(state: State, now: number): number {
  const used = state.emergency.day === dayKey(now) ? state.emergency.used : 0;
  return Math.max(0, state.settings.emergencyUnlocksPerDay - used);
}
