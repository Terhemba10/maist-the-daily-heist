# Devpost submission: Maist: The Daily Heist

Every field of the submit form on https://redditgameofday2026.devpost.com, ready to copy and paste, in the
order the form asks for them. The click-by-click checklist is at the end.

---

## 1. Project name

```
Maist: The Daily Heist
```

## 2. Tagline (under 60 characters)

```
A new crew stealth heist every day, inside Reddit
```

(49 characters)

## 3. About the project (the story field, Markdown)

```markdown
## Inspiration

We wanted a daily game that feels like it belongs on Reddit: short enough to play from the feed, the same puzzle for everyone so the comments become the strategy guide, and a reason for players to help each other. Heist movies gave us the crew, the vault, and the "it's never that simple" twist.

**Maist was newly built during the Reddit Game of the Day Hackathon, in November 2026.** Everything you see (the game, the server, the art pipeline, the public subreddit r/MaistHeist and the demo video) was made during the hackathon.

## What it does

Every day at 00:00 UTC a new post appears on r/MaistHeist with a new heist, generated from the date so everyone gets the same three maps.

- **A crew of three, one shared pool of moves.** Vale **folds** walls open, Wren **fades** from sight, and Oto puts robots to **sleep**. Every step and ability spends the same Action Points, so the puzzle is choosing who moves and when.
- **Turn-based stealth.** Robots move after each of your actions and their flashlight beams (the red tiles) catch anyone who steps in. Easy has robots that stand still, Hard has patrols, and Difficult adds fog and watchers that turn toward you.
- **The vault slips!** On some layers the vault vanishes when you reach it and reappears somewhere else. A gold ping shows where for one turn, then you have to find it.
- **Play with friends: the Pull.** Out of moves? The game posts a call for help under the pinned crew thread, and anyone who replies **WAKE UP** sends you a Pull: +6 moves, and your crew comes back.
- **Ghost race.** Tonight's #1 scored run plays beside you as see-through ghosts, one step for each of your actions.
- **Daily leaderboard and streaks.** You get one scored run per night, and the server replays every move, so scores can't be faked. Snoovatars appear on the leaderboard, streaks build when you play night after night, and a "Join r/MaistHeist" button at the end brings you back tomorrow.
- **For every player.** White and night themes, 5 languages (English, 中文, 日本語, Deutsch, हिन्दी), bigger text, reduced motion, and a Smooth mode that turns on by itself on low-end phones. Visitors who aren't logged in can practice.

## How we built it

- **Devvit Web** (Reddit's Developer Platform). The game runs inside the post as a web view written in TypeScript and CSS, with no game engine. A Hono server stores the leaderboards, streaks, the ghost run and the Pull in Redis. A daily scheduler creates each night's post and its pinned crew thread.
- **One deterministic rules engine** is shared by the client, which plays, and the server, which replays and scores every run. A solver checks that every generated map can be cleared within its move budget, including the full route after the vault slips.
- **Art.** We generated semi-realistic character sheets and cut them into front, side and back views with sprite-gen's free offline tools. A build script removes leftover background and adds soft shadows. All animation (breathing, steps, crouching, cheering) is code, and the office floor is drawn on a canvas.
- **Performance.** We profiled with a 6x CPU throttle to stand in for a cheap phone, removed forced reflows, and added Smooth mode, which holds 55+ fps while walking.
- **The demo video** was made with code too: Playwright played the real game in a phone-sized window, a script cut the scenes, and the narration is a Microsoft neural voice.

## Challenges we ran into

- **Keeping daily maps fair.** The vault slip meant the solver had to price the whole route (start, vault, new vault), and every layer had to stay solvable.
- **Making it smooth on low-end phones inside the Reddit app.** Profiling surprised us: one slow background animation was what kept the board on its own GPU layer.
- **A social mechanic that works with plain Reddit comments.** The Pull works by reading replies under your call for help.

## Accomplishments that we're proud of

- A real daily ritual: the same puzzle for everyone, one scored try, a ghost of the night's best run, and friends who can rescue you.
- Cheat-proof scoring: the server re-runs every move with the same engine.
- It fits every screen, from a phone to a 1920x1080 monitor, without scrolling, in 5 languages.

## What we learned

- Devvit's triggers, scheduler and Redis make "a new post every day" simple, so the time goes into the game.
- Measure before you optimize: several of our performance guesses were wrong until we profiled.

## What's next for Maist: The Daily Heist

More rooms (the office is the first), more crew abilities, weekly heist seasons with a shared story, and crew leaderboards for subreddits that play together.
```

