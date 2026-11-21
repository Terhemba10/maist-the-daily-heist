import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { createDreamPost } from '../core/daily';

export const scheduler = new Hono();

/** Every day at 00:00 UTC: tonight's dream post (resolves yesterday's twist vote first). */
scheduler.post('/daily-post', async (c) => {
  try {
    const post = await createDreamPost();
    console.log(`daily post ${post.id} (created: ${post.created})`);
  } catch (error) {
    console.error('daily post failed', error);
  }
  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
