// Chart colours. Both palettes were validated (lightness band, chroma floor, colour-blind
// separation, contrast on the card surfaces) so the same slot reads the same in light and dark.
import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

import { Brand } from '@/constants/theme';

export const PALETTE_LIGHT = ['#0F8A62', '#3A6FD8', '#E07B2E', '#C4457F', '#B8860B', '#1FA3B8', '#7B58D6', '#A0522D'] as const;
export const PALETTE_DARK = ['#22A97A', '#5B8AF0', '#D9772A', '#D8579A', '#B8891C', '#2A9DB0', '#9A7BEA', '#C46B44'] as const;

export type ChartPalette = {
  series: readonly string[];
  primary: string;
  other: string;       // "everything else" segment
  track: string;       // ring / bar background
  grid: string;
  label: string;       // axis labels (secondary text)
  warning: string;
  danger: string;
  success: string;
};

/** Colour follows the entity: each category has a fixed slot so it looks the same in every chart. */
const CATEGORY_SLOT: Record<string, number> = {
  food: 0, household: 1, restaurant: 2, personal_care: 3, pharmacy: 4, drink: 5, alcohol: 6, pet: 7,
  utilities: 1, fuel: 2, clothing: 3, services: 4, transport: 5, electronics: 6, parking: 7,
};

export function useChartPalette(): ChartPalette {
  const dark = useColorScheme() === 'dark';
  return useMemo(() => ({
    series: dark ? PALETTE_DARK : PALETTE_LIGHT,
    primary: dark ? PALETTE_DARK[0] : Brand.primary,
    other: dark ? '#7A7F87' : '#8A8F98',
    track: dark ? '#2E3135' : '#E0E1E6',
    grid: dark ? '#3A3D42' : '#D9DBE0',
    label: dark ? '#B0B4BA' : '#60646C',
    warning: Brand.warning,
    danger: Brand.danger,
    success: Brand.success,
  }), [dark]);
}

/**
 * Colours for a list of category names in one chart: the category's own slot when free,
 * otherwise the first unused slot, so no two segments share a colour. 'other' is always grey.
 */
export function assignColors(names: string[], p: ChartPalette): Record<string, string> {
  const used = new Set<number>();
  const out: Record<string, string> = {};
  for (const name of names) {
    if (name === 'other' || name === 'Other') { out[name] = p.other; continue; }
    let slot = CATEGORY_SLOT[name];
    if (slot === undefined || used.has(slot)) slot = [0, 1, 2, 3, 4, 5, 6, 7].find((i) => !used.has(i)) ?? -1;
    if (slot < 0) { out[name] = p.other; continue; }
    used.add(slot);
    out[name] = p.series[slot];
  }
  return out;
}

export function categoryColor(name: string, p: ChartPalette): string {
  const slot = CATEGORY_SLOT[name];
  return slot === undefined ? p.other : p.series[slot];
}
