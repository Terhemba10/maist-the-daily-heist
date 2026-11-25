/**
 * Maist: The Daily Heist. Pure, deterministic game rules shared by the client (to play) and the
 * server (to replay every scored run). No DOM, no randomness outside the seeded generator.
 */

export const SIZE = 10;

export type Dir = 'u' | 'd' | 'l' | 'r';
export const DIRS: Record<Dir, readonly [number, number]> = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const CLOCKWISE: readonly Dir[] = ['u', 'r', 'd', 'l'];

export type Pos = readonly [number, number];

export type Tier = 'easy' | 'hard' | 'difficult';
export const TIERS: readonly Tier[] = ['easy', 'hard', 'difficult'];

/** 0 floor, 1 wall, 2 vault. */
export type Tile = 0 | 1 | 2;

export type GuardKind = 'static' | 'patrol' | 'watcher';

export type GuardDef = {
  id: number;
  kind: GuardKind;
  /** Static/watcher: one tile. Patrol: a straight line walked back and forth. */
  route: Pos[];
  facing: Dir;
};

export type LayerDef = {
  tier: Tier;
  grid: Tile[];
  start: Pos[];
  vault: Pos;
  guards: GuardDef[];
  ap: number;
  par: number;
  range: number;
  fog: boolean;
};

export type HeistDef = { night: number; layers: LayerDef[] };

// ------------------------------------------------------------------ squad

export type OpId = 0 | 1 | 2;
export const SQUAD = [
  { id: 0, key: 'shaper', glyph: '◆', ability: 'fold', cost: 2 },
  { id: 1, key: 'ghost', glyph: '◐', ability: 'fade', cost: 1 },
  { id: 2, key: 'chemist', glyph: '✦', ability: 'haze', cost: 3 },
] as const;
export const HAZE_RANGE = 3;
export const KICK_AP = 6;

// ------------------------------------------------------------------ actions

export type Action =
  | { t: 'm'; o: OpId; d: Dir }
  | { t: 'w' }
  | { t: 'a'; o: OpId; x: number; y: number }
  | { t: 'kick' };

export type RunRecord = { v: 1; layers: Action[][] };

// ------------------------------------------------------------------ state

export type OpState = { x: number; y: number; out: boolean; fade: number };
export type GuardState = { id: number; kind: GuardKind; x: number; y: number; facing: Dir; idx: number; sign: 1 | -1; stunned: number };

export type LayerStatus = 'play' | 'cleared' | 'limbo';

export type LayerState = {
  def: LayerDef;
  grid: Tile[];
  ops: OpState[];
  guards: GuardState[];
  ap: number;
  t: number;
  kicks: number;
  status: LayerStatus;
  /** Ops caught by the last guard phase (for effects). */
  lastCaught: number[];
};

export const idx = (x: number, y: number) => y * SIZE + x;
export const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;
const manhattan = (ax: number, ay: number, bx: number, by: number) => Math.abs(ax - bx) + Math.abs(ay - by);

export function newLayerState(def: LayerDef): LayerState {
  return {
    def,
    grid: def.grid.slice(),
    ops: def.start.map(([x, y]) => ({ x, y, out: false, fade: 0 })),
    guards: def.guards.map((g) => {
      const p = g.route[0] ?? [0, 0];
      return { id: g.id, kind: g.kind, x: p[0], y: p[1], facing: g.facing, idx: 0, sign: 1, stunned: 0 };
    }),
    ap: def.ap,
    t: 0,
    kicks: 0,
    status: 'play',
    lastCaught: [],
  };
}

export function cloneState(s: LayerState): LayerState {
  return {
    ...s,
    grid: s.grid.slice(),
    ops: s.ops.map((o) => ({ ...o })),
    guards: s.guards.map((g) => ({ ...g })),
    lastCaught: s.lastCaught.slice(),
  };
}

const wallAt = (grid: Tile[], x: number, y: number) => !inside(x, y) || grid[idx(x, y)] === 1;

