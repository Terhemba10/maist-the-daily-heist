# Maist

**Maist: a mind heist, three layers deep.** A daily puzzle game that you play inside a Reddit post.

## What it is

Every night, one person in the city of Lowmere wakes up missing a memory. A thief called **the Moth** has hidden it deep inside their dream. You are a **Diver**: a small hooded figure with a lantern. You slip into the sleeper's dream, fall three layers deep, steal the memory back from a vault and get out before **the Pull** (the timer) wakes you.

- **One new dream every day, the same for everyone.** A run takes 3–5 minutes.
- **Three layers, each a 3D paper diorama themed to the dreamer's mind.** Each layer reuses the same floor plan with a new twist: doors that swap with the tide, a mirrored page where left is right, and Echoes that replay your own steps behind you.
- **One ability per dream:** **Still** freezes Echoes, **Blink** steps through one wall, and **Lantern** reveals hidden doors. You get one charge per layer.
- **Moons and story.** You earn 1–3 moons per layer for time and tidy moves. Each recovered memory unlocks a story card with a clue about who the Moth really is.

- **Easy, Medium or Hard** on the same daily dream.
- **Dream Archive** (coming with the daily system): replay past nights of the season as practice to collect missed story cards.

It's for anyone who likes short daily puzzles and a slow-burn mystery. It plays on phones (tap and swipe) and on desktop (keyboard or gamepad).

> **Status:** vertical slice (Night 1, *The Lighthouse Keeper*). The daily schedule, leaderboards, streaks, share comments and the twist vote come next. See [`docs/STATUS.md`](docs/STATUS.md).

## How to play

1. Tap **Enter the dream** on the post. The game opens fullscreen.
2. Pick one ability.
3. Walk with **swipes**, the **on-screen arrows**, **arrow keys / WASD**, or a **gamepad** d-pad.
4. Step into the glowing **Drop** to fall to the next layer.
5. On layer 3, pick up the **memory key**, then reach the **vault** before the Pull ring closes.
6. Use your ability with the round button, **Space**, its number key (**1 / 2 / 3**) or gamepad **A**. **M** toggles sound, **Esc** (or gamepad **Start**) opens settings.

**Settings** (the gear button): music and sound-effect volume, graphics Low/High, vibration, reduced motion, colour themes (including a colour-blind-safe high-contrast theme) and Diver cloak and lantern colours. Some colours unlock with your streak.

A 10-second "how to play" appears the first time you play.

## For moderators: installing and running

- Install the app on your subreddit. A moderator menu item, **"Maist: create tonight's dream post"**, creates the game post. (A daily automatic post is planned.)
- The app doesn't ask players for any personal information, links nowhere off Reddit and never posts on anyone's behalf without them pressing a clearly labelled button.
- All art and sound are generated in code; there are no third-party assets.

## For developers

Built with Devvit Web 0.15.4, three.js, Vite, Hono and TypeScript. The UI is plain HTML/CSS over the 3D view.

```
npm install
npm run dev          # playtest on Reddit (needs `npm run login` once)
npm run build        # build client and server
npm run test:unit    # rules tests (node --test)
npm run test:types   # typecheck
npm run lint
```

- `src/shared/logic`: game rules (pure, unit-tested): board, layer state, abilities, echoes, scoring.
- `src/shared/dreams`: hand-written dreams (Night 1 lives here).
- `src/client`: `splash.html` (the in-feed view, tap only) and `game.html` (fullscreen 3D game). `three/` holds the world, rooms, props and Diver; `ui/` the HTML screens; `game/dream.ts` runs a dream. All text is in `src/client/i18n/en.ts`.
- `src/server`: Hono routes for Devvit (post creation, API).
- `docs/GAME_BIBLE.md`: story, art direction, animation list, retention loop. `docs/PLAN.md`: build plan. `docs/STATUS.md`: current state.

Screenshots and reviews can jump to a moment with `game.html?demo=pick|dream|vault|settings` (plus `&layer=1..3` for `dream`, `&quality=low|high`).

## Credits

- **Art:** all 2D and 3D art is drawn in code for Maist (Canvas 2D and three.js primitives). No third-party art.
- **Music and sound:** original synth-pop loops and sound effects, composed and synthesised in code with the Web Audio API for Maist. No samples or licensed tracks.
- **Libraries:** [three.js](https://threejs.org) (MIT), Hono (MIT), Devvit (BSD-3-Clause).

Not affiliated with or endorsed by Reddit.
