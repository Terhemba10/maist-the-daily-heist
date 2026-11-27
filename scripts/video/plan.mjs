// Scene planner for the demo video: finds a night whose maps allow every scripted beat, using the
// real rules engine (so everything shown is legal play), and returns the action lists.
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const E = await import(pathToFileURL(`${ROOT}/src/shared/heist/engine.ts`).href);
const DIRS = ['u', 'd', 'l', 'r'];
const man = (ax, ay, bx, by) => Math.abs(ax - bx) + Math.abs(ay - by);

/** Tiles the guards can see right now. */
export function seenSet(s) {
  const out = new Set();
  for (const g of s.guards) for (const [x, y] of E.guardVision(s, g, s.def.range)) out.add(E.idx(x, y));
  return out;
}

/** Shortest safe path (moves and waits by op `o`) from state `s` to a state where goal(state) holds. */
export function bfs(s, o, goal, maxSteps = 60) {
  if (goal(s)) return { path: [], s };
  let frontier = new Map([[E.idx(s.ops[o].x, s.ops[o].y) + (s.slipAt > 0 ? 100 : 0), { s, path: [] }]]);
  for (let t = 0; t < maxSteps; t++) {
    const next = new Map();
    for (const { s: cur, path: p } of frontier.values()) {
      for (const a of [{ t: 'w' }, ...DIRS.map((d) => ({ t: 'm', o, d }))]) {
        if (!E.canApply(cur, a).ok) continue;
        const n = E.apply(cur, a);
        if (n.lastCaught.length) continue;
        const np = [...p, a];
        if (goal(n)) return { path: np, s: n };
        if (n.status !== 'play') continue;
        const k = E.idx(n.ops[o].x, n.ops[o].y) + (n.slipAt > 0 ? 100 : 0);
        if (!next.has(k)) next.set(k, { s: n, path: np });
      }
    }
    if (!next.size) break;
    frontier = next;
  }
  return null;
}

const cleared = (n) => n.status === 'cleared';
function run(s, acts) {
  for (const a of acts) s = E.apply(s, a);
  return s;
}

/** Practice run, layer 1: Vale folds a wall, Wren fades through a robot's sight line, Oto hazes a robot. */
export function planAbilities(def) {
  let s = E.newLayerState(def);
  const acts = [];
  const beats = {};
  // Vale starts boxed in by her crew: Oto steps up out of the start pocket first (always floor).
  const prelude = { t: 'm', o: 2, d: 'u' };
  if (!E.canApply(s, prelude).ok) return null;
  s = E.apply(s, prelude);
  if (s.lastCaught.length) return null;
  acts.push(prelude);
  // Vale (0): reach a tile next to a wall, fold it
  const v = bfs(s, 0, (n) => n.status === 'play' && DIRS.some((d) => {
    const [dx, dy] = E.DIRS[d];
    const x = n.ops[0].x + dx;
    const y = n.ops[0].y + dy;
    return E.inside(x, y) && n.grid[E.idx(x, y)] === 1 && E.canApply(n, { t: 'a', o: 0, x, y }).ok;
  }), 10);
  if (!v) return null;
  acts.push(...v.path);
  s = v.s;
  const wall = DIRS.map((d) => [s.ops[0].x + E.DIRS[d][0], s.ops[0].y + E.DIRS[d][1]]).find(([x, y]) => E.inside(x, y) && s.grid[E.idx(x, y)] === 1);
  beats.fold = acts.length;
  acts.push({ t: 'a', o: 0, x: wall[0], y: wall[1] });
  s = E.apply(s, acts.at(-1));
  // Wren (1): stand next to a seen tile S that leads to an unseen tile U; fade, walk through S to U
  const free = (n, x, y) => E.inside(x, y) && n.grid[E.idx(x, y)] !== 1 && !n.ops.some((op) => !op.out && op.x === x && op.y === y) && !n.guards.some((g) => g.x === x && g.y === y);
  let pass = null;
  const w = bfs(s, 1, (n) => {
    if (n.status !== 'play') return false;
    const seen = seenSet(n);
    const o = n.ops[1];
    for (const d of DIRS) {
      const sx = o.x + E.DIRS[d][0];
      const sy = o.y + E.DIRS[d][1];
      if (!free(n, sx, sy) || !seen.has(E.idx(sx, sy))) continue;
      for (const d2 of DIRS) {
        const ux = sx + E.DIRS[d2][0];
        const uy = sy + E.DIRS[d2][1];
        if ((ux === o.x && uy === o.y) || !free(n, ux, uy) || seen.has(E.idx(ux, uy))) continue;
        pass = [d, d2];
        return true;
      }
    }
    return false;
  }, 12);
  if (!w) return null;
  acts.push(...w.path);
  s = w.s;
  beats.fade = acts.length;
  const fadeActs = [{ t: 'a', o: 1, x: 0, y: 0 }, { t: 'm', o: 1, d: pass[0] }, { t: 'm', o: 1, d: pass[1] }];
  for (const a of fadeActs) {
    if (!E.canApply(s, a).ok) return null;
    s = E.apply(s, a);
    if (s.lastCaught.length || s.status !== 'play') return null;
  }
  acts.push(...fadeActs);
  // Oto (2): get within haze range of a robot, haze it
  const near = (n) => n.guards.find((g) => g.stunned === 0 && man(n.ops[2].x, n.ops[2].y, g.x, g.y) <= E.HAZE_RANGE);
  const h = bfs(s, 2, (n) => n.status === 'play' && !!near(n) && n.ap >= 3, 12);
  if (!h) return null;
  acts.push(...h.path);
  s = h.s;
  const g = near(s);
  beats.haze = acts.length;
  acts.push({ t: 'a', o: 2, x: g.x, y: g.y });
  s = E.apply(s, acts.at(-1));
  if (s.status !== 'play') return null;
  return { acts, beats, apLeft: s.ap };
}