/** Tiles a guard can currently see: its own tile plus `range` tiles ahead, stopped by walls. */
export function guardVision(s: Pick<LayerState, 'grid'>, g: GuardState, range: number): Pos[] {
  if (g.stunned > 0) return [];
  const out: Pos[] = [[g.x, g.y]];
  const [dx, dy] = DIRS[g.facing];
  let x = g.x;
  let y = g.y;
  for (let i = 0; i < range; i++) {
    x += dx;
    y += dy;
    if (wallAt(s.grid, x, y)) break;
    out.push([x, y]);
  }
  return out;
}

function towards(fromX: number, fromY: number, toX: number, toY: number): Dir {
  const dx = toX - fromX;
  const dy = toY - fromY;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'r' : 'l';
  return dy >= 0 ? 'd' : 'u';
}

/** Advance all guards by one phase (time t -> t+1). */
function guardPhase(s: LayerState): void {
  s.t += 1;
  for (const g of s.guards) {
    const def = s.def.guards.find((d) => d.id === g.id);
    if (!def) continue;
    if (g.stunned > 0) {
      g.stunned -= 1;
      continue;
    }
    if (g.kind === 'patrol' && def.route.length > 1) {
      let next = g.idx + g.sign;
      if (next < 0 || next >= def.route.length) {
        g.sign = g.sign === 1 ? -1 : 1;
        next = g.idx + g.sign;
      }
      const p = def.route[next];
      if (p) {
        g.facing = towards(g.x, g.y, p[0], p[1]);
        g.x = p[0];
        g.y = p[1];
        g.idx = next;
      }
    } else if (g.kind === 'watcher') {
      // Watchers turn to face the nearest visible operative within 4 tiles; otherwise they sweep clockwise.
      let best: OpState | null = null;
      let bd = 99;
      for (const o of s.ops) {
        if (o.out || o.fade > 0) continue;
        const d = manhattan(o.x, o.y, g.x, g.y);
        if (d <= 4 && d < bd) {
          bd = d;
          best = o;
        }
      }
      const base = CLOCKWISE.indexOf(def.facing);
      g.facing = best ? towards(g.x, g.y, best.x, best.y) : (CLOCKWISE[(base + s.t) % 4] ?? 'u');
    }
  }
}

function detect(s: LayerState): number[] {
  const seen = new Set<number>();
  for (const g of s.guards) for (const [x, y] of guardVision(s, g, s.def.range)) seen.add(idx(x, y));
  const caught: number[] = [];
  s.ops.forEach((o, i) => {
    if (!o.out && o.fade <= 0 && seen.has(idx(o.x, o.y))) {
      o.out = true;
      caught.push(i);
    }
  });
  return caught;
}

const occupied = (s: LayerState, x: number, y: number) =>
  s.ops.some((o) => !o.out && o.x === x && o.y === y) || s.guards.some((g) => g.x === x && g.y === y);

export type Check = { ok: true } | { ok: false; reason: string };

/** Is this action legal right now? */
export function canApply(s: LayerState, a: Action): Check {
  if (a.t === 'kick') return s.status === 'limbo' ? { ok: true } : { ok: false, reason: 'not adrift' };
  if (s.status !== 'play') return { ok: false, reason: 'layer over' };
  if (a.t === 'w') return s.ap >= 1 ? { ok: true } : { ok: false, reason: 'no AP' };
  const o = s.ops[a.o];
  if (!o || o.out) return { ok: false, reason: 'operative is out' };
  if (a.t === 'm') {
    if (s.ap < 1) return { ok: false, reason: 'no AP' };
    const [dx, dy] = DIRS[a.d];
    const x = o.x + dx;
    const y = o.y + dy;
    if (wallAt(s.grid, x, y)) return { ok: false, reason: 'wall' };
    if (occupied(s, x, y)) return { ok: false, reason: 'blocked' };
    return { ok: true };
  }
  const spec = SQUAD[a.o];
  if (s.ap < spec.cost) return { ok: false, reason: 'no AP' };
  if (spec.ability === 'fold') {
    if (manhattan(o.x, o.y, a.x, a.y) !== 1 || !inside(a.x, a.y) || s.grid[idx(a.x, a.y)] !== 1) return { ok: false, reason: 'pick an adjacent wall' };
    return { ok: true };
  }
  if (spec.ability === 'fade') return o.fade > 0 ? { ok: false, reason: 'already faded' } : { ok: true };
  const g = s.guards.find((q) => q.x === a.x && q.y === a.y);
  if (!g) return { ok: false, reason: 'pick a guard' };
  if (manhattan(o.x, o.y, g.x, g.y) > HAZE_RANGE) return { ok: false, reason: 'too far' };
  return { ok: true };
}

