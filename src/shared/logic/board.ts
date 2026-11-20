import type { Cell, Dir, Vec } from './types.ts';

export type Board = {
  w: number;
  h: number;
  cells: Cell[];
  start: Vec;
  drop: Vec | null;
  vault: Vec | null;
  key: Vec | null;
  note: Vec | null;
};

export const DIRS: Record<Dir, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const LEGEND: Record<string, Cell> = {
  '#': 'wall',
  '.': 'floor',
  S: 'start',
  F: 'drop',
  V: 'vault',
  K: 'key',
  N: 'note',
  D: 'doorA',
  d: 'doorB',
  H: 'hidden',
};

export function parseBoard(rows: readonly string[]): Board {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const cells: Cell[] = [];
  let start: Vec | null = null;
  let drop: Vec | null = null;
  let vault: Vec | null = null;
  let key: Vec | null = null;
  let note: Vec | null = null;
  rows.forEach((row, y) => {
    if (row.length !== w) throw new Error(`Row ${y} has length ${row.length}, expected ${w}`);
    [...row].forEach((ch, x) => {
      const cell = LEGEND[ch];
      if (!cell) throw new Error(`Unknown map character "${ch}" at ${x},${y}`);
      cells.push(cell);
      const p = { x, y };
      if (cell === 'start') start = p;
      if (cell === 'drop') drop = p;
      if (cell === 'vault') vault = p;
      if (cell === 'key') key = p;
      if (cell === 'note') note = p;
    });
  });
  if (!start) throw new Error('Map has no start (S)');
  return { w, h, cells, start, drop, vault, key, note };
}

/** The same floor plan, mirrored left to right. */
export function mirrorRows(rows: readonly string[]): string[] {
  return rows.map((r) => [...r].reverse().join(''));
}

export function inBounds(b: Board, p: Vec): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < b.w && p.y < b.h;
}

export function cellAt(b: Board, p: Vec): Cell {
  if (!inBounds(b, p)) return 'wall';
  return b.cells[p.y * b.w + p.x] ?? 'wall';
}

export function add(a: Vec, b: Vec): Vec {
  return { x: a.x + b.x, y: a.y + b.y };
}

export function same(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}

export function keyOf(p: Vec): string {
  return `${p.x},${p.y}`;
}
