import { Hono } from 'hono';
import type { UiResponse } from '@devvit/web/shared';
import { context } from '@devvit/web/server';
import { createDreamPost } from '../core/daily';

export const menu = new Hono();

/** Moderator menu: post tonight's dream now (the scheduler also does this every day at 00:00 UTC). */
menu.post('/post-create', async (c) => {
  try {
    const post = await createDreamPost({ force: true });
    return c.json<UiResponse>({ navigateTo: `https://reddit.com/r/${context.subredditName}/comments/${post.id}` }, 200);
  } catch (error) {
    console.error(`Error creating post: ${error}`);
    return c.json<UiResponse>({ showToast: 'Failed to create post' }, 400);
  }
});
