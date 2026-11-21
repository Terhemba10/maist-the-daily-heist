import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { context, reddit, redis, settings as appSettings } from '@devvit/web/server';
import type {
  BoardRow,
  DreamResponse,
  ErrorResponse,
  GhostResponse,
  InitResponse,
  LeaderboardResponse,
  PlayerSettings,
  RunRequest,
  RunResponse,
  ScoredRun,
  ShareResponse,
  Streak,
} from '../../shared/api';
import { applyDifficulty, DIFFICULTIES, MOVE_SLACK, type Difficulty } from '../../shared/logic/difficulty';
import { buildDream, voteOptions } from '../../shared/logic/generator';
import { replay, type RunRecord } from '../../shared/logic/replay';
import { scoreRun, shareLine } from '../../shared/logic/score';
import { msUntilNextDream, nightFor, SEASON_NIGHTS } from '../../shared/logic/season';
import { isTwist, resolveVote } from '../core/daily';
import { K, TTL } from '../core/keys';

export const api = new Hono();

const err = (c: HonoContext, message: string, status: 400 | 401 | 403 | 404 = 400) => c.json<ErrorResponse>({ status: 'error', message }, status);

function today(): number {
  return Math.max(1, nightFor(new Date()));
}

function postNight(): number {
  const n = Number(context.postData?.night ?? 0);
  return Number.isInteger(n) && n >= 1 && n <= SEASON_NIGHTS ? n : Math.min(SEASON_NIGHTS, today());
}

function isDifficulty(v: unknown): v is Difficulty {
  return typeof v === 'string' && DIFFICULTIES.some((d) => d === v);
}

