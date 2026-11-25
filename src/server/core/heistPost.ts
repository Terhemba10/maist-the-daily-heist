import { context, reddit, redis } from '@devvit/web/server';
import { nightNumber } from '../../shared/logic/season';
import { HK, HTTL } from './heistKeys';

/**
 * Create tonight's heist post with a pinned thread. Players reply to the pin to share scores and to
 * call for Kicks (Devvit rule: app-made comments from players go under a pinned comment).
 * Idempotent per night unless `force`.
 */
export async function createHeistPost(opts: { night?: number; force?: boolean } = {}) {
  const subredditName = context.subredditName;
  if (!subredditName) throw new Error('subredditName missing');
  const night = opts.night ?? nightNumber();
  const existing = await redis.hGet(HK.night(night), 'postId');
  if (existing && !opts.force) return { id: existing, created: false };

  const post = await reddit.submitCustomPost({
    subredditName,
    title: `Maist: The Daily Heist · Night ${night} · three dream layers, one shared AP pool`,
    entry: 'default',
    postData: { night },
  });
  await redis.hSet(HK.night(night), { postId: post.id });
  await redis.hSet(HK.post(post.id), { night: String(night) });
  await redis.expire(HK.night(night), HTTL.night);
  await redis.expire(HK.post(post.id), HTTL.night);
  try {
    const pin = await reddit.submitComment({
      id: post.id,
      text: `🔐 **Night ${night} crew thread.** Share your heist here. Stuck adrift? The game can post a call for help: reply **WAKE UP** to someone's call to send them a Pull.`,
    });
    await pin.distinguish(true);
    await redis.hSet(HK.post(post.id), { pinId: pin.id });
  } catch (e) {
    console.error('Could not create the pinned thread', e);
  }
  return { id: post.id, created: true };
}
