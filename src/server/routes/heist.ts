import { Hono } from 'hono';
import type { Context as HonoContext } from 'hono';
import { context, reddit, redis } from '@devvit/web/server';
import type { BoardRes, BoardRow, HeistInit, KickRes, LimboReq, LimboRes, RunReq, RunRes, ShareRes, Streak } from '../../shared/heist/api';
import { buildHeist, isRecord, replay, totalScore, type LayerResult } from '../../shared/heist/engine';
import { msUntilNextDream, nightFor } from '../../shared/logic/season';
import { HK, HTTL } from '../core/heistKeys';

export const heist = new Hono();

const err = (c: HonoContext, message: string, status: 400 | 401 | 403 = 400) => c.json({ status: 'error', message }, status);

export function today(): number {
  return Math.max(1, nightFor(new Date()));
}

function postNight(): number {
  const n = Number(context.postData?.night ?? 0);
  return Number.isInteger(n) && n >= 1 && n <= today() ? n : today();
}

const exp = (sec: number) => new Date(Date.now() + sec * 1000);

async function readStreak(uid: string): Promise<Streak> {
  const h = await redis.hGetAll(HK.user(uid));
  return { count: Number(h.streak ?? 0), best: Number(h.best ?? 0), lastNight: Number(h.lastNight ?? 0) };
}

async function rankOf(key: string, uid: string): Promise<number | null> {
  const r = await redis.zRank(key, uid);
  if (r === undefined) return null;
  return (await redis.zCard(key)) - r;
}

async function touchUser(uid: string, patch: Record<string, string>): Promise<void> {
  await redis.hSet(HK.user(uid), patch);
  await redis.expire(HK.user(uid), HTTL.user);
}

async function username(): Promise<string> {
  return context.username ?? (context.userId ? await reddit.getCurrentUsername() : undefined) ?? 'an operative';
}

async function kickState(night: number, uid: string): Promise<KickRes> {
  const h = await redis.hGetAll(HK.help(night, uid));
  return { granted: Number(h.granted ?? 0), asked: !!h.commentId };
}

const isT1 = (v: string): v is `t1_${string}` => v.startsWith('t1_');

// ---------------------------------------------------------------- init

heist.get('/init', async (c) => {
  const { postId, userId } = context;
  if (!postId) return err(c, 'postId missing');
  const t = today();
  const name = context.username ?? (userId ? ((await reddit.getCurrentUsername()) ?? null) : null);
  let scored: HeistInit['scored'] = null;
  let streak: Streak = { count: 0, best: 0, lastNight: 0 };
  let kicks: KickRes = { granted: 0, asked: false };
  if (userId) {
    const raw = await redis.get(HK.scored(t, userId));
    if (raw) scored = { score: Number(raw), rank: await rankOf(HK.board(t), userId) };
    streak = await readStreak(userId);
    kicks = await kickState(t, userId);
  }
  return c.json<HeistInit>({
    type: 'init',
    postId,
    username: name,
    snoovatar: context.snoovatar ?? null,
    loggedIn: !!userId,
    postNight: postNight(),
    today: t,
    scored,
    streak,
    kicks,
    nextMs: msUntilNextDream(),
  });
});

// ---------------------------------------------------------------- runs

async function updateStreak(uid: string, night: number): Promise<Streak> {
  const s = await readStreak(uid);
  if (s.lastNight === night) return s;
  const count = s.lastNight === night - 1 ? s.count + 1 : 1;
  const next: Streak = { count, best: Math.max(s.best, count), lastNight: night };
  await touchUser(uid, { streak: String(count), best: String(next.best), lastNight: String(night) });
  return next;
}

heist.post('/run', async (c) => {
  const { userId } = context;
  const body = await c.req.json<RunReq>();
  const night = Number(body.night);
  if (!Number.isInteger(night) || night < 1 || night > today()) return err(c, 'Bad night');
  if (!isRecord(body.record) || JSON.stringify(body.record).length > 30_000) return err(c, 'Bad run');
  const r = replay(buildHeist(night), body.record);
  if (!r.ok) return err(c, `Run rejected: ${r.reason}`);
  const results: LayerResult[] = r.results;
  const score = totalScore(results);

  let rank: number | null = null;
  let streak: Streak = { count: 0, best: 0, lastNight: 0 };
  let scoredNow = false;
  if (userId) {
    const name = await username();
    const snoo = context.snoovatar ?? (await reddit.getSnoovatarUrl(name).catch(() => undefined)) ?? '';
    await touchUser(userId, { name, snoo });
    if (body.scored && night === today()) {
      // Kicks must have been sent by other players through the comment thread.
      const k = await kickState(night, userId);
      if (r.kicks > k.granted) return err(c, 'Run rejected: kick not received yet');
      const claimed = await redis.set(HK.scored(night, userId), String(score), { nx: true, expiration: exp(HTTL.night) });
      scoredNow = claimed === 'OK';
      if (scoredNow) {
        await redis.zAdd(HK.board(night), { member: userId, score });
        await redis.expire(HK.board(night), HTTL.night);
        rank = await rankOf(HK.board(night), userId);
        const cleared = results.filter((x) => x.cleared).length;
        await touchUser(userId, { last: JSON.stringify({ night, score, cleared, kicks: r.kicks }) });
        streak = await updateStreak(userId, night);
      }
    }
    if (!scoredNow) streak = await readStreak(userId);
  }
  return c.json<RunRes>({ type: 'run', scored: scoredNow, score, results, rank, streak });
});

// ---------------------------------------------------------------- limbo: ask the thread for a Kick

