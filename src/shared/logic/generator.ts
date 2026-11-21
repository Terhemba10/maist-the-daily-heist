import { NIGHT_1 } from '../dreams/night1.ts';
import { isDeepDream, nightInfo } from '../dreams/season1.ts';
import { DIRS, add, keyOf, mirrorRows, parseBoard, same } from './board.ts';
import type { DreamDef, LayerDef, TwistId, Vec } from './types.ts';

/** What the server stores per night; everything else is derived from it. */
export type DreamSpec = { night: number; /** Tomorrow-twist vote winner, used on layer 2. */ voted?: TwistId };

export const LAYER1_TWISTS: readonly TwistId[] = ['tide-doors', 'loop', 'gravity-flip'];
export const VOTE_TWISTS: readonly TwistId[] = ['mirror', 'gravity-flip', 'loop', 'tide-doors'];

export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Grid = string[][];
const W = 7;
const H = 7;

const cellOf = (g: Grid, p: Vec) => g[p.y]?.[p.x] ?? '#';
const set = (g: Grid, p: Vec, c: string) => {
  const row = g[p.y];
  if (row) row[p.x] = c;
};
const inside = (p: Vec) => p.x >= 0 && p.y >= 0 && p.x < W && p.y < H;

/** Breadth-first distances; walls block; `open` lists extra passable cells (e.g. hidden doors). */
export function distances(rows: readonly string[], from: Vec, opts: { openHidden?: boolean; wrap?: boolean } = {}): Map<string, number> {
  const h = rows.length;
  const w = rows[0]?.length ?? 0;
  const at = (q: Vec) => rows[q.y]?.[q.x] ?? '#';
  const dist = new Map<string, number>([[keyOf(from), 0]]);
  let frontier: Vec[] = [from];
  for (let d = 1; frontier.length; d++) {
    const next: Vec[] = [];
    for (const p of frontier) {
      for (const dir of Object.values(DIRS)) {
        let q = add(p, dir);
        if (opts.wrap) q = { x: (q.x + w) % w, y: (q.y + h) % h };
        if (q.x < 0 || q.y < 0 || q.x >= w || q.y >= h) continue;
        const c = at(q);
        if (c === '#' || (c === 'H' && !opts.openHidden) || dist.has(keyOf(q))) continue;
        dist.set(keyOf(q), d);
        next.push(q);
      }
    }
    frontier = next;
  }
  return dist;
}

/** A 7×7 maze of rooms (even cells) and corridors, with a few extra openings for loops. */
function makePlan(r: () => number): Grid {
  const g: Grid = Array.from({ length: H }, () => Array.from({ length: W }, () => '#'));
  const rooms: Vec[] = [];
  for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) rooms.push({ x, y });
  const seen = new Set<string>();
  const stack: Vec[] = [{ x: 0, y: 0 }];
  set(g, { x: 0, y: 0 }, '.');
  seen.add('0,0');
  while (stack.length) {
    const cur = stack[stack.length - 1];
    if (!cur) break;
    const options = Object.values(DIRS)
      .map((d) => ({ d, n: { x: cur.x + d.x * 2, y: cur.y + d.y * 2 } }))
      .filter(({ n }) => inside(n) && !seen.has(keyOf(n)));
    if (!options.length) {
      stack.pop();
      continue;
    }
    const pick = options[Math.floor(r() * options.length)];
    if (!pick) break;
    set(g, { x: cur.x + pick.d.x, y: cur.y + pick.d.y }, '.');
    set(g, pick.n, '.');
    seen.add(keyOf(pick.n));
    stack.push(pick.n);
  }
  // Open 3 extra corridors so there is more than one way round.
  const walls: Vec[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2 === 1 && cellOf(g, { x, y }) === '#') walls.push({ x, y });
  for (let i = 0; i < 3 && walls.length; i++) {
    const w = walls.splice(Math.floor(r() * walls.length), 1)[0];
    if (w) set(g, w, '.');
  }
  return g;
}

