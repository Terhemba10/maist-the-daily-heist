import { reddit } from '@devvit/web/server';

export const createPost = async () => {
  return await reddit.submitCustomPost({
    title: 'Maist · Night 1: The Lighthouse Keeper (a mind heist, three layers deep)',
  });
};
