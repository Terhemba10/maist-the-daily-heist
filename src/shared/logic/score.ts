import type { PlayStyle } from './types.ts';

export type LayerResult = {
  cleared: boolean;
  timeLeftMs: number;
  pullMs: number;
  moves: number;
  par: number;
  caught: number;
};

/** 1 moon for clearing, +1 for keeping ≥ 40 % of the Pull, +1 for moves ≤ par + 2. */
export function moonsFor(r: LayerResult): number {
  if (!r.cleared) return 0;
  let moons = 1;
  if (r.timeLeftMs >= r.pullMs * 0.4) moons += 1;
  if (r.moves <= r.par + 2) moons += 1;
  return moons;
}

export function isLucid(results: readonly LayerResult[], layerCount: number): boolean {
  return results.length === layerCount && results.every((r) => moonsFor(r) === 3);
}

export function scoreRun(results: readonly LayerResult[], layerCount: number): number {
  let score = 0;
  for (const r of results) {
    if (!r.cleared) continue;
    score += 1000;
    score += 10 * Math.floor(r.timeLeftMs / 1000);
    score -= 5 * Math.max(0, r.moves - r.par);
  }
  if (isLucid(results, layerCount)) score += 250;
  return Math.max(0, score);
}

/** Which reactive line the dreamer says at the end. */
export function playStyle(results: readonly LayerResult[], layerCount: number): PlayStyle {
  if (isLucid(results, layerCount)) return 'perfect';
  if (results.some((r) => r.caught > 0)) return 'caught';
  const pull = results.reduce((a, r) => a + r.pullMs, 0);
  const left = results.reduce((a, r) => a + r.timeLeftMs, 0);
  return pull > 0 && left / pull >= 0.45 ? 'fast' : 'slow';
}

/** Spoiler-free share line, e.g. "Night 1 · 3 layers · 42 s left · 🌙🌙🌙". */
export function shareLine(night: number, results: readonly LayerResult[]): string {
  const cleared = results.filter((r) => r.cleared).length;
  const left = Math.floor(results.reduce((a, r) => a + (r.cleared ? r.timeLeftMs : 0), 0) / 1000);
  const moons = results.map((r) => '🌙'.repeat(moonsFor(r)) || '·').join(' ');
  return `Night ${night} · ${cleared} layer${cleared === 1 ? '' : 's'} · ${left} s left · ${moons}`;
}