const rowsOf = (g: Grid) => g.map((r) => r.join(''));

type Plan = { g: Grid; s: Vec; f: Vec; key: Vec; note: Vec | null };

function planDream(night: number): Plan {
  const r = rng(night * 7919 + 17);
  const g = makePlan(r);
  const s = { x: 0, y: 0 };
  const d0 = distances(rowsOf(g), s);
  const corners = [
    { x: 6, y: 0 },
    { x: 6, y: 6 },
    { x: 0, y: 6 },
  ];
  const f = corners.reduce((best, c) => ((d0.get(keyOf(c)) ?? 0) > (d0.get(keyOf(best)) ?? 0) ? c : best), corners[0] ?? { x: 6, y: 0 });

  // Tide doors: one on the main path, one elsewhere.
  const path = shortestPath(g, s, f);
  const corridors = path.filter((p) => (p.x + p.y) % 2 === 1);
  const doorA = corridors[Math.floor(corridors.length / 2)];
  if (doorA) set(g, doorA, 'D');
  const others: Vec[] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x + y) % 2 === 1 && cellOf(g, { x, y }) === '.' && !path.some((p) => same(p, { x, y }))) others.push({ x, y });
  const doorB = others[Math.floor(r() * others.length)];
  if (doorB) set(g, doorB, 'd');

  // Memory key: the floor cell farthest from both the start and the vault.
  const ds = distances(rowsOf(g), s);
  const df = distances(rowsOf(g), f);
  let key = { x: 6, y: 6 };
  let best = -1;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = { x, y };
      if (cellOf(g, p) !== '.' || same(p, s) || same(p, f)) continue;
      const score = Math.min(ds.get(keyOf(p)) ?? 0, df.get(keyOf(p)) ?? 0) * 10 + (ds.get(keyOf(p)) ?? 0);
      if (score > best) {
        best = score;
        key = p;
      }
    }

  // Hidden door: the wall whose opening most shortens key → vault.
  let hidden: Vec | null = null;
  let gain = 1;
  const base = df.get(keyOf(key)) ?? 0;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const p = { x, y };
      if ((x + y) % 2 !== 1 || cellOf(g, p) !== '#') continue;
      set(g, p, '.');
      const d = distances(rowsOf(g), f).get(keyOf(key)) ?? base;
      set(g, p, '#');
      if (base - d > gain) {
        gain = base - d;
        hidden = p;
      }
    }
  if (hidden) set(g, hidden, 'H');

  // Moth note in a dead end, if there is one.
  let note: Vec | null = null;
  for (let y = 0; y < H && !note; y++)
    for (let x = 0; x < W && !note; x++) {
      const p = { x, y };
      if (cellOf(g, p) !== '.' || same(p, s) || same(p, f) || same(p, key)) continue;
      const n = Object.values(DIRS).filter((d) => cellOf(g, add(p, d)) !== '#' && inside(add(p, d))).length;
      if (n === 1) note = p;
    }
  return { g, s, f, key, note };
}

function shortestPath(g: Grid, from: Vec, to: Vec): Vec[] {
  const prev = new Map<string, Vec>();
  const seen = new Set([keyOf(from)]);
  let frontier = [from];
  while (frontier.length && !seen.has(keyOf(to))) {
    const next: Vec[] = [];
    for (const p of frontier)
      for (const d of Object.values(DIRS)) {
        const q = add(p, d);
        if (!inside(q) || cellOf(g, q) === '#' || seen.has(keyOf(q))) continue;
        seen.add(keyOf(q));
        prev.set(keyOf(q), p);
        next.push(q);
      }
    frontier = next;
  }
  const out: Vec[] = [];
  let cur: Vec | undefined = to;
  while (cur && !same(cur, from)) {
    out.unshift(cur);
    cur = prev.get(keyOf(cur));
  }
  return out;
}

