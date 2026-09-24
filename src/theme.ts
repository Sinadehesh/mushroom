import { Platform, useColorScheme } from 'react-native';

import type { Edibility, MushroomCategory } from './core/types';

const light = {
  background: '#F6F1EA',
  surface: '#FFFFFF',
  surfaceMuted: '#EEE6DB',
  text: '#2A211B',
  textMuted: '#6E6259',
  border: '#E2D8CB',
  primary: '#8A4B2A',
  onPrimary: '#FFFFFF',
  accent: '#B8742A',
  success: '#3F7D4A',
  warning: '#A8620F',
  danger: '#B3413A',
  overlay: 'rgba(20, 14, 10, 0.74)',
};

const dark: typeof light = {
  background: '#15110E',
  surface: '#1F1915',
  surfaceMuted: '#2A221D',
  text: '#EFE7DF',
  textMuted: '#A8998C',
  border: '#382E27',
  primary: '#E0A27A',
  onPrimary: '#2A140A',
  accent: '#E8B866',
  success: '#86C98F',
  warning: '#F0B35C',
  danger: '#F08A80',
  overlay: 'rgba(0, 0, 0, 0.8)',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const serif = Platform.select({
  ios: 'Georgia',
  android: 'serif',
  default: 'Georgia, "Times New Roman", serif',
});

export const CATEGORY_EMOJI: Record<MushroomCategory, string> = { gilled: '🍄', pored: '🪵', other: '🪸' };
export const CATEGORY_LABEL: Record<MushroomCategory, string> = {
  gilled: 'Gilled',
  pored: 'Pores & brackets',
  other: 'Ridges, spines & more',
};

export const EDIBILITY_LABEL: Record<Edibility, string> = {
  choice: 'Choice edible',
  edible: 'Edible',
  inedible: 'Inedible',
  poisonous: 'Poisonous',
  deadly: 'Deadly',
};

export function edibilityColor(edibility: Edibility, c: Colors): string {
  switch (edibility) {
    case 'choice':
    case 'edible':
      return c.success;
    case 'inedible':
      return c.textMuted;
    case 'poisonous':
      return c.warning;
    case 'deadly':
      return c.danger;
  }
}
