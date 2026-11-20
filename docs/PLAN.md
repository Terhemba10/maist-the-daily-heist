# Maist: build plan

Hackathon: Reddit Game of the Day (Devpost). **Deadline: 8 Dec 2026, 6 pm PST.** The goal is to be demo-ready by 5 Dec.
Story, look and rules: [`GAME_BIBLE.md`](GAME_BIBLE.md). Progress: [`STATUS.md`](STATUS.md).

## Platform facts (from the Devvit docs, v0.15.4, read 21 Nov 2026)
- Devvit Web app: `src/client` (web views), `src/server` (Hono, serverless), `src/shared`, `devvit.json`.
- `splash.html` is the **inline** (in-feed) entry. It must be tap-only and must not trap feed scrolling (no `preventDefault` on wheel/touch, no `touch-action: none` on html/body). `game.html` is the **expanded** entry and can use swipes.
- Redis: strings, hashes, sorted sets, numbers, bitfields. No plain sets or lists. 100 MB per installation until published.
- Scheduler: `devvit.json → scheduler.tasks` with `cron`, posting to `/internal/...`.
- Score-sharing comments **must be submitted as the user** (`runAs: 'USER'`, `permissions.reddit.asUser: ["SUBMIT_COMMENT"]`), from an explicit button, as a **reply to a pinned comment**. Until the app is approved, they post from the app account (or as the owner in playtest).
- Flair: `reddit.setUserFlair()`. Avatars: `reddit.getSnoovatarUrl(username)`, which can be missing, so we need a fallback.
- Users' data: honour account and post deletions, and expire Redis keys within 30 days where possible.
- No Reddit brand assets (Snoo), no links off-platform, and an original name and art.
- Playtest subreddits must have < 200 members. The auto-created one is private, so the hackathon needs a **public** one.
- `npm run launch` publishes for review: **only when the owner says so**.

## Build order (show each step working before moving on)
- [x] **0. Checks**: Node v26.13.0; name check (final name **Maist**, app `maist-game`); docs read.
- [ ] **a. Scaffold**: Phaser template, login, hello post in the playtest subreddit.
- [ ] **Vertical slice** (approval gate): title screen and logo; Night 1 (lighthouse keeper) with all 3 layers; the fold-fall; one twist per layer (tide doors, mirror page, echoes); the Pull ring; ability pick (Still, Blink, Lantern); vault flower; story card; wake-up shatter; 10 s onboarding; sound and mute; low quality mode; reduced motion. Screenshots and the test post link go to the owner. **Wait for approval.**
- [ ] **b/c. Daily system**: date seed → night index + twist picks from the catalogue; layers 2–3 variants; countdown to the next dream; 1 scored attempt + practice.
- [ ] **d. Reddit features**: daily scheduler post; per-day leaderboard (sorted set) and all-time "deepest dreamers"; streaks (bitfield per user per year) with Night-light shield and flair; the "Share my run" reply as the user under the pinned comment; tomorrow-twist vote; snoovatars on the leaderboard; finale vote.
- [ ] **e. Polish**: gamepad, more dreamers, Memory Wall, near-miss messages, tests, README for judges, demo post in the public test subreddit.
- [ ] **Later, if time allows**: zh / ja / hi translations; an optional hint helper only if allowed by the Devvit rules.

## Tech
- Phaser **4.2.1** (template default; filters, particles, tweens). All textures are baked from Canvas 2D at boot.
- Game rules live in `src/shared/logic` (pure TypeScript, unit-tested with `node --test`).
- Client text lives in `src/client/i18n/en.ts`.
- Quality: automatic Low/High, `prefers-reduced-motion`, particle caps.