/** Parse stored JSON and accept it only if it has the expected shape. */
function parseJson<T>(raw: string | undefined, fallback: T, guard: (v: unknown) => v is T): T {
  if (!raw) return fallback;
  try {
    const v: unknown = JSON.parse(raw);
    return guard(v) ? v : fallback;
  } catch {
    return fallback;
  }
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNums = (v: unknown): v is number[] => Array.isArray(v) && v.every((x) => typeof x === 'number');
const isSettings = (v: unknown): v is PlayerSettings =>
  isObj(v) && Object.values(v).every((x) => ['string', 'number', 'boolean'].includes(typeof x));
const isRecord = (v: unknown): v is RunRecord => isObj(v) && typeof v.a === 'string' && Array.isArray(v.l);
type StoredScore = Omit<ScoredRun, 'rank'>;
const isStoredScore = (v: unknown): v is StoredScore => isObj(v) && isDifficulty(v.difficulty) && typeof v.score === 'number' && Array.isArray(v.results) && typeof v.code === 'string';
type LastRun = { night: number; difficulty: Difficulty; line: string; code: string };
const isLastRun = (v: unknown): v is LastRun => isObj(v) && typeof v.night === 'number' && isDifficulty(v.difficulty) && typeof v.line === 'string' && typeof v.code === 'string';
type StoredRun = { name: string; record: RunRecord; difficulty: Difficulty; night: number };
const isStoredRun = (v: unknown): v is StoredRun => isObj(v) && typeof v.name === 'string' && isRecord(v.record) && isDifficulty(v.difficulty) && typeof v.night === 'number';
type StoredGhost = { name: string; record: RunRecord };
const isStoredGhost = (v: unknown): v is StoredGhost => isObj(v) && typeof v.name === 'string' && isRecord(v.record);
const isT1 = (v: string): v is `t1_${string}` => v.startsWith('t1_');

async function readStreak(uid: string): Promise<Streak> {
  const h = await redis.hGetAll(K.user(uid));
  return { count: Number(h.streak ?? 0), best: Number(h.best ?? 0), shields: Number(h.shields ?? 0), lastNight: Number(h.lastNight ?? 0) };
}

async function rankOf(key: string, uid: string): Promise<number | null> {
  const r = await redis.zRank(key, uid);
  if (r === undefined) return null;
  const total = await redis.zCard(key);
  return total - r;
}

async function touchUser(uid: string, patch: Record<string, string>): Promise<void> {
  await redis.hSet(K.user(uid), patch);
  await redis.expire(K.user(uid), TTL.long);
}

// ---------------------------------------------------------------- init

api.get('/init', async (c) => {
  const { postId, userId } = context;
  if (!postId) return err(c, 'postId is required but missing from context');
  const night = postNight();
  const t = today();
  const voted = await resolveVote(night);
  const tomorrow = t + 1;
  const counts = await redis.hGetAll(K.votes(tomorrow));
  let username: string | null = context.username ?? null;
  if (!username && userId) username = (await reddit.getCurrentUsername()) ?? null;

  let scored: ScoredRun | null = null;
  let streak: Streak = { count: 0, best: 0, shields: 0, lastNight: 0 };
  let cards: number[] = [];
  let settings: PlayerSettings | null = null;
  let mine: string | undefined;
  if (userId) {
    const raw = await redis.get(K.scored(t, userId));
    if (raw) {
      const s = parseJson<StoredScore | null>(raw, null, (v): v is StoredScore | null => isStoredScore(v));
      if (s) scored = { ...s, rank: await rankOf(K.board(t, s.difficulty), userId) };
    }
    streak = await readStreak(userId);
    const h = await redis.hGetAll(K.user(userId));
    cards = parseJson<number[]>(h.cards, [], isNums);
    settings = parseJson<PlayerSettings | null>(h.settings, null, (v): v is PlayerSettings | null => isSettings(v));
    mine = await redis.get(K.voted(tomorrow, userId));
  }
  const options = voteOptions(tomorrow);
  return c.json<InitResponse>({
    type: 'init',
    postId,
    username,
    loggedIn: !!userId,
    postNight: night,
    today: t,
    voted,
    scored,
    streak,
    cards,
    settings,
    vote: {
      night: tomorrow,
      options,
      counts: Object.fromEntries(options.map((o) => [o, Number(counts[o] ?? 0)])),
      mine: mine && isTwist(mine) ? mine : null,
    },
    nextDreamMs: msUntilNextDream(),
  });
});

// ---------------------------------------------------------------- dream spec (archive)

api.get('/dream', async (c) => {
  const night = Number(c.req.query('night'));
  if (!Number.isInteger(night) || night < 1 || night > Math.min(SEASON_NIGHTS, today())) return err(c, 'That night is still locked', 403);
  const voted = await resolveVote(night);
  return c.json<DreamResponse>({ night, voted });
});

// ---------------------------------------------------------------- runs

function newCode(): string {
  const abc = 'abcdefghjkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < 5; i++) s += abc[Math.floor(Math.random() * abc.length)];
  return s;
}

async function updateStreak(uid: string, night: number): Promise<Streak> {
  const s = await readStreak(uid);
  if (s.lastNight === night) return s;
  let count = 1;
  let shields = s.shields;
  if (s.lastNight === night - 1) count = s.count + 1;
  else if (s.lastNight === night - 2 && shields > 0) {
    // The Night-light shield covers one missed night.
    shields -= 1;
    count = s.count + 1;
  }
  if (count > 0 && count % 7 === 0) shields = Math.min(1, shields + 1);
  const next: Streak = { count, best: Math.max(s.best, count), shields, lastNight: night };
  await touchUser(uid, { streak: String(next.count), best: String(next.best), shields: String(next.shields), lastNight: String(night) });
  return next;
}

/** Opt-in only: show the streak as user flair, never replacing a flair the player set themselves. */
async function maybeFlair(uid: string, username: string, streak: Streak): Promise<void> {
  try {
    const h = await redis.hGetAll(K.user(uid));
    const prefs = parseJson<PlayerSettings>(h.settings, {}, isSettings);
    if (prefs.flair !== true) return;
    const allowed = await appSettings.get<boolean>('streakFlair');
    if (allowed === false) return;
    const subredditName = context.subredditName;
    if (!subredditName) return;
    const sub = await reddit.getSubredditByName(subredditName);
    const current = (await sub.getUserFlair({ usernames: [username] })).users[0]?.flairText ?? '';
    if (current && !current.startsWith('Dreamer ·')) return;
    await reddit.setUserFlair({ subredditName, username, text: `Dreamer · ${streak.count} night${streak.count === 1 ? '' : 's'}` });
  } catch (e) {
    console.error('flair skipped', e);
  }
}

api.post('/run', async (c) => {
  const { userId } = context;
  const body = await c.req.json<RunRequest>();
  const night = Number(body.night);
  if (!Number.isInteger(night) || night < 1 || night > Math.min(SEASON_NIGHTS, today())) return err(c, 'Bad night');
  if (!isDifficulty(body.difficulty)) return err(c, 'Bad difficulty');
  if (!isRecord(body.record)) return err(c, 'Bad run');
  const record = body.record;
  if (JSON.stringify(record ?? null).length > 40_000) return err(c, 'Run too large');

  const voted = await resolveVote(night);
  const dream = applyDifficulty(buildDream({ night, ...(voted ? { voted } : {}) }), body.difficulty);
  const r = replay(dream, record);
  if (!r.ok) return err(c, `Run rejected: ${r.reason}`);
  const slack = MOVE_SLACK[body.difficulty];
  const results = r.results;
  const score = scoreRun(results, dream.layers.length, slack);
  const completed = results.length === dream.layers.length && results.every((x) => x.cleared);
  const username = context.username ?? (userId ? await reddit.getCurrentUsername() : undefined) ?? 'a Diver';

  // Every run gets a challenge code so friends can race its ghost.
  const code = newCode();
  await redis.set(K.run(code), JSON.stringify({ name: username, record, difficulty: body.difficulty, night }), { expiration: new Date(Date.now() + TTL.night * 1000) });

  let streak: Streak = { count: 0, best: 0, shields: 0, lastNight: 0 };
  let rank: number | null = null;
  let scoredNow = false;
  if (userId) {
    // Story cards: any completed run (scored, practice or archive) collects the night's memory.
    const h = await redis.hGetAll(K.user(userId));
    const cards = parseJson<number[]>(h.cards, [], isNums);
    if (completed && !cards.includes(night)) cards.push(night);
    const snoovatar = context.snoovatar ?? (await reddit.getSnoovatarUrl(username).catch(() => undefined)) ?? '';
    await touchUser(userId, {
      name: username,
      snoo: snoovatar,
      cards: JSON.stringify(cards.sort((a, b) => a - b)),
      last: JSON.stringify({ night, difficulty: body.difficulty, line: shareLine(night, results, slack), code }),
    });

    // One scored attempt per day, only on tonight's dream; everything else is practice.
    if (body.scored && night === today()) {
      const claimed = await redis.set(K.scored(night, userId), JSON.stringify({ difficulty: body.difficulty, score, results, code }), {
        nx: true,
        expiration: new Date(Date.now() + TTL.night * 1000),
      });
      scoredNow = claimed === 'OK';
      if (scoredNow) {
        const board = K.board(night, body.difficulty);
        await redis.zAdd(board, { member: userId, score });
        await redis.expire(board, TTL.night);
        rank = await rankOf(board, userId);
        if (rank === 1) {
          await redis.set(K.ghost(night, body.difficulty), JSON.stringify({ name: username, record }), { expiration: new Date(Date.now() + TTL.night * 1000) });
        }
        const deepest = results.filter((x) => x.cleared).length;
        await redis.zIncrBy(K.deep(), userId, deepest);
        await redis.expire(K.deep(), TTL.long);
        streak = await updateStreak(userId, night);
        await maybeFlair(userId, username, streak);
      }
    }
    if (!scoredNow) streak = await readStreak(userId);
  }
  return c.json<RunResponse>({ type: 'run', scored: scoredNow, score, results, rank, streak, code });
});

// ---------------------------------------------------------------- leaderboards

api.get('/leaderboard', async (c) => {
  const night = Number(c.req.query('night') ?? today());
  const board = c.req.query('board') ?? 'medium';
  const key = board === 'deep' ? K.deep() : isDifficulty(board) ? K.board(night, board) : null;
  if (!key) return err(c, 'Bad board');
  const top = await redis.zRange(key, 0, 9, { by: 'rank', reverse: true });
  const rows: BoardRow[] = [];
  for (const [i, m] of top.entries()) {
    const h = await redis.hGetAll(K.user(m.member));
    rows.push({ rank: i + 1, name: h.name ?? 'a Diver', score: m.score, snoovatar: h.snoo || null, me: m.member === context.userId });
  }
  let me: BoardRow | null = null;
  if (context.userId) {
    const score = await redis.zScore(key, context.userId);
    const rank = await rankOf(key, context.userId);
    if (score !== undefined && rank !== null) me = { rank, name: context.username ?? 'you', score, snoovatar: context.snoovatar ?? null, me: true };
  }
  return c.json<LeaderboardResponse>({ night, board, rows, me, total: await redis.zCard(key) });
});

// ---------------------------------------------------------------- share (as the user, opt-in)

api.post('/share', async (c) => {
  const { userId, postId } = context;
  if (!userId || !postId) return c.json<ShareResponse>({ ok: false, message: 'Log in to share your run.' });
  const h = await redis.hGetAll(K.user(userId));
  const last = parseJson<LastRun | null>(h.last, null, (v): v is LastRun | null => isLastRun(v));
  if (!last) return c.json<ShareResponse>({ ok: false, message: 'Play a run first.' });
  const pinId = await redis.hGet(K.post(postId), 'pinId');
  if (!pinId || !isT1(pinId)) return c.json<ShareResponse>({ ok: false, message: 'This post has no share thread yet.' });
  // The text is built on the server from the stored run, so players can't post free text through the app.
  const diff = last.difficulty[0]?.toUpperCase() + last.difficulty.slice(1);
  const text = `${last.line} · ${diff}\n\nRace my ghost: code **${last.code}**`;
  try {
    const comment = await reddit.submitComment({ id: pinId, text, runAs: 'USER' });
    return c.json<ShareResponse>({ ok: true, message: 'Posted!', commentUrl: comment.permalink });
  } catch (e) {
    console.error('share failed', e);
    return c.json<ShareResponse>({ ok: false, message: 'Could not post right now.' });
  }
});

// ---------------------------------------------------------------- tomorrow-twist vote

api.post('/vote', async (c) => {
  const { userId } = context;
  if (!userId) return err(c, 'Log in to vote', 401);
  const { option } = await c.req.json<{ option: string }>();
  const tomorrow = today() + 1;
  if (!isTwist(option) || !voteOptions(tomorrow).includes(option)) return err(c, 'Not an option');
  const claimed = await redis.set(K.voted(tomorrow, userId), option, { nx: true, expiration: new Date(Date.now() + TTL.night * 1000) });
  if (claimed === 'OK') {
    await redis.hIncrBy(K.votes(tomorrow), option, 1);
    await redis.expire(K.votes(tomorrow), TTL.night);
  }
  const counts = await redis.hGetAll(K.votes(tomorrow));
  return c.json({ ok: claimed === 'OK', counts });
});

// ---------------------------------------------------------------- settings

api.post('/settings', async (c) => {
  const { userId } = context;
  if (!userId) return c.json({ ok: false });
  const body = await c.req.json<{ settings: PlayerSettings }>();
  const raw = JSON.stringify(body.settings ?? {});
  if (raw.length > 2_000) return err(c, 'Settings too large');
  await touchUser(userId, { settings: raw });
  return c.json({ ok: true });
});

// ---------------------------------------------------------------- ghosts

api.get('/ghost', async (c) => {
  const code = c.req.query('code');
  if (code) {
    const raw = await redis.get(K.run(code.toLowerCase().replace(/[^a-z0-9]/g, '')));
    const g = parseJson<StoredRun | null>(raw, null, (v): v is StoredRun | null => isStoredRun(v));
    return c.json<GhostResponse>(g ? { ok: true, ...g } : { ok: false });
  }
  const night = Number(c.req.query('night') ?? today());
  const d = c.req.query('difficulty');
  if (!isDifficulty(d)) return err(c, 'Bad difficulty');
  const g = parseJson<StoredGhost | null>(await redis.get(K.ghost(night, d)), null, (v): v is StoredGhost | null => isStoredGhost(v));
  return c.json<GhostResponse>(g ? { ok: true, ...g, difficulty: d, night } : { ok: false });
});
