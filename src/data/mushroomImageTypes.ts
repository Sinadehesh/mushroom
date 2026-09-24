import type { ImageSourcePropType } from 'react-native';

export interface MushroomImage {
  source: ImageSourcePropType;
  /** Required for CC BY / CC BY-SA photos; shown with the photo and on the Credits screen. */
  credit: { author: string; license: string; sourceUrl: string };
}

export function creditLine({ credit }: MushroomImage): string {
  return `Photo: ${credit.author} · ${credit.license}`;
}
