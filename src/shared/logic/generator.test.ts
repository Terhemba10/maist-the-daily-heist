import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIGHT_1 } from '../dreams/night1.ts';
import { keyOf, parseBoard } from './board.ts';
import { applyDifficulty } from './difficulty.ts';
import { buildDream, distances, voteOptions } from './generator.ts';
import { codeOf, replay, STEP_MS, type RunRecord } from './replay.ts';
import type { Dir } from './types.ts';

void test('night 1 is the hand-written dream', () => {
  assert.equal(buildDream({ night: 1 }), NIGHT_1);
});

void test('every generated night 2..60 is solvable, deterministic and inside the Pull limits', () => {
  for (let n = 2; n <= 60; n++) {
    const d = buildDream({ night: n });
    assert.deepEqual(buildDream({ night: n }), d, `night ${n} deterministic`);
    assert.equal(d.layers.length, n % 7 === 0 ? 5 : 3, `night ${n} layer count`);
    d.layers.forEach((l, i) => {
      const b = parseBoard(l.rows);
      assert.ok(l.pullMs >= 60_000 && l.pullMs <= 90_000, `night ${n} L${i + 1} pull ${l.pullMs}`);
      assert.ok(l.par > 0, `night ${n} L${i + 1} par`);
      const wrap = !!l.wrap;
      if (b.drop) assert.ok(distances(l.rows, b.start, { wrap }).has(keyOf(b.drop)), `night ${n} L${i + 1} drop reachable`);
      else {
        assert.ok(b.key && b.vault, `night ${n} last layer has key and vault`);
        assert.ok(distances(l.rows, b.start, { wrap }).has(keyOf(b.key)), `night ${n} key reachable`);
        assert.ok(distances(l.rows, b.key, { wrap }).has(keyOf(b.vault)), `night ${n} vault reachable without Lantern`);
      }
    });
    assert.equal(d.layers.at(-1)?.twist, 'echoes');
  }
});

void test('the tomorrow-twist vote changes layer 2', () => {
  const opts = voteOptions(5);
  assert.equal(opts.length, 3);
  assert.equal(new Set(opts).size, 3);
  const voted = buildDream({ night: 5, voted: 'gravity-flip' });
  if (voted.layers[0]?.twist !== 'gravity-flip') assert.equal(voted.layers[1]?.twist, 'gravity-flip');
});

const STEPS: Dir[] = ['right', 'right', 'down', 'right', 'right', 'up', 'right', 'right'];

void test('replay scores a recorded Night 1 layer exactly', () => {
  // Eight quick moves, one per step, then fall; then sit on layer 2 until the Pull wakes us.
  const rec: RunRecord = { a: 'lantern', l: [{ i: STEPS.map((d, k) => [k * 3, codeOf(d)]) }, { i: [] }] };
  const r = replay(NIGHT_1, rec);
  assert.ok(r.ok);
  if (!r.ok) return;
  assert.equal(r.results.length, 2);
  assert.equal(r.results[0]?.cleared, true);
  assert.equal(r.results[0]?.moves, 8);
  assert.equal(r.results[0]?.timeLeftMs, 80_000 - 21 * STEP_MS);
  assert.equal(r.results[1]?.cleared, false);
  assert.equal(r.results[1]?.timeLeftMs, 0);
});

void test('replay rejects steps that go backwards and unknown codes', () => {
  assert.equal(replay(NIGHT_1, { a: 'still', l: [{ i: [[5, 0], [2, 0]] }] }).ok, false);
  assert.equal(replay(NIGHT_1, { a: 'still', l: [{ i: [[1, 9]] }] }).ok, false);
});

void test('hard difficulty still replays (shorter Pull)', () => {
  const rec: RunRecord = { a: 'lantern', l: [{ i: STEPS.map((d, k) => [k * 3, codeOf(d)]) }] };
  const r = replay(applyDifficulty(NIGHT_1, 'hard'), rec);
  assert.ok(r.ok && r.results[0]?.cleared);
});
