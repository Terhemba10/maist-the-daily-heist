import { context, reddit, redis } from '@devvit/web/server';
import { story } from '../../shared/dreams/story';
import { nightInfo } from '../../shared/dreams/season1';
import { VOTE_TWISTS } from '../../shared/logic/generator';
import { currentNight, SEASON_NIGHTS } from '../../shared/logic/season';
import type { TwistId } from '../../shared/logic/types';
import { K, TTL } from './keys';

/** Resolve the tomorrow-twist vote cast during night n-1 into night n's layer-2 twist. */
export async function resolveVote(night: number): Promise<TwistId | null> {
  const stored = await redis.hGet(K.night(night), 'voted');
  if (stored) return isTwist(stored) ? stored : null;
  const counts = await redis.hGetAll(K.votes(night));
  let best: TwistId | null = null;
  let top = 0;
  for (const [twist, n] of Object.entries(counts)) {
    const v = Number(n);
    if (isTwist(twist) && v > top) {
      top = v;
      best = twist;
    }
  }
  await redis.hSet(K.night(night), { voted: best ?? '' });
  await redis.expire(K.night(night), TTL.long);
  return best;
}

export function isTwist(v: string): v is TwistId {
  return VOTE_TWISTS.some((t) => t === v);
}

/**
 * Create the dream post for tonight (or a given night), with a pinned comment players reply to
 * with their share lines. Idempotent per night unless `force`.
 */
export async function createDreamPost(opts: { night?: number; force?: boolean } = {}) {
  const subredditName = context.subredditName;
  if (!subredditName) throw new Error('subredditName missing');
  const night = opts.night ?? currentNight();
  const existing = await redis.hGet(K.night(night), 'postId');
  if (existing && !opts.force) return { id: existing, created: false };

  await resolveVote(night);
  const s = story(nightInfo(night).dreamer);
  const post = await reddit.submitCustomPost({
    subredditName,
    title: `Maist · Night ${night} of ${SEASON_NIGHTS}: ${s.role} (a mind heist, three layers deep)`,
    entry: 'default',
    postData: { night },
  });
  await redis.hSet(K.night(night), { postId: post.id, created: String(Date.now()) });
  await redis.hSet(K.post(post.id), { night: String(night) });
  await redis.expire(K.night(night), TTL.long);
  await redis.expire(K.post(post.id), TTL.long);

  // The pinned comment that share lines reply to (Devvit rule: score shares reply to a sticky comment).
  try {
    const pin = await reddit.submitComment({
      id: post.id,
      text: `🌙 **Night ${night} share thread.** Finished the dream? Tap "Share my run" in the game to reply here with your (spoiler-free) result.`,
    });
    await pin.distinguish(true);
    await redis.hSet(K.post(post.id), { pinId: pin.id });
  } catch (err) {
    console.error('Could not create the pinned share comment', err);
  }
  return { id: post.id, created: true };
}
