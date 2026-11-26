import type { LayerResult, RunRecord } from './engine.ts';

export type Streak = { count: number; best: number; lastNight: number };

export type HeistInit = {
  type: 'init';
  postId: string;
  username: string | null;
  snoovatar: string | null;
  loggedIn: boolean;
  /** The night this post belongs to. */
  postNight: number;
  /** Tonight (UTC). Only tonight's post accepts the one scored run. */
  today: number;
  scored: { score: number; rank: number | null } | null;
  streak: Streak;
  /** Kicks other players have sent to you tonight. */
  kicks: { granted: number; asked: boolean };
  /** How many crews have a scored run on this post's night (the leaderboard size). */
  crews: number;
  /** Your scores on the last 3 nights up to tonight (null = not played). */
  history: { night: number; score: number | null }[];
  nextMs: number;
  /** The subreddit this post lives in (for "Join r/… for tomorrow's heist"). */
  subreddit: string;
  /** This player already joined the subreddit from the game. */
  joined: boolean;
};

export type JoinRes = { ok: boolean; message?: string };

export type RunReq = { night: number; record: RunRecord; scored: boolean };
export type RunRes = { type: 'run'; scored: boolean; score: number; results: LayerResult[]; rank: number | null; streak: Streak; reason?: string };

export type LimboReq = { night: number; record: RunRecord };
export type LimboRes = { ok: boolean; message: string; url?: string };
export type KickRes = { granted: number; asked: boolean };

export type BoardRow = { rank: number; name: string; score: number; snoovatar: string | null; me: boolean };
export type BoardRes = { night: number; rows: BoardRow[]; me: BoardRow | null; total: number };

export type ShareRes = { ok: boolean; message: string; url?: string };

/** Tonight's #1 run, replayed one action per player action as a ghost crew. */
export type GhostRes = { ok: boolean; night: number; name?: string; record?: RunRecord };
