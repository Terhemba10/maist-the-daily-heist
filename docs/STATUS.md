# Maist: status

_Last updated: 21 Nov 2026_

## Where we are
**Step a (scaffold) and the vertical slice are built and waiting for the owner's approval.** Do not start step d (Reddit features) until approved.

- Project: `C:\dev\maist\maist-game` (git repo, branch `main`). Devvit app name: **`maist-game`** (`maist` was taken). Reddit account: u/Dangerous_Lie_7980 (CLI token saved by Devvit in the user profile, not in the repo).
- Stack: Devvit Web 0.15.4, Phaser 4.2.1, Vite 8, Hono, TypeScript 6. Node v26.13.0 locally.
- **Playtest:** `npm run dev` → https://www.reddit.com/r/maist_game_dev/?playtest=maist-game (app v0.0.1.1). This auto-created subreddit is **private**; a public test subreddit (< 200 members) is still needed for judging. Installing the app created the first post automatically (onAppInstall trigger); moderators can make more from the subreddit menu ("Maist: create tonight's dream post").
- The docs site developers.reddit.com is blocked for Claude's fetch tool and browser, so Devvit docs are read from `github.com/reddit/devvit-docs`.

## Vertical slice: done
- Title screen with the code-drawn "maist" logo (the i's dot is a paper moth) and the tagline; lighthouse backdrop with a sweeping beam; quality and sound toggles.
- Ability pick (Still / Blink / Lantern), with keys 1–3.
- Night 1, *The Lighthouse Keeper*, with 3 layers on one floor plan:
  - L1 dusk violet: **tide doors** (swap every 4 s, shimmer before they turn).
  - L2 deep teal: **mirror page** (the room turns like a page; left/right swapped); a Moth note.
  - L3 ember gold: **Echoes** replay your steps 4 s behind; memory key, then the vault.
- Falling-fold animation (the back half folds over and drops, dust rushes up, the next room unfolds), page turn, heartbeat Pull ring with red edge darkening, step ripples, echo light trails, see-through walls in front of the Diver.
- Vault flower opens, the memory rises and blooms into the story card (code-drawn art, lines, clue, moons, reactive dreamer line).
- Wake-up shatter (the last frame breaks into paper pieces) and a results screen with score, moons, near-miss and the share-line preview.
- 10 s onboarding (3 panels, tap to skip, remembered per viewer).
- Web Audio sound (pad per layer, steps, heartbeat, chimes, bloom, shatter) and mute; `prefers-reduced-motion`; Low/High quality (auto); phone vibration ticks.
- Controls: swipe, on-screen arrows (touch), arrows/WASD, Space/1–3, gamepad d-pad / stick / A.
- In-feed splash: tap-only, no scroll traps, no Snoo or external links.
- Tests: 12 rules tests pass (`npm run test:unit`); typecheck and lint are clean; build is 372 KB gzipped (Phaser is about 340 KB of that); 60 fps on High at 1280×800 in real Chrome.
- Screenshots: `docs/screens/`.

## Not done yet / known gaps
- No daily seed yet: Night 1 is hard-coded. The twist catalogue (32 twists) is written in the bible but only 3 twists are implemented.
- No server features yet (leaderboard, streaks, flair, share comment, votes, scheduler).
- Not yet measured on a real Redmi 15C or the Intel HD 520 laptop in Low mode.
- The public test subreddit for judging hasn't been created yet (the owner must create it on reddit.com; < 200 members).

## Next steps (after approval)
1. Owner reviews screenshots and the playtest post; collect feedback on look and feel.
2. Step b/c: date seed → night + twists; countdown to the next dream; 1 scored attempt + practice.
3. Step d: scheduler post, leaderboards (per day, all-time), streak + Night-light + flair, "Share my run" reply as the user, twist vote, snoovatars.
4. Step e: polish, Memory Wall, more dreamers, public test subreddit, README for judges.
