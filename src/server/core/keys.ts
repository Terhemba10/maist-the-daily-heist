import type { Difficulty } from '../../shared/logic/difficulty';

/**
 * Redis keys. Per-night data expires after 40 days; per-user data after 60 days of inactivity,
 * so stored user data never outlives the Devvit data-retention guidance by much.
 */
export const K = {
  night: (n: number) => `night:${n}`,
  post: (postId: string) => `post:${postId}`,
  board: (n: number, d: Difficulty) => `lb:${n}:${d}`,
  deep: () => 'lb:deep',
  scored: (n: number, uid: string) => `scored:${n}:${uid}`,
  user: (uid: string) => `user:${uid}`,
  votes: (n: number) => `votes:${n}`,
  voted: (n: number, uid: string) => `voted:${n}:${uid}`,
  ghost: (n: number, d: Difficulty) => `ghost:${n}:${d}`,
  run: (code: string) => `run:${code}`,
};

export const TTL = {
  night: 40 * 86_400,
  long: 60 * 86_400,
};
