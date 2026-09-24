import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

import { recordAnswer } from '../core/srs';
import { DEFAULT_SETTINGS, type ProgressMap, type Settings } from '../core/types';
import { MUSHROOMS } from '../data/mushrooms';

const STORAGE_KEY = 'mycolock/v1';

interface PersistedState {
  settings: Settings;
  progress: ProgressMap;
  emergency: { day: string; used: number };
}

interface State extends PersistedState {
  hydrated: boolean;
}

type Action =
  | { type: 'hydrate'; state: Partial<PersistedState> | null }
  | { type: 'answer'; mushroomId: string; correct: boolean; now: number }
  | { type: 'updateSettings'; patch: Partial<Settings> }
  | { type: 'useEmergency'; now: number }
  | { type: 'resetProgress' };

/** Local calendar day, so emergency unlocks reset at the user's midnight. */
export function dayKey(now: number): string {
  const d = new Date(now);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

const initialState: State = {
  settings: DEFAULT_SETTINGS,
  progress: {},
  emergency: { day: '', used: 0 },
  hydrated: false,
};

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'hydrate':
      return {
        ...state,
        ...action.state,
        settings: { ...DEFAULT_SETTINGS, ...action.state?.settings },
        hydrated: true,
      };
    case 'answer':
      return {
        ...state,
        progress: {
          ...state.progress,
          [action.mushroomId]: recordAnswer(state.progress[action.mushroomId], action.correct, action.now),
        },
      };
    case 'updateSettings':
      return { ...state, settings: { ...state.settings, ...action.patch } };
    case 'useEmergency': {
      const day = dayKey(action.now);
      const used = state.emergency.day === day ? state.emergency.used + 1 : 1;
      return { ...state, emergency: { day, used } };
    }
    case 'resetProgress':
      return { ...state, progress: {} };
  }
}

const StoreContext = createContext<{ state: State; dispatch: (a: Action) => void } | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => dispatch({ type: 'hydrate', state: raw ? JSON.parse(raw) : null }))
      .catch(() => dispatch({ type: 'hydrate', state: null }));
  }, []);

  useEffect(() => {
    if (!state.hydrated) return;
    const { settings, progress, emergency } = state;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ settings, progress, emergency })).catch(() => {});
  }, [state]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** The mushroom deck filtered by the categories enabled in Settings. */
export function useDeck() {
  const { state } = useStore();
  return useMemo(
    () => MUSHROOMS.filter((p) => state.settings.categories.includes(p.category)),
    [state.settings.categories],
  );
}

export function emergencyLeft(state: State, now: number): number {
  const used = state.emergency.day === dayKey(now) ? state.emergency.used : 0;
  return Math.max(0, state.settings.emergencyUnlocksPerDay - used);
}
