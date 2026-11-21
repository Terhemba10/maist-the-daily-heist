import type { Difficulty } from './logic/difficulty.ts';
import type { RunRecord } from './logic/replay.ts';
import type { LayerResult } from './logic/score.ts';
import type { TwistId } from './logic/types.ts';

export type Streak = { count: number; best: number; shields: number; lastNight: number };

export type ScoredRun = { difficulty: Difficulty; score: number; results: LayerResult[]; rank: number | null; code: string };

export type PlayerSettings = Record<string, string | number | boolean>;

export type InitResponse = {
  type: 'init';
  postId: string;
  username: string | null;
  loggedIn: boolean;
  /** The night this post belongs to. */
  postNight: number;
  /** Tonight's night (UTC). Only tonight's post accepts scored runs. */
  today: number;
  /** Tomorrow-twist vote result applied to this night's layer 2 (if any). */
  voted: TwistId | null;
  scored: ScoredRun | null;
  streak: Streak;
  cards: number[];
  settings: PlayerSettings | null;
  vote: { night: number; options: TwistId[]; counts: Record<string, number>; mine: TwistId | null };
  nextDreamMs: number;
};

export type DreamResponse = { night: number; voted: TwistId | null };

export type RunRequest = { night: number; difficulty: Difficulty; record: RunRecord; scored: boolean };

export type RunResponse = {
  type: 'run';
  scored: boolean;
  score: number;
  results: LayerResult[];
  rank: number | null;
  streak: Streak;
  code: string | null;
  reason?: string;
};

export type BoardRow = { rank: number; name: string; score: number; snoovatar: string | null; me: boolean };

export type LeaderboardResponse = { night: number; board: string; rows: BoardRow[]; me: BoardRow | null; total: number };

export type ShareResponse = { ok: boolean; message: string; commentUrl?: string };

export type GhostResponse = { ok: boolean; name?: string; record?: RunRecord; difficulty?: Difficulty; night?: number };

export type ErrorResponse = { status: 'error'; message: string };
