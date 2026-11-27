# Devpost submission: Maist: The Daily Heist

Everything to paste into Devpost, plus a click-by-click checklist at the end.

- **Play it:** https://www.reddit.com/r/MaistHeist/ (Night 1 post: https://www.reddit.com/r/MaistHeist/comments/1y6a4ox/)
- **App:** https://developers.reddit.com/apps/maist-game
- **Demo video (file):** `docs/video/maist-demo.mp4` (57.6 s, 1920x1080). Upload it to YouTube and paste that link.
- **Vertical teaser:** `docs/video/maist-teaser-vertical.mp4` (15 s, 1080x1920)
- **Gallery images:** `docs/devpost/still-1-crew.png` … `still-5-leaderboard.png` (1920x1080)

---

## Project name

Maist: The Daily Heist

## Tagline (elevator pitch, max 200 characters)

A new heist every day on Reddit: sneak a crew of three past security bots, crack three vaults, race tonight's #1 ghost, and get pulled back by friends who reply WAKE UP.

## About the project

### Inspiration

We wanted a daily game that feels like it belongs on Reddit: short enough to play in a feed, the same
puzzle for everyone so the comments become the strategy guide, and a reason to talk to each other
while you play. Heist movies gave us the crew, the vault and the "it's never that simple" twist.

### What it does

Every night at 00:00 UTC a new post appears with a new heist, generated from the date so everyone gets
the same three maps.

- **A crew of three, one shared pool of moves.** Vale **folds** walls open, Wren **fades** from sight,
  and Oto puts robots to **sleep**. Every step and ability spends the same Action Points, so the puzzle
  is choosing who moves and when.
- **Turn-based stealth.** Robots move after each of your actions; their flashlight beams (red tiles)
  catch anyone who steps in. Easy has statues, Hard has patrols, Difficult adds fog and watchers that
  turn toward you.
- **The vault slips!** On some layers the vault vanishes when you reach it and reappears elsewhere, with a
  gold ping for one turn before you have to search for it.
- **Play with friends: the Pull.** Out of moves? The game posts a call for help under the pinned crew
  thread. Anyone who replies **WAKE UP** sends you a Pull: +6 moves and your crew comes back.
- **Ghost race.** Tonight's #1 scored run plays beside you as see-through ghosts, one step per action.
- **Daily leaderboard and streaks.** One scored run per night (the server replays every move, so scores
  can't be faked), Snoovatars on the leaderboard, streaks for playing night after night, and a
  "Join r/MaistHeist" button at the end so you come back tomorrow.
- **For every player.** White and night themes, 5 languages (English, 中文, 日本語, Deutsch, हिन्दी),
  bigger text, reduced motion, and a Smooth mode that switches on by itself on low-end phones.
  Logged-out visitors can practice.

### How we built it

- **Devvit Web** (Reddit's Developer Platform): the game runs in the post as a web view (TypeScript and
  CSS, no game engine). A Hono server handles the leaderboards, streaks, the ghost run and the
  Pull, stored in Redis. A daily scheduler creates each night's post and its pinned crew thread.
- **One deterministic rules engine** is shared by the client (to play) and the server (to replay and
  score every run). A solver checks that every generated map can be cleared within its move budget,
  including the full route after a vault slips.
- **Art:** semi-realistic character sheets we generated, cut into front, side and back views with the
  free offline tools of sprite-gen. A build script removes the leftover white background and adds soft
  shadows. All animation (breathing, steps, crouching, cheering) is code; the office floor is drawn on
  a canvas.
- **Performance:** we profiled with a 6x CPU throttle to stand in for a cheap phone, removed forced
  reflows, and added Smooth mode. It holds 55+ fps there while walking.
- **The demo video** was made with code too: Playwright played the real game in a phone-sized
  window, a script cut the scenes, and the narration is a Microsoft neural voice (edge-tts).

### Challenges we ran into

- Keeping the daily maps fair: the vault-slip twist meant the solver had to price the whole route
  (start, vault, new vault) and every layer had to stay solvable.
- Making the game smooth on low-end phones inside the Reddit app. Profiling surprised us: one
  background animation was keeping the board on its own GPU layer.
- Designing a social mechanic that works with plain Reddit comments: the Pull reads replies under
  your call for help.

### Accomplishments that we're proud of

- A real daily ritual: same puzzle for everyone, one scored try, a ghost of the night's best run, and
  friends who can rescue you.
- Fair and cheat-proof scoring: the server re-runs every move with the same engine.
- It fits every screen from a phone to a 1920x1080 monitor without scrolling, in 5 languages.

### What we learned

- Devvit's triggers, scheduler and Redis make "a new post every day" simple, so you can spend your time
  on the game.
- Measure before optimizing: some of our performance guesses were wrong until we profiled.

### What's next for Maist: The Daily Heist

More rooms (the office is the first), more crew abilities, weekly "heist seasons" with a shared story,
and crew leaderboards for subreddits that play together.

### Built during the hackathon

Maist was designed and built during the Reddit Game of the Day Hackathon, starting on 21 November 2026:
the game, the server, the art pipeline, the public subreddit r/MaistHeist and this video.

## Built with

`devvit` · `reddit-developer-platform` · `typescript` · `hono` · `redis` · `vite` · `css` · `canvas` ·
`web-audio-api` · `playwright` · `ffmpeg` · `edge-tts` · `sprite-gen` · `python`

## Try it out links

- https://www.reddit.com/r/MaistHeist/
- https://www.reddit.com/r/MaistHeist/comments/1y6a4ox/
- https://developers.reddit.com/apps/maist-game

## Credits

- Character art: our own generations (Higgsfield), processed with sprite-gen's free tools.
- Music in the demo video: "Pop Pop" by The_Mountain (Pixabay, file `the_mountain-pop-pop-music-576583.mp3`).
  Check the Pixabay licence page before publishing.
- Narration: Microsoft neural voice en-US-AndrewNeural via edge-tts.
- Game sound effects and in-game music: synthesised with the Web Audio API (no samples).

---

## Checklist: what to click on Devpost

1. **Upload the video to YouTube** (Devpost needs a link): YouTube → Create → Upload video →
   `docs/video/maist-demo.mp4` → title "Maist: The Daily Heist (Reddit Game of the Day Hackathon)" →
   Visibility **Public** or **Unlisted** → copy the link.
2. Open the hackathon page on Devpost → **Enter a submission** (or **Edit submission**).
3. **Project overview:** paste the *Project name* and *Tagline* above. Upload a thumbnail:
   `docs/devpost/still-2-vault-slips.png`.
4. **Project details:** paste *About the project* (Inspiration through What's next, plus the "Built during
   the hackathon" note) into the story field. Paste the *Built with* tags one by one.
5. **Try it out links:** add the three links above.
6. **Video demo link:** paste the YouTube link.
7. **Image gallery:** upload `docs/devpost/still-1-crew.png` … `still-5-leaderboard.png` (and the real
   screenshots in `docs/video/real/` if you like).
8. **Additional info / questions:** answer what the form asks (for example, your Reddit username
   u/Dangerous_Lie_7980, the app name `maist-game`, and the subreddit r/MaistHeist).
9. Tick the rules / terms checkboxes yourself, then click **Save** and **Submit**. Before the deadline,
   check the submission page says **Submitted**.
