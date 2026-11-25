import { Hono } from 'hono';
import type { TaskResponse } from '@devvit/web/server';
import { createHeistPost } from '../core/heistPost';

export const scheduler = new Hono();

/** Every day at 00:00 UTC: tonight's heist post. */
scheduler.post('/daily-post', async (c) => {
  try {
    const post = await createHeistPost();
    console.log(`daily post ${post.id} (created: ${post.created})`);
  } catch (error) {
    console.error('daily post failed', error);
  }
  return c.json<TaskResponse>({ status: 'ok' }, 200);
});