/** Layer 3: spend the slack, walk until the AP runs out (adrift), take one Pull (+6 AP), finish. */
export function planAdrift(def) {
  const base = E.newLayerState(def);
  for (let w = 1; w <= 12; w++) {
    let s = base;
    const waits = Array.from({ length: w }, () => ({ t: 'w' }));
    try {
      s = run(s, waits);
    } catch {
      continue;
    }
    if (s.status !== 'play') continue;
    const r = bfs({ ...s, ap: 99 }, 0, cleared, 60) ?? bfs({ ...s, ap: 99 }, 1, cleared, 60) ?? bfs({ ...s, ap: 99 }, 2, cleared, 60);
    if (!r || r.path.length <= s.ap) continue;
    // walk the route until adrift
    let cur = s;
    const walk = [];
    for (const a of r.path) {
      if (cur.status !== 'play') break;
      if (!E.canApply(cur, a).ok) break;
      cur = E.apply(cur, a);
      walk.push(a);
      if (cur.lastCaught.length) break;
    }
    if (cur.status !== 'limbo') continue;
    const kicked = E.apply(cur, { t: 'kick' });
    const fin = bfs(kicked, 0, cleared, kicked.ap) ?? bfs(kicked, 1, cleared, kicked.ap) ?? bfs(kicked, 2, cleared, kicked.ap);
    if (!fin) continue;
    return { before: [...waits, ...walk], after: fin.path, waits: w };
  }
  return null;
}

/** The whole night: abilities practice (layer 1), the scored run (layer 1 route, layer 2 slip, layer 3 adrift + Pull). */
export function planNight(night) {
  const h = E.buildHeist(night);
  const [l1, l2, l3] = h.layers;
  if (!l2.vault2) return null;
  const abilities = planAbilities(l1);
  if (!abilities) return null;
  const r1 = [0, 1, 2].map((o) => bfs(E.newLayerState(l1), o, cleared, l1.ap)).find(Boolean);
  const r2 = [0, 1, 2].map((o) => bfs(E.newLayerState(l2), o, cleared, l2.ap)).find(Boolean);
  const r3 = planAdrift(l3);
  if (!r1 || !r2 || !r3) return null;
  return { night, abilities, l1: r1.path, l2: r2.path, l3: r3, slipAt: slipIndex(l2, r2.path) };
}

function slipIndex(def, route) {
  let s = E.newLayerState(def);
  for (let i = 0; i < route.length; i++) {
    s = E.apply(s, route[i]);
    if (s.justSlipped) return i + 1;
  }
  return -1;
}

export function findNight(from = 2, to = 400, score = (p) => p.abilities.acts.length) {
  let best = null;
  for (let n = from; n <= to; n++) {
    const p = planNight(n);
    if (!p) continue;
    if (!best || score(p) < score(best)) best = p;
  }
  return best;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const t0 = Date.now();
  const p = findNight(2, Number(process.argv[2] ?? 120));
  console.log(JSON.stringify({ night: p?.night, abilities: p?.abilities.acts.length, beats: p?.abilities.beats, l1: p?.l1.length, l2: p?.l2.length, slipAt: p?.slipAt, l3: p && { before: p.l3.before.length, after: p.l3.after.length, waits: p.l3.waits } }), `${Date.now() - t0} ms`);
}