/** Apply an action. Returns a new state (the input is not changed). Throws on an illegal action. */
export function apply(prev: LayerState, a: Action): LayerState {
  const c = canApply(prev, a);
  if (!c.ok) throw new Error(c.reason);
  const s = cloneState(prev);
  s.lastCaught = [];

  if (a.t === 'kick') {
    s.kicks += 1;
    s.ap += KICK_AP;
    s.def.start.forEach(([x, y], i) => {
      const o = s.ops[i];
      if (o?.out && !occupied(s, x, y)) Object.assign(o, { x, y, out: false, fade: 0 });
    });
    // If every start tile was blocked, wake whoever is out next to the vault-side free tile.
    s.status = s.ops.some((o) => !o.out) ? 'play' : 'limbo';
    return s;
  }

  if (a.t === 'w') {
    s.ap -= 1;
  } else if (a.t === 'm') {
    const o = s.ops[a.o];
    if (!o) throw new Error('no op');
    const [dx, dy] = DIRS[a.d];
    o.x += dx;
    o.y += dy;
    s.ap -= 1;
    if (o.x === s.def.vault[0] && o.y === s.def.vault[1]) {
      s.status = 'cleared';
      return s;
    }
  } else {
    const spec = SQUAD[a.o];
    s.ap -= spec.cost;
    if (spec.ability === 'fold') s.grid[idx(a.x, a.y)] = 0;
    else if (spec.ability === 'fade') {
      const o = s.ops[a.o];
      if (o) o.fade = 2;
    } else {
      const g = s.guards.find((q) => q.x === a.x && q.y === a.y);
      if (g) g.stunned = 2;
    }
  }

  guardPhase(s);
  s.lastCaught = detect(s);
  for (const o of s.ops) if (o.fade > 0) o.fade -= 1;
  if (s.ops.every((o) => o.out) || s.ap <= 0) s.status = 'limbo';
  return s;
}

// ------------------------------------------------------------------ scoring & replay

export type LayerResult = { tier: Tier; cleared: boolean; ap: number; kicks: number; moves: number };

export function layerScore(r: LayerResult): number {
  if (!r.cleared) return 0;
  return 200 + r.ap * 100 + (r.kicks === 0 ? 50 : 0);
}

export function totalScore(rs: LayerResult[]): number {
  return rs.reduce((n, r) => n + layerScore(r), 0);
}

export type ReplayResult = { ok: true; results: LayerResult[]; kicks: number; final: LayerState | null } | { ok: false; reason: string };

/** Re-run a whole recorded heist against the night's maps. The server trusts only this. */
export function replay(heist: HeistDef, rec: RunRecord): ReplayResult {
  if (rec.v !== 1 || !Array.isArray(rec.layers) || rec.layers.length > heist.layers.length) return { ok: false, reason: 'bad record' };
  const results: LayerResult[] = [];
  let kicks = 0;
  let final: LayerState | null = null;
  for (let i = 0; i < rec.layers.length; i++) {
    const def = heist.layers[i];
    const acts = rec.layers[i];
    if (!def || !Array.isArray(acts) || acts.length > 400) return { ok: false, reason: 'bad layer' };
    let s = newLayerState(def);
    let moves = 0;
    for (const a of acts) {
      if (!isAction(a)) return { ok: false, reason: 'bad action' };
      const c = canApply(s, a);
      if (!c.ok) return { ok: false, reason: `layer ${i + 1}: ${c.reason}` };
      s = apply(s, a);
      if (a.t !== 'kick') moves += 1;
    }
    kicks += s.kicks;
    results.push({ tier: def.tier, cleared: s.status === 'cleared', ap: s.ap, kicks: s.kicks, moves });
    final = s;
    if (s.status !== 'cleared' && i < rec.layers.length - 1) return { ok: false, reason: 'layer not cleared' };
  }
  return { ok: true, results, kicks, final };
}