heist.post('/limbo', async (c) => {
  const { userId, postId } = context;
  if (!userId || !postId) return c.json<LimboRes>({ ok: false, message: 'Log in to call for a Kick.' });
  const body = await c.req.json<LimboReq>();
  const night = Number(body.night);
  if (night !== today()) return c.json<LimboRes>({ ok: false, message: 'Kicks only work on tonight’s heist.' });
  if (await redis.get(HK.scored(night, userId))) return c.json<LimboRes>({ ok: false, message: 'Your scored run is already in.' });
  if (!isRecord(body.record)) return err(c, 'Bad run');
  const r = replay(buildHeist(night), body.record);
  if (!r.ok || r.final?.status !== 'limbo') return c.json<LimboRes>({ ok: false, message: 'You are not in Limbo.' });
  const k = await kickState(night, userId);
  const usedBefore = Number((await redis.hGet(HK.help(night, userId), 'used')) ?? -1);
  if (k.granted > r.kicks) return c.json<LimboRes>({ ok: true, message: 'A Kick is waiting for you!' });
  if (k.asked && usedBefore === r.kicks) return c.json<LimboRes>({ ok: true, message: 'Your call is already in the thread. Waiting for a reply…' });

  const pinId = await redis.hGet(HK.post(postId), 'pinId');
  if (!pinId || !isT1(pinId)) return c.json<LimboRes>({ ok: false, message: 'This post has no help thread yet.' });
  const layer = r.results.length;
  // Fixed text built on the server: players can't post free text through the app.
  const text = `🌀 I'm stuck in **Limbo** on layer ${layer} of tonight's heist with ${r.final.ap} AP left. Reply **WAKE UP** to send me a Kick!`;
  try {
    const comment = await reddit.submitComment({ id: pinId, text, runAs: 'USER' });
    await redis.hSet(HK.help(night, userId), { commentId: comment.id, granted: String(k.granted), used: String(r.kicks) });
    await redis.expire(HK.help(night, userId), HTTL.night);
    return c.json<LimboRes>({ ok: true, message: 'Posted! Anyone who replies WAKE UP sends you a Kick.', url: comment.permalink });
  } catch (e) {
    console.error('limbo post failed', e);
    return c.json<LimboRes>({ ok: false, message: 'Could not post right now.' });
  }
});

/** Check the help comment for a WAKE UP reply from someone else. Each help comment grants one Kick. */
heist.get('/kick', async (c) => {
  const { userId } = context;
  if (!userId) return c.json<KickRes>({ granted: 0, asked: false });
  const night = today();
  const h = await redis.hGetAll(HK.help(night, userId));
  const granted = Number(h.granted ?? 0);
  const used = Number(h.used ?? 0);
  const commentId = h.commentId ?? '';
  if (!commentId || !isT1(commentId) || granted > used) return c.json<KickRes>({ granted, asked: !!commentId });
  try {
    const comment = await reddit.getCommentById(commentId);
    const replies = await comment.replies.all();
    const woke = replies.some((rep) => rep.authorId !== userId && /wake\s*up/i.test(rep.body));
    if (woke) {
      await redis.hSet(HK.help(night, userId), { granted: String(granted + 1) });
      return c.json<KickRes>({ granted: granted + 1, asked: true });
    }
  } catch (e) {
    console.error('kick check failed', e);
  }
  return c.json<KickRes>({ granted, asked: true });
});

// ---------------------------------------------------------------- leaderboard

heist.get('/leaderboard', async (c) => {
  const night = Number(c.req.query('night') ?? today());
  const key = HK.board(night);
  const top = await redis.zRange(key, 0, 9, { by: 'rank', reverse: true });
  const rows: BoardRow[] = [];
  for (const [i, m] of top.entries()) {
    const h = await redis.hGetAll(HK.user(m.member));
    rows.push({ rank: i + 1, name: h.name ?? 'an operative', score: m.score, snoovatar: h.snoo || null, me: m.member === context.userId });
  }
  let me: BoardRow | null = null;
  if (context.userId) {
    const score = await redis.zScore(key, context.userId);
    const rank = await rankOf(key, context.userId);
    if (score !== undefined && rank !== null) me = { rank, name: context.username ?? 'you', score, snoovatar: context.snoovatar ?? null, me: true };
  }
  return c.json<BoardRes>({ night, rows, me, total: await redis.zCard(key) });
});

// ---------------------------------------------------------------- share (as the user, explicit button)

heist.post('/share', async (c) => {
  const { userId, postId } = context;
  if (!userId || !postId) return c.json<ShareRes>({ ok: false, message: 'Log in to share.' });
  const raw = await redis.hGet(HK.user(userId), 'last');
  if (!raw) return c.json<ShareRes>({ ok: false, message: 'Finish tonight’s scored run first.' });
  let last: { night: number; score: number; cleared: number; kicks: number };
  try {
    last = JSON.parse(raw);
  } catch {
    return c.json<ShareRes>({ ok: false, message: 'Finish tonight’s scored run first.' });
  }
  const pinId = await redis.hGet(HK.post(postId), 'pinId');
  if (!pinId || !isT1(pinId)) return c.json<ShareRes>({ ok: false, message: 'This post has no share thread yet.' });
  const vaults = '🔓'.repeat(last.cleared) + '🔒'.repeat(Math.max(0, 3 - last.cleared));
  const text = `Night ${last.night} heist: ${vaults} · **${last.score}** pts${last.kicks ? ` · ${last.kicks} Kick${last.kicks > 1 ? 's' : ''}` : ' · no Kicks'}`;
  try {
    const comment = await reddit.submitComment({ id: pinId, text, runAs: 'USER' });
    return c.json<ShareRes>({ ok: true, message: 'Posted!', url: comment.permalink });
  } catch (e) {
    console.error('share failed', e);
    return c.json<ShareRes>({ ok: false, message: 'Could not post right now.' });
  }
});
