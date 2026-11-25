import { Hono } from 'hono';
import type { TriggerResponse } from '@devvit/web/shared';
import { redis } from '@devvit/web/server';
import { createHeistPost } from '../core/heistPost';
import { HK } from '../core/heistKeys';

export const triggers = new Hono();

triggers.post('/on-app-install', async (c) => {
  try {
    const post = await createHeistPost();
    return c.json<TriggerResponse>({ status: 'success', message: `Heist post ${post.id}` }, 200);
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<TriggerResponse>({ status: 'error', message: 'Failed to create post' }, 400);
  }
});

/** Honour deletions: when a heist post is deleted, drop what we stored about it. */
triggers.post('/on-post-delete', async (c) => {
  const body: unknown = await c.req.json();
  const postId = typeof body === 'object' && body !== null && 'postId' in body && typeof body.postId === 'string' ? body.postId : null;
  if (postId) {
    const night = await redis.hGet(HK.post(postId), 'night');
    await redis.del(HK.post(postId));
    if (night) {
      const stored = await redis.hGet(HK.night(Number(night)), 'postId');
      if (stored === postId) await redis.hDel(HK.night(Number(night)), ['postId']);
    }
  }
  return c.json<TriggerResponse>({ status: 'success', message: 'ok' }, 200);
});
