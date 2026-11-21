import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NIGHT_1 } from '../dreams/night1.ts';
import { applyDifficulty, MOVE_SLACK } from './difficulty.ts';
import { moonsFor } from './score.ts';

void test('medium is the dream as written', () => {
  assert.equal(applyDifficulty(NIGHT_1, 'medium'), NIGHT_1);
});

void test('easy: longer Pull and one slower echo', () => {
  const d = applyDifficulty(NIGHT_1, 'easy');
  assert.equal(d.layers[0]?.pullMs, 104_000);
  assert.deepEqual(d.layers[2]?.echoDelaysMs, [6_000]);
  assert.equal(d.layers[1]?.tidePeriodMs, undefined);
});

void test('hard: shorter Pull, extra echo, extra twist on the mirror layer', () => {
  const d = applyDifficulty(NIGHT_1, 'hard');
  assert.equal(d.layers[0]?.pullMs, 64_000);
  assert.deepEqual(d.layers[2]?.echoDelaysMs, [3_000, 6_000]);
  assert.equal(d.layers[1]?.tidePeriodMs, 4_500);
  assert.equal(d.layers[1]?.mirrorControls, true);
  // The original dream is untouched.
  assert.equal(NIGHT_1.layers[1]?.tidePeriodMs, undefined);
});

void test('move slack changes the tidy-moves moon', () => {
  const r = { cleared: true, timeLeftMs: 50_000, pullMs: 80_000, moves: 11, par: 8, caught: 0 };
  assert.equal(moonsFor(r, MOVE_SLACK.easy), 3);
  assert.equal(moonsFor(r, MOVE_SLACK.medium), 2);
  assert.equal(moonsFor(r, MOVE_SLACK.hard), 2);
});