export function isAction(v: unknown): v is Action {
  if (typeof v !== 'object' || v === null) return false;
  const a = v as Record<string, unknown>;
  const op = (n: unknown) => n === 0 || n === 1 || n === 2;
  if (a.t === 'w' || a.t === 'kick') return true;
  if (a.t === 'm') return op(a.o) && (a.d === 'u' || a.d === 'd' || a.d === 'l' || a.d === 'r');
  if (a.t === 'a') return op(a.o) && Number.isInteger(a.x) && Number.isInteger(a.y);
  return false;
}

export function isRecord(v: unknown): v is RunRecord {
  if (typeof v !== 'object' || v === null) return false;
  const r = v as Record<string, unknown>;
  return r.v === 1 && Array.isArray(r.layers) && r.layers.every((l) => Array.isArray(l));
}

// ------------------------------------------------------------------ seeded generator

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TIER_SPEC: Record<Tier, { walls: number; statics: number; patrols: number; watchers: number; slack: number; range: number; fog: boolean }> = {
  easy: { walls: 0.16, statics: 2, patrols: 0, watchers: 0, slack: 6, range: 2, fog: false },
  hard: { walls: 0.2, statics: 0, patrols: 4, watchers: 0, slack: 4, range: 2, fog: false },
  difficult: { walls: 0.24, statics: 0, patrols: 3, watchers: 2, slack: 3, range: 3, fog: true },
};

const START: Pos[] = [
  [0, 9],
  [1, 9],
  [0, 8],
];

/**
 * Cheapest undetected route for ONE operative (others wait at the start, no abilities), or null.
 * Guards' positions only depend on time here, so (x, y, t) is the full state.
 */
export function solveCost(def: LayerDef, maxAp = 60): number | null {
  for (let o = 0; o < 3; o++) {
    // BFS over time: frontier of states at time t.
    let base = newLayerState({ ...def, ap: maxAp });
    let frontier = new Map<number, LayerState>([[idx(base.ops[o]!.x, base.ops[o]!.y), base]]);
    for (let t = 0; t < maxAp; t++) {
      const next = new Map<number, LayerState>();
      for (const s of frontier.values()) {
        const acts: Action[] = [{ t: 'w' }, ...(['u', 'd', 'l', 'r'] as Dir[]).map((d): Action => ({ t: 'm', o: o as OpId, d }))];
        for (const a of acts) {
          if (!canApply(s, a).ok) continue;
          const n = apply(s, a);
          if (n.status === 'cleared') return t + 1;
          if (n.lastCaught.length || n.status !== 'play') continue;
          const op = n.ops[o]!;
          const key = idx(op.x, op.y);
          if (!next.has(key)) next.set(key, n);
        }
      }
      if (!next.size) break;
      frontier = next;
      base = frontier.values().next().value ?? base;
    }
  }
  return null;
}

function reachable(grid: Tile[], from: Pos, to: Pos): boolean {
  const seen = new Set<number>([idx(from[0], from[1])]);
  const q: Pos[] = [from];
  while (q.length) {
    const [x, y] = q.shift()!;
    if (x === to[0] && y === to[1]) return true;
    for (const [dx, dy] of Object.values(DIRS)) {
      const nx = x + dx;
      const ny = y + dy;
      if (wallAt(grid, nx, ny) || seen.has(idx(nx, ny))) continue;
      seen.add(idx(nx, ny));
      q.push([nx, ny]);
    }
  }
  return false;
}

