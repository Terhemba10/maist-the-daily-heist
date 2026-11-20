import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIGHT_1 } from '../dreams/night1.ts';
import { DIRS, add, cellAt, keyOf, mirrorRows, parseBoard, same } from './board.ts';
import {
  CAUGHT_PENALTY_MS,
  createLayer,
  doorOpen,
  echoPositions,
  move,
  passable,
  tick,
  useAbility,
  type LayerState,
} from './layer.ts';
import { isLucid, moonsFor, playStyle, scoreRun, shareLine } from './score.ts';
import type { Dir, LayerDef, Vec } from './types.ts';

function layer(i: number): LayerDef {
  const def = NIGHT_1.layers[i];
  if (!def) throw new Error(`no layer ${i}`);
  return def;
}

/** Breadth-first search over tiles, treating every door (and optionally hidden doors) as open. */
function shortest(rows: readonly string[], from: Vec, to: Vec, openHidden: boolean): number {
  const b = parseBoard(rows);
  const seen = new Set([keyOf(from)]);
  let frontier: Vec[] = [from];
  for (let d = 0; frontier.length; d++) {
    const next: Vec[] = [];
    for (const p of frontier) {
      if (same(p, to)) return d;
      for (const dir of Object.values(DIRS)) {
        const q = add(p, dir);
        const c = cellAt(b, q);
        if (c === 'wall' || (c === 'hidden' && !openHidden) || seen.has(keyOf(q))) continue;
        seen.add(keyOf(q));
        next.push(q);
      }
    }
    frontier = next;
  }
  return -1;
}

function play(s: LayerState, dirs: Dir[], stepMs = 0): string[] {
  return dirs.map((d) => {
    if (stepMs) tick(s, stepMs);
    return move(s, d);
  });
}

void test('every Night 1 layer is solvable at par', () => {
  const b1 = parseBoard(layer(0).rows);
  assert.equal(shortest(layer(0).rows, b1.start, b1.drop!, false), layer(0).par);
  const b2 = parseBoard(layer(1).rows);
  assert.equal(shortest(layer(1).rows, b2.start, b2.drop!, false), layer(1).par);
  const b3 = parseBoard(layer(2).rows);
  const toKey = shortest(layer(2).rows, b3.start, b3.key!, false);
  const toVault = shortest(layer(2).rows, b3.key!, b3.vault!, true);
  assert.equal(toKey + toVault, layer(2).par);
});

void test('mirrorRows mirrors left to right', () => {
  assert.deepEqual(mirrorRows(['S.#', '..F']), ['#.S', 'F..']);
});

void test('tide doors alternate and block when closed', () => {
  const s = createLayer(layer(0), 'still');
  assert.equal(doorOpen(s, 'doorA', 0), true);
  assert.equal(doorOpen(s, 'doorB', 0), false);
  assert.equal(doorOpen(s, 'doorA', 4_000), false);
  assert.equal(doorOpen(s, 'doorB', 4_000), true);
  // Walk to (2,1), next to door A at (3,1), then wait for the tide to close it.
  play(s, ['right', 'right', 'down']);
  tick(s, 4_100);
  assert.equal(passable(s, { x: 3, y: 1 }), false);
  assert.equal(move(s, 'right'), 'blocked');
  tick(s, 4_000);
  assert.equal(move(s, 'right'), 'moved');
});

void test('layer 1 is cleared by the drop', () => {
  const s = createLayer(layer(0), 'still');
  const events = play(s, ['right', 'right', 'down', 'right', 'right', 'up', 'right', 'right']);
  assert.equal(events.at(-1), 'drop');
  assert.equal(s.status, 'cleared');
  assert.equal(s.moves, 8);
});

void test('mirror layer swaps left and right controls', () => {
  const s = createLayer(layer(1), 'still');
  assert.deepEqual(s.pos, { x: 6, y: 0 });
  // Pressing "right" walks screen-left on the mirrored page.
  assert.equal(move(s, 'right'), 'moved');
  assert.deepEqual(s.pos, { x: 5, y: 0 });
});

void test('vault is locked until the memory key is held', () => {
  const s = createLayer(layer(2), 'blink');
  s.pos = { x: 6, y: 1 };
  assert.equal(move(s, 'up'), 'vault-locked');
  s.hasKey = true;
  assert.equal(move(s, 'up'), 'vault');
  assert.equal(s.status, 'cleared');
});

void test('echo replays your steps after its delay and catches you if you stand still', () => {
  const s = createLayer(layer(2), 'still');
  assert.deepEqual(echoPositions(s), [null]);
  play(s, ['right', 'right'], 500);
  tick(s, 3_100); // echo clock 4 100: the echo has formed at the start
  assert.deepEqual(echoPositions(s)[0], { x: 0, y: 0 });
  const before = s.elapsedMs;
  // Stand still long enough for the echo to walk onto us.
  const ev = tick(s, 2_000);
  assert.equal(ev, 'caught');
  assert.equal(s.caught, 1);
  assert.ok(s.elapsedMs >= before + 2_000 + CAUGHT_PENALTY_MS - 1);
});

void test('Still freezes echoes and makes them harmless', () => {
  const s = createLayer(layer(2), 'still');
  play(s, ['right', 'right'], 500);
  tick(s, 3_100);
  assert.equal(useAbility(s), 'used');
  const clock = s.echoClockMs;
  assert.equal(tick(s, 1_900), 'none');
  assert.equal(s.echoClockMs, clock);
  assert.equal(useAbility(s), 'no-charge');
});

void test('Blink passes through one wall', () => {
  const s = createLayer(layer(2), 'blink');
  s.pos = { x: 6, y: 5 };
  assert.equal(move(s, 'up'), 'blocked');
  useAbility(s);
  assert.equal(move(s, 'up'), 'blink');
  assert.deepEqual(s.pos, { x: 6, y: 3 });
  assert.equal(s.blinkArmed, false);
});

void test('Lantern reveals hidden doors and they stay open', () => {
  const s = createLayer(layer(2), 'lantern');
  const h = { x: 5, y: 4 };
  assert.equal(passable(s, h), false);
  useAbility(s);
  assert.equal(passable(s, h), true);
  tick(s, 5_000);
  assert.equal(passable(s, h), true);
});

void test('the Pull wakes you when it runs out', () => {
  const s = createLayer(layer(0), 'still');
  assert.equal(tick(s, 80_000), 'woke');
  assert.equal(s.status, 'woke');
  assert.equal(move(s, 'right'), 'ignored');
});

void test('moons, lucid, score and share line', () => {
  const perfect = { cleared: true, timeLeftMs: 50_000, pullMs: 80_000, moves: 8, par: 8, caught: 0 };
  const slow = { cleared: true, timeLeftMs: 10_000, pullMs: 70_000, moves: 20, par: 8, caught: 0 };
  assert.equal(moonsFor(perfect), 3);
  assert.equal(moonsFor(slow), 1);
  assert.equal(moonsFor({ ...slow, cleared: false }), 0);
  assert.equal(isLucid([perfect, perfect, perfect], 3), true);
  assert.equal(isLucid([perfect, slow, perfect], 3), false);
  assert.equal(scoreRun([perfect], 3), 1000 + 500);
  assert.equal(playStyle([perfect, perfect, perfect], 3), 'perfect');
  assert.equal(playStyle([slow], 3), 'slow');
  assert.equal(shareLine(1, [perfect, slow]), 'Night 1 · 2 layers · 60 s left · 🌙🌙🌙 🌙');
});
