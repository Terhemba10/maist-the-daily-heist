/** Redis keys for the Daily Heist. Per-night data expires after 40 days, per-user data after 60 idle days. */
export const HK = {
  night: (n: number) => `h:night:${n}`,
  post: (postId: string) => `h:post:${postId}`,
  board: (n: number) => `h:lb:${n}`,
  scored: (n: number, uid: string) => `h:scored:${n}:${uid}`,
  user: (uid: string) => `h:user:${uid}`,
  help: (n: number, uid: string) => `h:help:${n}:${uid}`,
};

export const HTTL = {
  night: 40 * 86_400,
  user: 60 * 86_400,
};