function buildLayer(seed: number, tier: Tier): LayerDef {
  const spec = TIER_SPEC[tier];
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)] as T;
  for (let attempt = 0; attempt < 400; attempt++) {
    const grid: Tile[] = new Array<Tile>(SIZE * SIZE).fill(0);
    // Wall segments read better than noise: short straight runs.
    let walls = 0;
    const target = Math.round(SIZE * SIZE * spec.walls);
    while (walls < target) {
      const x = Math.floor(r() * SIZE);
      const y = Math.floor(r() * SIZE);
      const [dx, dy] = DIRS[pick(CLOCKWISE)];
      const len = 1 + Math.floor(r() * 3);
      for (let i = 0; i < len; i++) {
        const wx = x + dx * i;
        const wy = y + dy * i;
        if (inside(wx, wy) && grid[idx(wx, wy)] === 0) {
          grid[idx(wx, wy)] = 1;
          walls++;
        }
      }
    }
    const vault: Pos = [6 + Math.floor(r() * 4), Math.floor(r() * 3)];
    // Keep the start pocket and the vault clear.
    for (const [x, y] of [...START, [1, 8] as Pos, [2, 9] as Pos, [0, 7] as Pos]) grid[idx(x, y)] = 0;
    grid[idx(vault[0], vault[1])] = 2;
    if (!reachable(grid, START[0]!, vault)) continue;

    const guards: GuardDef[] = [];
    const taken = new Set<number>([idx(vault[0], vault[1])]);
    const farFromStart = (x: number, y: number) => START.every(([sx, sy]) => manhattan(x, y, sx, sy) >= 5);
    const floor = (x: number, y: number) => inside(x, y) && grid[idx(x, y)] === 0 && !taken.has(idx(x, y));
    let id = 0;
    const kinds: GuardKind[] = [
      ...Array<GuardKind>(spec.statics).fill('static'),
      ...Array<GuardKind>(spec.patrols).fill('patrol'),
      ...Array<GuardKind>(spec.watchers).fill('watcher'),
    ];
    let failed = false;
    for (const kind of kinds) {
      let placed = false;
      for (let k = 0; k < 60 && !placed; k++) {
        const x = Math.floor(r() * SIZE);
        const y = Math.floor(r() * SIZE);
        if (!floor(x, y) || !farFromStart(x, y) || manhattan(x, y, vault[0], vault[1]) < 2) continue;
        const facing = pick(CLOCKWISE);
        const route: Pos[] = [[x, y]];
        if (kind === 'patrol') {
          const [dx, dy] = DIRS[facing];
          const len = 2 + Math.floor(r() * 3);
          for (let i = 1; i <= len; i++) {
            const px = x + dx * i;
            const py = y + dy * i;
            if (!floor(px, py) || !farFromStart(px, py)) break;
            route.push([px, py]);
          }
          if (route.length < 3) continue;
        }
        route.forEach(([px, py]) => taken.add(idx(px, py)));
        guards.push({ id: id++, kind, route, facing });
        placed = true;
      }
      if (!placed) failed = true;
    }
    if (failed) continue;

    const draft: LayerDef = { tier, grid, start: START, vault, guards, ap: 99, par: 0, range: spec.range, fog: spec.fog };
    const cost = solveCost(draft);
    // Too short is boring, too long is a slog.
    if (cost === null || cost < 12 || cost > 26) continue;
    return { ...draft, ap: cost + spec.slack, par: cost };
  }
  throw new Error(`could not build a ${tier} layer for seed ${seed}`);
}

function hash(n: number, salt: number): number {
  let h = (n * 2654435761) ^ (salt * 40503);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b);
  return (h ^ (h >>> 16)) >>> 0;
}

const cache = new Map<number, HeistDef>();

/** Tonight's three layers. Same for every player, built from the night number. */
export function buildHeist(night: number): HeistDef {
  const hit = cache.get(night);
  if (hit) return hit;
  const heist: HeistDef = { night, layers: TIERS.map((tier, i) => buildLayer(hash(night, i + 1), tier)) };
  cache.set(night, heist);
  return heist;
}
