import assert from 'node:assert/strict';
import { test } from 'node:test';
import { apply, buildHeist, canApply, newLayerState, replay, solveCost, totalScore, type Action, type LayerDef } from './engine.ts';

void test('every night 1-40 builds three solvable layers within their AP', () => {
  for (let n = 1; n <= 40; n++) {
    const h = buildHeist(n);
    assert.equal(h.layers.length, 3);
    for (const l of h.layers) {
      const cost = solveCost(l, l.ap);
      assert.ok(cost !== null && cost <= l.ap, `night ${n} ${l.tier} unsolvable`);
    }
  }
});

void test('maps are deterministic per night and differ between nights', () => {
  assert.deepEqual(buildHeist(5), buildHeist(5));
  assert.notDeepEqual(buildHeist(5).layers[0]?.grid, buildHeist(6).layers[0]?.grid);
});

void test('tiers escalate: easy has statics, difficult has fog and watchers', () => {
  const h = buildHeist(3);
  assert.ok(h.layers[0]?.guards.every((g) => g.kind === 'static'));
  assert.equal(h.layers[1]?.guards.length, 4);
  assert.ok(h.layers[2]?.fog);
  assert.equal(h.layers[2]?.guards.filter((g) => g.kind === 'watcher').length, 2);
});

const tiny = (): LayerDef => {
  const grid = new Array<0 | 1 | 2>(100).fill(0);
  grid[0 * 10 + 3] = 2; // vault at (3,0)
  grid[8 * 10 + 1] = 1; // a wall at (1,8)
  return {
    tier: 'easy',
    grid,
    start: [
      [0, 9],
      [1, 9],
      [0, 8],
    ],
    vault: [3, 0],
    guards: [{ id: 0, kind: 'static', route: [[9, 9]], facing: 'l' }],
    ap: 20,
    par: 12,
    range: 2,
    fog: false,
  };
};

void test('fold opens an adjacent wall for 2 AP', () => {
  // shaper at (2,8) stands next to the wall at (1,8); the ghost at (1,9) is under it
  let s = newLayerState({ ...tiny(), start: [[2, 8], [1, 9], [2, 9]] });
  assert.equal(canApply(s, { t: 'm', o: 1, d: 'u' }).ok, false);
  s = apply(s, { t: 'a', o: 0, x: 1, y: 8 });
  assert.equal(s.grid[8 * 10 + 1], 0);
  assert.equal(s.ap, 18);
  assert.equal(canApply(s, { t: 'm', o: 1, d: 'u' }).ok, true);
});

void test('fold needs an adjacent wall; haze needs a guard in range', () => {
  const s = newLayerState(tiny());
  assert.equal(canApply(s, { t: 'a', o: 0, x: 1, y: 8 }).ok, false);
  assert.equal(canApply(s, { t: 'a', o: 1, x: 0, y: 0 }).ok, true); // fade
  assert.equal(canApply(s, { t: 'a', o: 2, x: 9, y: 9 }).ok, false); // guard too far
});

void test('a static guard catches an operative that walks into its sight', () => {
  const def = tiny();
  def.guards = [{ id: 0, kind: 'static', route: [[4, 9]], facing: 'l' }];
  let s = newLayerState(def);
  s = apply(s, { t: 'm', o: 1, d: 'r' }); // (2,9) is in sight (4,9)->(3,9),(2,9)
  assert.deepEqual(s.lastCaught, [1]);
  assert.equal(s.ops[1]?.out, true);
});

void test('fade lets the ghost walk through sight', () => {
  const def = tiny();
  def.guards = [{ id: 0, kind: 'static', route: [[4, 9]], facing: 'l' }];
  let s = newLayerState(def);
  // ghost is op 1 at (1,9)
  s = apply(s, { t: 'a', o: 1, x: 0, y: 0 });
  s = apply(s, { t: 'm', o: 1, d: 'r' });
  assert.deepEqual(s.lastCaught, []);
});

void test('replay scores a cleared layer and rejects illegal records', () => {
  const def = tiny();
  const heist = { night: 0, layers: [def, def, def] };
  const path: Action[] = [
    { t: 'm', o: 2, d: 'u' }, // (0,7)
    ...Array.from({ length: 7 }, (): Action => ({ t: 'm', o: 2, d: 'u' })), // to (0,0)
    { t: 'm', o: 2, d: 'r' },
    { t: 'm', o: 2, d: 'r' },
    { t: 'm', o: 2, d: 'r' }, // vault (3,0)
  ];
  const r = replay(heist, { v: 1, layers: [path] });
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.results[0]?.cleared, true);
    assert.equal(r.results[0]?.ap, 20 - 11);
    assert.equal(totalScore(r.results), 200 + 900 + 50);
  }
  const bad = replay(heist, { v: 1, layers: [[{ t: 'm', o: 1, d: 'u' }]] });
  assert.equal(bad.ok, false);
});

void test('limbo then kick restores AP and operatives', () => {
  const def = { ...tiny(), ap: 2 };
  let s = newLayerState(def);
  s = apply(s, { t: 'w' });
  s = apply(s, { t: 'w' });
  assert.equal(s.status, 'limbo');
  s = apply(s, { t: 'kick' });
  assert.equal(s.status, 'play');
  assert.equal(s.ap, 6);
  assert.equal(s.kicks, 1);
});

void test('nights past 30 keep coming: fresh, solvable, deterministic maps', () => {
  for (const n of [31, 32, 100, 365, 1000]) {
    const h = buildHeist(n);
    assert.equal(h.night, n);
    assert.equal(h.layers.length, 3);
    for (const l of h.layers) {
      const cost = solveCost(l, l.ap);
      assert.ok(cost !== null && cost <= l.ap, `night ${n} ${l.tier} unsolvable`);
    }
    assert.deepEqual(buildHeist(n), h);
  }
  assert.notDeepEqual(buildHeist(31).layers[0]?.grid, buildHeist(30).layers[0]?.grid);
});
