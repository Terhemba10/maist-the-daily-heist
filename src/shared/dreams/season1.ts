import type { AbilityId } from '../logic/types.ts';

/** Season 1: The Moth. One dreamer per night (see docs/GAME_BIBLE.md §1). Every 7th night is a 5-layer deep dream. */
export type NightInfo = { night: number; dreamer: string; favours: AbilityId };

const IDS = [
  'ines', 'teodor', 'mira', 'aurelio', 'june', 'kofi', 'harbour',
  'priya', 'bram', 'lena', 'hugo', 'esme', 'rafi', 'fair',
  'odile', 'tam', 'felix', 'anya', 'gideon', 'rosa', 'ward',
  'wen', 'otto', 'nell', 'isaac', 'dalia', 'moth', 'lowmere',
  'diver', 'archive',
] as const;

const FAVOURS: AbilityId[] = ['lantern', 'still', 'blink', 'still', 'lantern', 'blink', 'lantern'];

export const SEASON_1: readonly NightInfo[] = IDS.map((dreamer, i) => ({
  night: i + 1,
  dreamer,
  favours: FAVOURS[i % FAVOURS.length] ?? 'lantern',
}));

export function nightInfo(night: number): NightInfo {
  const n = Math.max(1, Math.min(SEASON_1.length, night));
  return SEASON_1[n - 1] ?? { night: n, dreamer: 'ines', favours: 'lantern' };
}

export function isDeepDream(night: number): boolean {
  return night % 7 === 0;
}
