import { mirrorRows } from '../logic/board.ts';
import type { DreamDef } from '../logic/types.ts';

/**
 * Night 1: Ines Varro, the lighthouse keeper.
 * One floor plan, three layers: tide doors, then the mirrored page, then echoes guarding the vault.
 */
const PLAN = [
  'S..#..F',
  '.#.D.#.',
  '.#.#.#.',
  '...d...',
  '##.##H#',
  '....#..',
  'N##....',
] as const;

const L1 = PLAN.map((r) => r.replace('N', '.'));
const L2 = mirrorRows(PLAN);
const L3 = PLAN.map((r) => r.replace('N', '.')).map((r, y) => {
  if (y === 0) return r.replace('F', 'V');
  if (y === 6) return `${r.slice(0, 6)}K`;
  return r;
});

export const NIGHT_1: DreamDef = {
  id: 'night-1-lighthouse',
  night: 1,
  dreamer: 'ines',
  favours: 'lantern',
  layers: [
    { rows: L1, twist: 'tide-doors', pullMs: 80_000, par: 8, tidePeriodMs: 4_000 },
    { rows: L2, twist: 'mirror', pullMs: 70_000, par: 8, mirrorControls: true },
    { rows: L3, twist: 'echoes', pullMs: 60_000, par: 20, echoDelaysMs: [4_000] },
  ],
};
