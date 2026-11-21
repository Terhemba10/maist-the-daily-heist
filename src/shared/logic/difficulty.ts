import type { DreamDef, LayerDef } from './types.ts';

export type Difficulty = 'easy' | 'medium' | 'hard';

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'medium', 'hard'];

/** Extra moves allowed over par for the "tidy moves" moon. */
export const MOVE_SLACK: Record<Difficulty, number> = { easy: 4, medium: 2, hard: 1 };

/**
 * The same daily dream at three difficulties (see GAME_BIBLE §14).
 * Easy: longer Pull, one slower echo. Hard: shorter Pull, an extra echo and one extra twist
 * (the mirror layer also gets tide doors).
 */
export function applyDifficulty(dream: DreamDef, d: Difficulty): DreamDef {
  if (d === 'medium') return dream;
  const layers = dream.layers.map((l): LayerDef => {
    const pullMs = Math.round(l.pullMs * (d === 'easy' ? 1.3 : 0.8));
    let next: LayerDef = { ...l, pullMs };
    if (l.echoDelaysMs?.length) {
      next = { ...next, echoDelaysMs: d === 'easy' ? [6_000] : [3_000, 6_000] };
    }
    if (d === 'hard' && l.twist === 'mirror' && !l.tidePeriodMs) {
      next = { ...next, tidePeriodMs: 4_500 };
    }
    return next;
  });
  return { ...dream, layers };
}
