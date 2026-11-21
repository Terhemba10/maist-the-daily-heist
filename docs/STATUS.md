# Maist: status

_Last updated: 21 Nov 2026_

## Where we are
**Vertical slice v2 (3D) is built and waiting for the owner's approval.** Do not start step d (Reddit features) until approved.

- Project: `C:\dev\maist\maist-game` (git, branch `main`, not pushed anywhere). Devvit app: **`maist-game`**. Reddit account: u/Dangerous_Lie_7980 (CLI token lives in the user profile, never in the repo).
- **Playtest:** `npm run dev` (keep the "maist playtest" terminal tab running) → https://www.reddit.com/r/maist_game_dev/?playtest=maist-game. Every saved change is pushed to the test post. This subreddit is **private**; the owner still needs a **public** test subreddit (< 200 members) for judging.
- Stack: Devvit Web 0.15.4, **three.js 0.187** (Phaser removed), Vite 8, Hono, TypeScript 6. Node v26.13.0.
- Devvit docs: developers.reddit.com is blocked for Claude's tools, so they're read from `github.com/reddit/devvit-docs`.

## v1 review (21 Nov) → v2
Approved and kept: title, logo, palettes, Pull ring, ability button, typography, story card, dialogue style.
Redone in v2:
- **3D paper dioramas** (three.js): low-poly rooms with thick slab and cut-away walls, glowing paper edges, baked corner AO, no shadow maps, the Diver's lantern as a real point light, slow camera sway and follow, front-facing 3/4 view (up stays up).
- **Themed Night 1 layers:** L1 Keeper's Rock (wet stone, crates, rope bollards, casks, sea around the rock, sweeping lighthouse beam, drizzle); L2 Drowned Stair (sand and shells, barnacled crates, anchors, coral, kelp, caustics, light shafts, bubbles, portholes); L3 Lamp Room (brass plates, lens shards, gears, oil barrels, log books, giant lens rings, embers, flicker).
- **Fall:** the floor halves hinge open, the sea fades, and the camera dives through to the next layer as colours shift (about 1.7 s), with light streaks rushing past.
- **Wake:** the floor breaks into glowing paper fragments with sparks drifting upward and a bloom of light, then the results.
- **Desktop board** fills the screen (the camera distance is solved to fit the free area between HUD margins).

## New in v2
- **Music:** original synth-pop loops composed in code (L1 chill 92 BPM, L2 112 BPM with arpeggio, L3 128 BPM intense). Starts only after **Dive**. Separate **Music** and **SFX** sliders.
- **Difficulty:** Easy / Medium / Hard (shared rules in `src/shared/logic/difficulty.ts`; separate leaderboards come in step d).
- **Settings** (saved per player in browser storage for now): music, SFX, graphics Low/High, vibration, reduced motion (system/on/off), colour theme (Moonlit, Rose Dream, Ocean, Midnight, High contrast), cloak and lantern colours (Pearl cloak at 3 nights, Gold lantern at 7, Moonwhite at 14). Credits line included.
- **Resolution:** native device pixel ratio (Low caps it at 1.25×) plus **adaptive resolution** that steps down if frames run long.
- **Season calendar and Dream Archive rules** (`src/shared/logic/season.ts`): "Night X of 30" on the title; past nights replayable as practice; future nights locked. The Archive screen itself comes with the daily system.
- Bundle: game 171 KB gzipped (was 372 KB with Phaser), splash 3 KB.

## Measured on the owner's laptop (Intel HD 520, real Chrome via Playwright)
| View | Quality | fps (L1 / L2 / L3) |
|---|---|---|
| 1440×900 | High | 59 / 60 / 60 |
| 1920×1080 | High | 58 / 58 / 58 (adaptive resolution) |
| 1440×900 | Low | 60 / 60 / 60 |
| 393×852 (phone size) | Low | 60 / 60 / 60 |

Not yet measured on a real Redmi 15C.

## Checks
20 rules tests pass (`npm run test:unit`), typecheck and lint are clean, build OK. Screenshots: `docs/screens/`.

## Known gaps
- Night 1 is hard-coded (no daily seed yet); only 3 of the 32 twists are implemented.
- Streaks are a local placeholder (the settings screen shows unlocks from it); real streaks come in step d.
- No server features yet (leaderboards, streak/flair, share reply, votes, scheduler, ghost race, archive screen).
- Theme changes during a dream rebuild the room in place; the quality toggle changes resolution live, but antialiasing only changes after a reload.

## Next (after approval)
1. Daily system: date seed → night + twists, countdown, 1 scored attempt + practice, Dream Archive screen.
2. Step d: scheduler post, leaderboards per day and difficulty plus all-time, streak + Night-light + flair, share reply as the user, twist vote, snoovatars, settings in Redis.
3. Step e: ghost race and challenge codes, Memory Wall, more dreamers, public test subreddit, judges' README.
4. Stretch: realtime co-op.