function render(plan: Plan, marks: { s: Vec; f?: Vec; v?: Vec; k?: Vec; note?: boolean }): string[] {
  const g = plan.g.map((r) => [...r]);
  set(g, marks.s, 'S');
  if (marks.f) set(g, marks.f, 'F');
  if (marks.v) set(g, marks.v, 'V');
  if (marks.k) set(g, marks.k, 'K');
  if (marks.note && plan.note) set(g, plan.note, 'N');
  return rowsOf(g);
}

const clampMs = (v: number) => Math.round(Math.max(60, Math.min(90, v))) * 1000;

function withTwist(rows: string[], twist: TwistId, base: Omit<LayerDef, 'rows' | 'twist'>): LayerDef {
  const layer: LayerDef = { ...base, rows, twist };
  if (twist === 'tide-doors') return { ...layer, tidePeriodMs: 4_000 };
  if (twist === 'mirror') return { ...layer, rows: mirrorRows(rows), mirrorControls: true };
  if (twist === 'gravity-flip') return { ...layer, flipControls: true };
  if (twist === 'loop') return { ...layer, wrap: true };
  return layer;
}

function parFor(l: LayerDef): number {
  const b = parseBoard(l.rows);
  const wrap = !!l.wrap;
  if (b.drop) return distances(l.rows, b.start, { wrap }).get(keyOf(b.drop)) ?? 20;
  if (b.key && b.vault) {
    const a = distances(l.rows, b.start, { wrap }).get(keyOf(b.key)) ?? 10;
    const c = distances(l.rows, b.key, { openHidden: true, wrap }).get(keyOf(b.vault)) ?? 10;
    return a + c;
  }
  return 20;
}

/** Build any night's dream. Night 1 is hand-written; the rest come from the night's seed plus its twists. */
export function buildDream(spec: DreamSpec): DreamDef {
  if (spec.night === 1 && !spec.voted) return NIGHT_1;
  const info = nightInfo(spec.night);
  const plan = planDream(spec.night);
  const r = rng(spec.night * 104729 + 3);
  const t1 = LAYER1_TWISTS[Math.floor(r() * LAYER1_TWISTS.length)] ?? 'tide-doors';
  const pool = VOTE_TWISTS.filter((t) => t !== t1);
  const t2 = spec.voted && spec.voted !== t1 ? spec.voted : (pool[Math.floor(r() * pool.length)] ?? 'mirror');
  const middle = isDeepDream(spec.night) ? [t2, VOTE_TWISTS.find((t) => t !== t1 && t !== t2) ?? 'loop', t1] : [t2];

  const layers: LayerDef[] = [];
  const first = withTwist(render(plan, { s: plan.s, f: plan.f }), t1, { pullMs: 0, par: 0 });
  layers.push(first);
  middle.forEach((twist, i) => {
    // Deeper layers: you land where you fell and must find your way back across.
    const flip = i % 2 === 0;
    const rows = render(plan, { s: flip ? plan.f : plan.s, f: flip ? plan.s : plan.f, note: i === 0 });
    layers.push(withTwist(rows, twist, { pullMs: 0, par: 0 }));
  });
  layers.push({ rows: render(plan, { s: plan.s, v: plan.f, k: plan.key }), twist: 'echoes', pullMs: 0, par: 0, echoDelaysMs: [4_000] });

  const sized = layers.map((l, i) => {
    const par = parFor(l);
    const last = i === layers.length - 1;
    const pullMs = last ? clampMs(32 + par * 2.4) : clampMs((44 + par * 4.2) * (1 - i * 0.06));
    return { ...l, par, pullMs };
  });
  return { id: `night-${spec.night}`, night: spec.night, dreamer: info.dreamer, favours: info.favours, layers: sized };
}

/** The three twists offered in tonight's vote for tomorrow's layer 2. */
export function voteOptions(tomorrow: number): TwistId[] {
  const r = rng(tomorrow * 31337 + 7);
  const pool = [...VOTE_TWISTS];
  const out: TwistId[] = [];
  while (out.length < 3 && pool.length) {
    const t = pool.splice(Math.floor(r() * pool.length), 1)[0];
    if (t) out.push(t);
  }
  return out;
}
