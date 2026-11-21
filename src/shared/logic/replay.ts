import { createLayer, move, tick, timeLeftMs, useAbility } from './layer.ts';
import type { LayerResult } from './score.ts';
import type { AbilityId, Dir, DreamDef } from './types.ts';

/**
 * Deterministic runs. The game advances in fixed 50 ms steps; a run is the list of inputs with
 * the step they happened on. The server replays it to compute the official score, and the same
 * record drives ghost races.
 */
export const STEP_MS = 50;

export const CODES: readonly (Dir | 'ability')[] = ['up', 'down', 'left', 'right', 'ability'];

export type LayerRecord = {
  /** [step, code] pairs; code indexes CODES. */
  i: [number, number][];
};

export type RunRecord = { a: AbilityId; l: LayerRecord[] };

export function codeOf(action: Dir | 'ability'): number {
  return CODES.indexOf(action);
}

export type ReplayResult = { ok: true; results: LayerResult[] } | { ok: false; reason: string };

const MAX_INPUTS = 600;

export function replay(dream: DreamDef, rec: RunRecord): ReplayResult {
  if (!['still', 'blink', 'lantern'].includes(rec.a)) return { ok: false, reason: 'ability' };
  if (!Array.isArray(rec.l) || rec.l.length > dream.layers.length) return { ok: false, reason: 'layers' };
  const results: LayerResult[] = [];
  for (let li = 0; li < dream.layers.length; li++) {
    const def = dream.layers[li];
    const lr = rec.l[li];
    if (!def) break;
    const s = createLayer(def, rec.a);
    const maxSteps = Math.ceil(def.pullMs / STEP_MS) + 1;
    let steps = 0;
    const inputs = lr?.i ?? [];
    if (inputs.length > MAX_INPUTS) return { ok: false, reason: 'too many inputs' };
    for (const pair of inputs) {
      const [step, code] = pair;
      if (!Number.isInteger(step) || !Number.isInteger(code) || step < steps || step > maxSteps) return { ok: false, reason: 'bad step' };
      const action = CODES[code];
      if (!action) return { ok: false, reason: 'bad code' };
      while (steps < step && s.status === 'playing') {
        tick(s, STEP_MS);
        steps++;
      }
      if (s.status !== 'playing') break;
      if (action === 'ability') useAbility(s);
      else move(s, action);
      if (s.status !== 'playing') break;
    }
    // No more inputs: the Pull runs out (or the record ended early, which counts as waking).
    while (s.status === 'playing' && steps < maxSteps) {
      tick(s, STEP_MS);
      steps++;
    }
    const cleared = s.status === 'cleared';
    results.push({ cleared, timeLeftMs: timeLeftMs(s), pullMs: def.pullMs, moves: s.moves, par: def.par, caught: s.caught });
    if (!cleared) break;
  }
  return { ok: true, results };
}
