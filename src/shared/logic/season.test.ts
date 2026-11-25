import { test } from 'node:test';
import assert from 'node:assert/strict';
import { archiveStatus, countsForRanking, currentNight, msUntilNextDream, nightFor, nightNumber } from './season.ts';

const START = '2026-12-01';
const at = (iso: string) => new Date(iso);

void test('night numbers follow the UTC day', () => {
  assert.equal(nightFor(at('2026-12-01T00:00:00Z'), START), 1);
  assert.equal(nightFor(at('2026-12-01T23:59:59Z'), START), 1);
  assert.equal(nightFor(at('2026-12-02T00:00:00Z'), START), 2);
  assert.equal(nightFor(at('2026-11-30T12:00:00Z'), START), 0);
});

void test('current night is clamped to the season', () => {
  assert.equal(currentNight(at('2026-11-01T12:00:00Z'), START), 1);
  assert.equal(currentNight(at('2027-02-01T12:00:00Z'), START), 30);
});

void test('archive: past nights replayable, tonight ranked, future locked', () => {
  const now = at('2026-12-05T10:00:00Z'); // night 5
  assert.equal(archiveStatus(5, now, START), 'tonight');
  assert.equal(archiveStatus(1, now, START), 'archive');
  assert.equal(archiveStatus(4, now, START), 'archive');
  assert.equal(archiveStatus(6, now, START), 'locked');
  assert.equal(countsForRanking(5, now, START), true);
  assert.equal(countsForRanking(2, now, START), false);
});

void test('countdown to the next dream', () => {
  assert.equal(msUntilNextDream(at('2026-12-05T23:00:00Z')), 3_600_000);
});

void test('the Daily Heist night number never stops at 30', () => {
  assert.equal(nightNumber(at('2026-12-01T00:00:00Z'), START), 1);
  assert.equal(nightNumber(at('2026-12-30T12:00:00Z'), START), 30);
  assert.equal(nightNumber(at('2026-12-31T12:00:00Z'), START), 31);
  assert.equal(nightNumber(at('2027-12-01T00:00:00Z'), START), 366);
  // Before the start date it is Night 1, never 0 or negative.
  assert.equal(nightNumber(at('2026-11-15T12:00:00Z'), START), 1);
});
