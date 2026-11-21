import { DIRS, add, cellAt, inBounds, keyOf, parseBoard, same, type Board } from './board.ts';
import type { AbilityId, Cell, Dir, LayerDef, Vec } from './types.ts';

export const STILL_MS = 2000;
export const LANTERN_MS = 3000;
export const CAUGHT_PENALTY_MS = 8000;
export const TIDE_WARN_MS = 600;

export type TrailStep = { x: number; y: number; t: number };

/**
 * Everything that happens on one layer. The rules are pure and frame-rate free:
 * the client calls `tick` with elapsed ms and `move` / `useAbility` on input.
 */
export type LayerState = {
  def: LayerDef;
  board: Board;
  pos: Vec;
  moves: number;
  /** Real time spent on this layer (includes caught penalties). */
  elapsedMs: number;
  /** Echo playback clock; it stops while Still is active. */
  echoClockMs: number;
  /** Where the player stood and when (echo-clock time). */
  trail: TrailStep[];
  ability: AbilityId;
  charges: number;
  blinkArmed: boolean;
  stillUntilMs: number;
  lanternUntilMs: number;
  revealed: string[];
  hasKey: boolean;
  noteRead: boolean;
  caught: number;
  status: 'playing' | 'cleared' | 'woke';
};

export type MoveEvent =
  | 'moved'
  | 'blocked'
  | 'blink'
  | 'drop'
  | 'vault'
  | 'vault-locked'
  | 'key'
  | 'note'
  | 'caught'
  | 'ignored';

export type AbilityEvent = 'used' | 'no-charge' | 'ignored';

export function createLayer(def: LayerDef, ability: AbilityId): LayerState {
  const board = parseBoard(def.rows);
  return {
    def,
    board,
    pos: { ...board.start },
    moves: 0,
    elapsedMs: 0,
    echoClockMs: 0,
    trail: [{ ...board.start, t: 0 }],
    ability,
    charges: 1,
    blinkArmed: false,
    stillUntilMs: 0,
    lanternUntilMs: 0,
    revealed: [],
    hasKey: false,
    noteRead: false,
    caught: 0,
    status: 'playing',
  };
}

/** Tide doors: group A is open in even phases, group B in odd phases. Without a tide both are open. */
export function doorOpen(s: LayerState, cell: Cell, atMs = s.elapsedMs): boolean {
  const period = s.def.tidePeriodMs;
  if (!period) return true;
  const phase = Math.floor(atMs / period) % 2;
  return cell === 'doorA' ? phase === 0 : phase === 1;
}

/** True during the short window before the tide doors swap (for the shimmer). */
export function tideAboutToTurn(s: LayerState): boolean {
  const period = s.def.tidePeriodMs;
  if (!period) return false;
  return period - (s.elapsedMs % period) <= TIDE_WARN_MS;
}

export function isRevealed(s: LayerState, p: Vec): boolean {
  return s.revealed.includes(keyOf(p));
}

export function lanternLit(s: LayerState): boolean {
  return s.elapsedMs < s.lanternUntilMs;
}

export function stillActive(s: LayerState): boolean {
  return s.elapsedMs < s.stillUntilMs;
}

export function passable(s: LayerState, p: Vec): boolean {
  if (!inBounds(s.board, p)) return false;
  const c = cellAt(s.board, p);
  switch (c) {
    case 'wall':
      return false;
    case 'hidden':
      return isRevealed(s, p);
    case 'doorA':
    case 'doorB':
      return doorOpen(s, c);
    default:
      return true;
  }
}

/** Mirror twist swaps left and right. */
export function resolveDir(s: LayerState, dir: Dir): Dir {
  if (s.def.mirrorControls && (dir === 'left' || dir === 'right')) return dir === 'left' ? 'right' : 'left';
  if (s.def.flipControls && (dir === 'up' || dir === 'down')) return dir === 'up' ? 'down' : 'up';
  return dir;
}

