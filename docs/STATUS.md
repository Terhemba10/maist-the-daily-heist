# Maist: status

_Last updated: 21 Nov 2026_

## Where we are
The 3D slice (v2) was **approved on 21 Nov**. The **daily system (step b/c) and the Reddit features (step d)** are now built and on the playtest. They need a live check on Reddit by the owner: Claude's browser can't open reddit.com.

- Project: `C:\dev\maist\maist-game` (git, `main`, not pushed). Devvit app **`maist-game`**, account u/Dangerous_Lie_7980.
- **Playtest:** "maist playtest" terminal tab (`npm run dev`) → https://www.reddit.com/r/maist_game_dev/?playtest=maist-game (v0.0.1.37+). This subreddit is private; a **public** test subreddit (< 200 members) is still needed for judging.
- The post made before this update has no night data or share thread. Use the subreddit menu **"Maist: post tonight's dream"** to create a fresh one.

## Daily system (b/c)
- **Season calendar:** `SEASON_START = 2026-11-21` (`src/shared/logic/season.ts`), so Night 1 is today (UTC) and one night unlocks per UTC day. **Change this to the real launch day before going public.**
- **Dream generator** (`src/shared/logic/generator.ts`): Night 1 is hand-written; every other night is built from its number:
  - a seeded 7×7 maze with loops, tide doors, a hidden-door shortcut, a Moth note in a dead end, and a memory key placed far from both start and vault;
  - layer 1 twist: tide doors, loop rooms or gravity flip; layer 2 twist: the tomorrow-twist vote winner, or seeded; last layer: echoes;
  - every 7th night is a 5-layer deep dream;
  - par and Pull (60–90 s) are computed per layer.
  - Tested: nights 2–60 are all solvable and deterministic.
- **New twists:** gravity flip (up/down swapped) and loop rooms (edges wrap). Five twists are now implemented.
- **Story text for all 30 nights** (`src/shared/dreams/story.ts`): name, role, card, clue, two reactive lines and a Moth note per dreamer.
- **Deterministic runs** (`src/shared/logic/replay.ts`): the game steps in fixed 50 ms ticks and records inputs. The server **replays every run** to compute the official score, which blocks cheating, and the same record will drive ghost races.
- **One scored attempt per day** (tonight's post, logged in, first attempt); everything else is practice. Countdown to the next dream on the title and splash.
- **Dream Archive screen:** past nights are playable as practice, future nights locked, collected memories (story cards) viewable.

## Reddit features (d)
- **Daily post:** scheduler cron `0 0 * * *` (UTC) creates tonight's post (`postData {night}`), resolves yesterday's twist vote, and adds a distinguished, pinned **share thread** comment. The moderator menu can force a post; the app-install trigger creates one too.
- **Leaderboards:** per night × difficulty (Redis sorted sets, top 10 plus "you"); all-time **Deepest dreamers** (total layers cleared in scored runs). Snoovatars are shown, with an initial as fallback.
- **Streaks:** consecutive scored nights, best, and a **Night-light** shield (earned every 7 nights, max 1, covers one missed night). Cosmetic unlocks use the real streak.
- **Flair (opt-in only):** "Dreamer · N nights". The player must switch on *Streak flair* in Settings, and moderators can disable it in the app's subreddit settings. It never replaces a flair the player set themselves.
- **Share my run:** posted **as the user** (`runAs: 'USER'`, `asUser: ["SUBMIT_COMMENT"]`) as a **reply to the pinned share comment**, only after an explicit confirm that shows the exact text. The text is built on the server (no free text): the spoiler-free line, difficulty and a challenge code. Until the app is approved, Devvit posts it from the app account, or as the owner in playtest.
- **Tomorrow-twist vote:** 3 options, one vote per player; the winner becomes tomorrow's layer 2 twist.
- **Settings sync:** player settings are saved in Redis (per user), so they follow the player across devices.
- **Data care:** per-night keys expire after 40 days and per-user keys after 60 days of inactivity; post-delete trigger cleans post data.
- Ghost records are stored server-side (top run per night/difficulty and every run's challenge code), ready for the ghost race.

## Checks
- 26 unit tests pass (rules, difficulty, season, generator on 59 nights, replay); typecheck and lint clean; build OK (game 177 KB gzipped, splash ~9 KB).
- Local screenshots of the new screens: `docs/screens/21–25`.
- **Not yet verified live on Reddit:** server endpoints, the scheduler, share-as-user, flair and leaderboards (needs the owner to play the post).

## Known gaps
- Rooms for nights 2–30 reuse Night 1's three themed prop sets (lighthouse, drowned, lamp room); per-dreamer themes (bakery, bus, clock tower…) are next.
- Story cards for nights 2–30 use a generic memory-orb illustration; only Night 1 has a hand-drawn scene.
- Reactive dialogue for nights 2–30 has 2 lines (good/bad) instead of 4.
- Ghost race and challenge-code playback in the client aren't built yet (the server side is ready).
- Finale vote (Night 30) not built yet.

## Next
1. Owner playtest on Reddit; fix anything the logs show.
2. Per-dreamer room themes and card art; ghost race; finale vote.
3. Public test subreddit, set `SEASON_START`, judges' README, demo video.
