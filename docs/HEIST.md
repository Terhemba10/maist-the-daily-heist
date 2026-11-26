# Maist: The Daily Heist (branch `daily-heist`)

A turn-based tactics game played inside a Reddit post, on phone and desktop.

- **Every night, three new 10x10 maps** (Easy, Hard, Difficult), the same for everyone, built from the date.
  Every map is checked by a solver to be beatable within its AP.
- **A crew of three** shares one pool of Action Points (AP). 1 AP per step.
  - Vale, the Shaper: **Fold** (2 AP) opens a wall next to her.
  - Wren, the Ghost: **Fade** (1 AP) can't be seen for 2 turns.
  - Oto, the Chemist: **Haze** (3 AP) puts a guard within 3 tiles to sleep for 2 turns.
  - **Wait** (1 AP) lets the guards move.
- **Guards** see their own tile and 2-3 tiles ahead (red). Easy: static guards. Hard: 4 patrols. Difficult: 3 patrols, 2 watchers that turn toward you, and fog.
- Get anyone onto the vault ◈ to crack the layer.
- **The vault slipped!** On some layers (marked ⇄ next to the layer name) the vault vanishes the first time you reach
  it and reappears at least 5 tiles away; the guards still take their turn. A gold ping shows the new spot for one
  turn (through the fog on Difficult), then you search. Easy never slips, Hard slips on about half of nights,
  Difficult always slips. The solver, AP budget and par all cover the full route (start, vault, new vault).
- **Adrift and the Pull:** run out of AP or crew and you go adrift. On tonight's post, the game can post a call
  for help (as you) under the pinned thread. Anyone who replies **WAKE UP** sends you a Pull: +6 AP and your crew comes back.
- **Score:** 200 per vault + 100 per AP left + 50 per layer without a Pull + 100 for reaching a slipped vault within 5 moves. One scored run per day; the server replays
  every run to compute the score. Daily leaderboard with Snoovatars, streaks, and "Share to the thread".
- White (light) theme by default; Dark and System in Settings.
- **Smooth mode** (Settings: Auto / On / Off): on automatically on low-end phones (deviceMemory <= 4 or <= 4 CPU cores).
  No background rays, dust or tint, no idle animations, flat tiles, no glows or filters. Same rules and score.
- **2D art (branch `heist-2d-art`):** semi-realistic crew and robot figures with front / side / back views
  (side mirrored for left), on an office floor. Sources: `assets/sprites/source/`; rebuild the WebPs with
  `SPRITE_GEN=… python scripts/build-sprites.py` (sprite-gen `cutout` + `shadow` only, nothing paid).
  Animation is code: breathing, step bob with squash/stretch, crouch when a guard faces you, ability lean,
  spotted tip-over, cheer jump, flashlight cones. Shipped art: 172 KB.
- Languages: English, 中文, 日本語, Deutsch, हिन्दी.

Code: `src/shared/heist/engine.ts` (rules, generator, replay, tests in `engine.test.ts`), `src/server/routes/heist.ts`
(API), `src/client/heist.ts` + `heist.css` (game), `src/client/i18n/heist.ts` (text).
The 3D Maist game is untouched on the `main` branch.

Before going public: set `SEASON_START` in `src/shared/logic/season.ts` to launch day.