/** Loop twist: positions off the board wrap to the opposite edge. */
function wrapPos(s: LayerState, p: Vec): Vec {
  if (!s.def.wrap) return p;
  return { x: (p.x + s.board.w) % s.board.w, y: (p.y + s.board.h) % s.board.h };
}

export function move(s: LayerState, input: Dir): MoveEvent {
  if (s.status !== 'playing') return 'ignored';
  const dir = resolveDir(s, input);
  const step = DIRS[dir];
  let target = wrapPos(s, add(s.pos, step));
  let event: MoveEvent = 'moved';

  if (!passable(s, target)) {
    const beyond = wrapPos(s, add(target, step));
    if (s.blinkArmed && inBounds(s.board, beyond) && passable(s, beyond)) {
      target = beyond;
      s.blinkArmed = false;
      event = 'blink';
    } else {
      return 'blocked';
    }
  }

  const cell = cellAt(s.board, target);
  if (cell === 'vault' && !s.hasKey) return 'vault-locked';

  s.pos = target;
  s.moves += 1;
  s.trail.push({ ...target, t: s.echoClockMs });

  if (cell === 'drop') {
    s.status = 'cleared';
    return 'drop';
  }
  if (cell === 'vault') {
    s.status = 'cleared';
    return 'vault';
  }
  if (cell === 'key' && !s.hasKey) {
    s.hasKey = true;
    event = 'key';
  } else if (cell === 'note' && !s.noteRead) {
    s.noteRead = true;
    event = 'note';
  }
  if (checkCaught(s)) return 'caught';
  return event;
}

export function useAbility(s: LayerState): AbilityEvent {
  if (s.status !== 'playing') return 'ignored';
  if (s.charges <= 0) return 'no-charge';
  s.charges -= 1;
  if (s.ability === 'still') s.stillUntilMs = s.elapsedMs + STILL_MS;
  if (s.ability === 'lantern') {
    s.lanternUntilMs = s.elapsedMs + LANTERN_MS;
    s.board.cells.forEach((c, i) => {
      if (c !== 'hidden') return;
      const k = keyOf({ x: i % s.board.w, y: Math.floor(i / s.board.w) });
      if (!s.revealed.includes(k)) s.revealed.push(k);
    });
  }
  if (s.ability === 'blink') s.blinkArmed = true;
  return 'used';
}

export type TickEvent = 'none' | 'caught' | 'woke';

export function tick(s: LayerState, dtMs: number): TickEvent {
  if (s.status !== 'playing') return 'none';
  s.elapsedMs += dtMs;
  if (!stillActive(s)) s.echoClockMs += dtMs;
  if (s.elapsedMs >= s.def.pullMs) {
    s.elapsedMs = s.def.pullMs;
    s.status = 'woke';
    return 'woke';
  }
  return checkCaught(s) ? 'caught' : 'none';
}

/** Where each echo stands right now, or null while it hasn't formed yet. */
export function echoPositions(s: LayerState): (Vec | null)[] {
  const delays = s.def.echoDelaysMs ?? [];
  return delays.map((delay) => {
    const playback = s.echoClockMs - delay;
    if (playback < 0) return null;
    let at: TrailStep | undefined = s.trail[0];
    for (const step of s.trail) {
      if (step.t <= playback) at = step;
      else break;
    }
    return at ? { x: at.x, y: at.y } : null;
  });
}

function checkCaught(s: LayerState): boolean {
  if (stillActive(s)) return false; // frozen echoes are harmless
  const hit = echoPositions(s).some((p) => p !== null && same(p, s.pos));
  if (!hit) return false;
  s.caught += 1;
  s.elapsedMs = Math.min(s.def.pullMs - 1, s.elapsedMs + CAUGHT_PENALTY_MS);
  // The echoes scatter and re-form behind you.
  s.echoClockMs = 0;
  s.trail = [{ ...s.pos, t: 0 }];
  return true;
}

export function timeLeftMs(s: LayerState): number {
  return Math.max(0, s.def.pullMs - s.elapsedMs);
}

export function pullFraction(s: LayerState): number {
  return timeLeftMs(s) / s.def.pullMs;
}