## 4. Built with (add one tag at a time)

```
devvit
reddit-developer-platform
typescript
hono
redis
vite
css
html5-canvas
web-audio-api
playwright
ffmpeg
```

## 5. "Try it out" links

- **App listing:** `https://developers.reddit.com/apps/maist-game`
- **Demo post (current daily post on r/MaistHeist, Night 2):** `https://www.reddit.com/r/MaistHeist/comments/1y6fam4/`
- **The subreddit:** `https://www.reddit.com/r/MaistHeist/`

(A new post appears every day. If the form wants "the" demo post on a later day, open r/MaistHeist → New and copy the newest "Maist: The Daily Heist · Night N" post link.)

## 6. Video demo link

```
https://youtu.be/PASTE-YOUR-VIDEO-ID-HERE
```

Upload `docs/video/maist-demo.mp4` (54.0 s) first, using `docs/video/YOUTUBE.md`.

## 7. Image gallery: upload in this order

1. `docs/devpost/still-2-vault-slips.png` (also use this as the thumbnail / cover image)
2. `docs/devpost/still-1-crew.png`
3. `docs/devpost/still-4-wake-up.png`
4. `docs/devpost/still-3-ghost-race.png`
5. `docs/devpost/still-5-leaderboard.png`

Optional extras (real Reddit screenshots): `docs/video/real/feed.png`, `docs/video/real/thread.png`.

## 8. Other form questions (if the form asks)

- **Reddit username:** u/Dangerous_Lie_7980
- **App name on Reddit's Developer Platform:** maist-game
- **Subreddit:** r/MaistHeist
- **Was this built during the hackathon?** Yes, it was newly built in November 2026, during the hackathon.
- **Credits:** character art from our own generations (Higgsfield), processed with sprite-gen. In-game music
  and sound are synthesised with the Web Audio API. Demo video music: "Pop Pop" by The_Mountain
  (Pixabay). Narration: Microsoft neural voice en-US-AndrewNeural (edge-tts).

---

## Checklist: what to click on redditgameofday2026.devpost.com

Before you start:

- [ ] Upload `docs/video/maist-demo.mp4` to YouTube with the text in `docs/video/YOUTUBE.md`, set it to
      Public or Unlisted, and copy the link.
- [ ] Do **not** publish the app on developers.reddit.com: the rules ask for it to stay private.

On Devpost:

1. [ ] Go to **https://redditgameofday2026.devpost.com** and log in (top right).
2. [ ] If you haven't yet, click **Join hackathon** and accept the rules.
3. [ ] Click **Enter a submission** (or **My projects → Edit** if you started one).
4. [ ] **Project name:** paste section 1. **Tagline:** paste section 2. Click **Save & continue**.
5. [ ] **Thumbnail / cover image:** upload `docs/devpost/still-2-vault-slips.png`.
6. [ ] **About the project:** paste all of section 3 into the story field.
7. [ ] **Built with:** type each tag from section 4 and press Enter after each one.
8. [ ] **Try it out links:** add the app listing, the demo post and the subreddit (section 5).
9. [ ] **Video demo link:** paste your YouTube link (section 6).
10. [ ] **Image gallery:** upload the 5 stills in the order of section 7.
11. [ ] **Additional questions:** answer from section 8 (username, app name, built during the hackathon).
12. [ ] **Team:** if you have teammates, invite them from the project page. Otherwise skip this.
13. [ ] Tick the **terms / eligibility checkboxes** yourself, then click **Submit project**.
14. [ ] Check that the project page shows **Submitted** (not Draft) before the deadline:
      **8 December 2026, 6 pm PST**.
15. [ ] **Optional: Developer Platform feedback survey.** It's linked from the hackathon page (look in the
      "Resources" or "Updates" tab, or in the confirmation email). Open it and share what worked and what
      was hard (ideas: SUBSCRIBE_TO_SUBREDDIT is not granted to unpublished apps, the playtest upload
      sometimes stalls on "Finishing upload", and the login token expires during long sessions).
