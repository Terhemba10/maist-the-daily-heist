# Maist: Game Bible

**Maist**: *a mind heist, three layers deep.*
A daily puzzle game that runs inside a Reddit post. Everyone plays the same dream each night.

This bible is the source of truth for story, look, motion, sound and the daily loop. Code lives in `src/`, and all player-facing text lives in `src/client/i18n/en.ts`.

---

## 0. Originality rules

- Maist is original. It borrows no names, terms, characters or scenes from any film or game.
- **Banned words** (never in UI, docs or story): kick, totem, limbo, architect, inception, extraction, forger, projection, "point man", "mark", "dream within a dream".
- **Our own vocabulary:**

| Term | Meaning |
|---|---|
| **Diver** | The player: a small hooded figure carrying a lantern. |
| **The Pull** | The waking force; it acts as the timer. When the Pull ring closes, you wake. |
| **Layer** | One floor of a dream. Every dream is 3 layers deep (Sunday "deep dreams" are 5). |
| **The Drop** | The glowing well you step into to fall to the next layer. |
| **Echo** | A light-ghost that replays your own past steps. Touching one wakes you a little (time penalty). |
| **The Vault** | A paper bud on the last layer that holds the stolen memory. |
| **Memory** | The prize. It blooms into a story card. |
| **Moons** | 1–3 per layer, earned by time left and moves used. |
| **Lucid** | A badge for a perfect night: 3 moons on every layer. |
| **Night-light** | A one-day streak shield. |
| **The Moth** | The thief who hides memories in dreams. |

- All art is drawn in code (Canvas 2D textures at boot, plus SVG in the DOM). There is no stock art, no copyrighted music and no Reddit brand assets (no Snoo).

---

## 1. Story: *Maist, Season 1: The Moth*

### Premise
Every night, someone in the city of **Lowmere** wakes up missing a memory. They know something is gone, the way your tongue knows a missing tooth. You are a **Diver**: you slip into a sleeper's dream, fall three layers deep and bring the memory back before **the Pull** wakes you.

At the bottom of every dream you find the same signature: a dusting of grey wing-powder and a folded paper note. The city calls the thief **the Moth**.

### Story cards
Each recovered memory unlocks a **story card**. A card has:
1. an illustrated scene, drawn in code in the dreamer's palette,
2. two or three lines of story,
3. **one clue** about the Moth.

The cards fill the **Memory Wall**, a collection screen.

### The twist (revealed over nights 19–27)
The Moth isn't stealing for gain. It hides **painful** memories (a loss, a shame, a fear) so the dreamer can sleep. The Moth is a Diver too: the first Diver, who once brought back a memory that broke someone, and has been "protecting" people ever since. The clues also suggest that the Moth has hidden one of the player-Diver's own memories, the reason they became a Diver.

### Finale (Night 30): community vote
The finale post asks the subreddit to choose the ending. The vote is open for 24 hours, and the winning ending becomes canon on Night 31, the epilogue card.
- **Return them all.** Give every memory back. The truth hurts, and the city heals.
- **Let them rest.** Leave the hidden memories with the Moth. Mercy has a cost.
- **Carry them together.** Become the Moth's partner: memories are returned slowly, one gentle dream at a time.

### The 30-night arc

Each night gives a dreamer and their life, the dream setting, the stolen memory, the Moth clue, the favoured ability, and the twists for L1 / L2 / L3.

| # | Dreamer | Dream setting | Stolen memory | Moth clue | Favours | Twists (L1 / L2 / L3) |
|---|---|---|---|---|---|---|
| 1 | **Ines Varro**, lighthouse keeper | A lighthouse room above a black sea; tide doors | The night she kept the lamp lit through the storm | Grey wing-dust on the lamp lens | Lantern | Tide doors / Mirror page / Echoes |
| 2 | **Teodor Pell**, night baker | A flour-dusted bakery; ovens glow like suns | His first loaf, burnt, and his father laughing | A folded note: *"Some warmth is worth keeping."* | Still | Rising floor / Swap doors / Echoes |
| 3 | **Mira Okonjo**, bus driver | A night bus whose aisles loop | The last stop she never announced | The Moth rides the back seat in every reflection | Blink | Loop rooms / Mirror page / Echoes |
| 4 | **Aurelio Santi**, retired clockmaker | A clock-tower interior with gears for floors | The day his shop closed | All the clocks stop at 3:12 | Still | Gear turn / Time slip / Echoes |
| 5 | **June Halloran**, librarian | Stacks that rearrange like cards | A letter she never sent | Pages missing from the same book every night | Lantern | Shuffling shelves / Hidden doors / Echoes |
| 6 | **Kofi Mensah**, rooftop gardener | Floating terraces of soil and string lights | His sister's voice singing in the greenhouse | Moth wings pressed in a seed packet | Blink | Vine walls / Gravity tilt / Echoes |
| 7 | **Sunday deep dream: Old Harbour** (all dreamers) | The harbour where Lowmere began; 5 layers | A city-wide memory: the night the harbour lights went out | A map with 7 dreamers' homes circled | Any | Tide doors / Mirror / Loop / Gravity / Echoes |
| 8 | **Priya Raman**, school nurse | A sick-room with paper-cut windows | The child she couldn't help | The Moth leaves a bandage folded into a moth | Still | Swap doors / Soft walls / Echoes |
| 9 | **Bram Dekker**, ferry pilot | A ferry deck that rocks between layers | His first crossing alone | Ferry tickets punched with a wing shape | Blink | Rocking floor / Mirror / Echoes |
| 10 | **Lena Ivers**, violin teacher | A music room where steps play notes | Her last concert | One string replaced with grey silk | Lantern | Note tiles / Silent doors / Echoes |
| 11 | **Hugo Lam**, night guard at the museum | Glass cases and sleeping statues | The theft he was blamed for | The Moth's note quotes the guard's own diary | Still | Watching statues / Mirror / Echoes |
| 12 | **Esme Calder**, mapmaker | A desk-sized city you walk across | The street she erased from her maps | Every map has one street missing: Mothwell Lane | Lantern | Folding map / Hidden doors / Echoes |
| 13 | **Rafi Haddad**, street-food cook | A night market of lantern stalls | His mother's recipe, forgotten | A stall that sells only "unwanted memories" | Blink | Moving stalls / Swap doors / Echoes |
| 14 | **Sunday deep dream: The Lantern Fair** | A fairground of paper lanterns; 5 layers | The night the fair burned | A Diver's lantern, cracked, left in the vault | Any | Loop / Gravity / Mirror / Hidden / Echoes |
| 15 | **Odile Brun**, crossing-keeper at the rail yard | Signal boxes and switching tracks | The train she stopped too late | The Moth switches the tracks *away* from her memory | Still | Track switch / Gravity turn / Echoes |
| 16 | **Tam Nguyen**, swimming coach | A pool hall turned on its side | The race she let her friend win | Wet footprints that don't match any dreamer | Blink | Gravity flip / Mirror / Echoes |
| 17 | **Felix Marr**, sign painter | Giant letters you walk inside | The word he painted wrong on his father's shop | Letters rearranged to spell "LET IT REST" | Lantern | Letter doors / Hidden / Echoes |
| 18 | **Anya Sokol**, astronomer | An observatory floating among stars | The star she discovered, then lost | A star chart with a moth-shaped constellation | Still | Orbit rooms / Loop / Echoes |
| 19 | **Gideon Ash**, retired Diver (first twist) | A Diver's training hall, dusty | His last Dive | *"You and I were trained by the same hands."* | Blink | Mirror / Echo guards early / Echoes ×2 |
| 20 | **Rosa Quint**, flower seller | A greenhouse where vaults bloom everywhere | Her wedding day, which ended badly | Some memories are hidden *with care*, wrapped in petals | Lantern | Bloom doors / Hidden / Echoes |
| 21 | **Sunday deep dream: The Quiet Ward** | A hospital where all dreams meet; 5 layers | The Moth's own first memory, glimpsed | A name tag, half burnt: "D—ver" | Any | All twists |
| 22 | **Wen Li**, translator | Rooms that speak different languages | A phone call she pretended not to understand | The Moth's notes are now addressed to *you* | Blink | Word doors / Mirror / Echoes |
| 23 | **Otto Brandt**, toy repairer | A workbench city of wind-up toys | The toy he broke on purpose | A wind-up moth that walks toward your home | Still | Wind-up floors / Loop / Echoes |
| 24 | **Nell Ferris**, radio host | A studio of humming dials | The listener she couldn't keep on the line | Static spells out your Diver number | Lantern | Frequency doors / Hidden / Echoes |
| 25 | **Isaac Moreau**, beekeeper | A honeycomb of hex rooms | The summer the hives went quiet | The Moth's wings are paper, not dust | Blink | Hex turn / Gravity / Echoes |
| 26 | **Dalia Fenwick**, your own teacher (second twist) | The training hall again, now lit | The day she chose you | *"I hid your first memory so you could keep diving."* | Still | Mirror / Echoes ×2 / Echoes ×3 |
| 27 | **The Moth's dream** | A paper archive of every hidden memory | The Moth's last return, the one that hurt someone | The Moth is the first Diver. It's tired. | Lantern | Every door is hidden / Loop / Echoes of the Moth |
| 28 | **Sunday deep dream: Lowmere asleep** | The whole city as one dream; 5 layers | Fragments of every dreamer's memory | The vault holds 30 paper moths | Any | All twists, harder |
| 29 | **The Diver (you)** | Your own childhood room | Why you became a Diver | Your memory was hidden to protect you | Any | Mirror of your path / Echoes of you / Echoes ×3 |
| 30 | **Finale: The Paper Archive** | The archive, unlocked | (vote) | The community chooses the ending | Any | Vote-shaped ending dream |

### Lighthouse keeper (Night 1): full card and dialogue
**Ines Varro** has kept the Gull Rock light for forty years. She is calm, dry-humoured and proud, and talks to the lamp as if it were a person.

- **Story card scene:** a lighthouse on a black sea, its beam sweeping through a storm, with a small figure at the top.
- **Card lines:** "The storm took the boats' lights first, then the stars. Ines kept the lamp burning until dawn. Four boats came home."
- **Clue:** "On the lamp lens: a smudge of grey wing-dust, like someone had pressed their face to the glass and wept."

**Reactive dialogue** (picked by how you played):

| Play style | Line |
|---|---|
| Fast (lots of time left) | "Quick feet. You'd have made a fine lamp-runner." |
| Slow (little time left) | "Took your time, didn't you? The sea doesn't wait, child." |
| Caught by echoes | "Careful. The past walks right behind you here." |
| Perfect run (Lucid) | "Not a wasted step. The lamp's been waiting for you." |

**Moth note** found on layer 2: *"Some nights are heavy to carry. I was only holding this one for her."*

---

## 2. Abilities

Before each dream the player picks **one** ability. It has **1 charge per layer** and refills when you fall to the next layer. Each daily dream favours one ability (shown as a soft hint on the pick screen: "Ines's dream remembers light..."), but every dream can be solved with any of them.

| Ability | Key | Effect |
|---|---|---|
| **Still** | 1 | Freezes all Echoes for 2 s. Frozen Echoes are harmless and you can walk through them. |
| **Blink** | 2 | Arms a blink: your next step into a wall passes through it, if the tile beyond is free. |
| **Lantern** | 3 | Reveals hidden doors for 3 s. A revealed door stays open for the rest of the layer. |

Abilities live in `src/shared/logic` so the rules are testable and the same on client and server.

---

## 3. Art direction: "moonlit paper dioramas"

- **Form:** floating isometric cut-away rooms, like paper dioramas hanging in a dark sky. Each floor slab has visible paper thickness. The back walls are cut low so you can see in. The edges are crisp and lit from within (a soft inner glow along the top edges).
- **Light:** one soft key light from the moon (upper left) and the Diver's lantern as a warm moving pool of light. Shadows are gentle and offset, never black.
- **Atmosphere:** a vertical sky gradient, sparse twinkling stars, drifting dust motes and slow parallax. A distant dreamer-themed silhouette sits behind the room (for Ines, the lighthouse and its sweeping beam).
- **Layer palettes:**

| Layer | Name | Sky | Paper (top / side) | Glow |
|---|---|---|---|---|
| L1 | Dusk violet | `#120d24` → `#3a2a5e` | `#b9a8e6` / `#5d4b8f` | `#f3d9ff` |
| L2 | Deep teal | `#041c22` → `#0f4a52` | `#8fd6cf` / `#2f7a78` | `#d6fff8` |
| L3 | Ember gold | `#1c0d04` → `#5a2e0c` | `#f2c27a` / `#9a5a22` | `#fff1c9` |

- **Hero:** a small hooded Diver: a soft triangle cloak, a round hood with no face (just a pale glint) and a lantern held out front that sways when walking.
- **Echoes:** translucent copies of the Diver in the layer glow colour, leaving short fading light trails.
- **Each dreamer's dream is themed to their life:** props, silhouettes and palette accents. Ines has rope coils, a brass lamp, gulls and the sea under the island.
- **Typography:** the logo is hand-built letterforms (thin serif, generous tracking). The UI uses the system serif for story text and the system sans for HUD numbers.
- **Not generic:** no glassy cards, no neon gradients, no emoji UI. Paper, light and depth carry the look.

## 4. Animation list

| Moment | Animation | Reduced motion |
|---|---|---|
| Falling a layer | The room **folds like paper** along its middle (top half folds down over the bottom), the folded sheet drops away, dust streams upward, and the next room unfolds from above in the new palette | Crossfade |
| Twist: gravity | The room rotates 90° around its centre with a soft overshoot | Instant swap with a flash |
| Twist: tide doors | Doors **shimmer** (alpha ripple and glow) 0.6 s before they switch | No shimmer, colour change only |
| Twist: mirror | The room turns like a **book page** (scaleX 1 → 0 → 1 with a shading sweep) | Crossfade |
| Echoes | Translucent Divers with fading **light trails** | Trails off |
| The Pull | The **heartbeat ring** pulses faster as time drops. Below 25 % the screen edges darken and soften | No pulse, colour shift only |
| Vault | The vault **opens like a flower**: six paper petals rotate outward, and light rises | Fade open |
| Memory | The orb rises, **blooms** into the story card, and the card unfolds | Fade |
| Wake up | The screen **shatters into paper pieces** that tumble away | Fade to white |
| Micro | Step ripples on the floor, button press squash, light phone vibration (10–20 ms) on steps into walls and on catches | No ripples, no vibration |

## 5. Retention loop

1. **One daily dream** (3–5 min), the same for everyone, generated from the date seed plus the hand-written night list above and the twist catalogue below.
2. **One scored attempt** per day, then unlimited **practice** (practice runs are marked as such and never scored).
3. **1–3 moons per layer.** Moons are based on time left and moves against par.
4. **Lucid badge** for 3 moons on every layer.
5. **Near-miss messages:** "2 seconds from the vault." "One move from three moons."
6. **Streak** of nights played, with a one-day **Night-light** shield earned every 7 nights. The streak shows as user flair ("Diver · 7 nights") where the subreddit allows it.
7. **Memory Wall:** the collection of story cards.
8. **Sunday deep dream:** 5 layers, longer Pull.
9. **Share line**, posted by the player themself as a **reply** under the daily pinned comment, never automatically. Example: "Night 1 · 3 layers · 42 s left · 🌙🌙🌙". The button says plainly that it posts as you.
10. **Tomorrow-twist vote:** pick one of 3 twists for tomorrow's dream.
11. **Finale vote** on Night 30.

### Pull timers
60–90 s per layer, getting shorter as you go deeper (L1 80 s, L2 70 s, L3 60 s for Night 1). Sunday deep dreams use 5 layers of 75–90 s.

### Scoring (computed in shared code)
- A layer earns moons for being cleared: 1 moon, +1 if time left ≥ 40 % of its Pull, +1 if moves ≤ par + 2.
- Score = 1000 × layers cleared + 10 × seconds left (summed) − 5 × moves over par (floor 0) + 250 if Lucid.

## 6. Twist catalogue (at least 30, hand-written; the date seed picks from these)

1. **Tide doors**: doors swap open/closed on a rhythm.
2. **Mirror page**: the floor plan is mirrored and left/right are swapped.
3. **Echoes**: Echoes replay your steps a few seconds behind you.
4. **Gravity tilt**: the room turns 90° every N moves.
5. **Loop rooms**: walking off one edge brings you back on the opposite edge.
6. **Swap doors**: stepping on a glyph swaps two doors.
7. **Hidden doors**: some doors only show in lantern light.
8. **Rising floor**: tiles sink and rise on a slow wave; you can only step on raised tiles.
9. **Time slip**: one tile rewinds the Pull by 5 s, once.
10. **Soft walls**: one wall gives way after two pushes.
11. **Rocking floor**: the room tilts and slides you one tile every 6 s.
12. **Note tiles**: tiles play notes; a matching melody opens the vault.
13. **Silent doors**: doors close while you are moving and open when you stand still.
14. **Watching statues**: statues turn to face you; you can't move in their line of sight while they look.
15. **Folding map**: a fold line moves; tiles beyond the fold are unreachable.
16. **Moving stalls**: blocks slide one tile each time you move.
17. **Track switch**: a lever changes which corridors connect.
18. **Gravity flip**: up and down are swapped.
19. **Letter doors**: doors open in the order of a word.
20. **Orbit rooms**: the outer ring of tiles rotates one step every 4 moves.
21. **Word doors**: doors open only after you've visited a matching glyph.
22. **Wind-up floors**: some tiles carry you two steps.
23. **Frequency doors**: doors open while the Pull ring is in a certain phase.
24. **Hex turn**: the movement directions rotate after each Drop.
25. **Bloom doors**: doors open after an Echo passes through them.
26. **Double echo**: two Echoes at different delays.
27. **Fog**: you only see tiles within 2 of your lantern.
28. **Shrinking room**: the outer ring crumbles away at half time.
29. **Echo key**: the memory key moves along your old path.
30. **Quiet vault**: the vault opens only if no Echo has touched you.
31. **Paper wind**: a gust pushes you one tile in a fixed direction every 8 s.
32. **Lamp tiles**: dark tiles are passable only while your lantern is lit.

## 7. Audio (all generated with the Web Audio API)

- **Ambient pad:** two detuned triangle oscillators through a low-pass filter with a slow LFO. The chord changes per layer (L1 minor, L2 suspended, L3 major).
- **Footsteps:** short band-passed noise bursts with slight pitch variation.
- **Heartbeat:** two low sine thumps, faster as the Pull closes; it starts below 30 %.
- **UI:** a soft paper flick for buttons, a glassy chime for the Drop, a rising bell bloom for the vault, and breaking-paper noise for the wake-up.
- **Mute** button, remembered per viewer (try/catch localStorage). Audio starts only after the first tap (browser autoplay rules).

## 8. Characters that feel alive

- Each dreamer has a personality and **pre-written** reactive lines for four play styles: fast, slow, caught, perfect.
- **Moth notes** appear as paper tiles in some layers; stepping on one shows its line.
- **No live AI calls.** An optional hint helper could be added later only if Devvit's rules allow it (only approved LLMs via HTTP fetch, after app review, with our own terms and privacy policy). The dialogue system is a simple lookup `dreamer → style → line`, so a helper could slot in behind the same interface.

## 9. Controls

| Device | In the feed (inline post) | Fullscreen (expanded) |
|---|---|---|
| Touch | Tap only: a big "Enter the dream" button, no gestures (so the feed keeps scrolling) | Swipe to move, plus an on-screen tap pad; tap the ability button |
| Keyboard | n/a | Arrows / WASD to move; 1 / 2 / 3 abilities; Space uses the picked ability; M mutes |
| Gamepad | n/a | D-pad / left stick to move; A uses the ability; Start pauses |

## 10. Onboarding (10 seconds)
Three quick panels over the first layer, auto-advancing every 3 s (tap to skip):
1. "Swipe or use the arrow keys to walk."
2. "Find the glowing Drop to fall deeper. Steal the memory from the vault on layer 3."
3. "The ring is the Pull. When it closes, you wake."

## 11. Languages
English first. Every string lives in `src/client/i18n/en.ts`, keyed by id. Chinese, Japanese and Hindi files can be added with the same keys once the core game is done.

## 12. Performance budget
- Target 60 fps on a mid laptop and ≥ 30 fps on a Redmi 15C and Intel HD 520.
- **Low quality mode** (automatic on ≤ 4 cores or ≤ 4 GB device memory, toggle in the menu): particles capped at 16 (High: 60), no camera filters, render resolution 1×.
- Textures are baked once at boot (glows drawn into canvas textures, not live filters).
- `prefers-reduced-motion`: no folds, shakes, ripples or trails; crossfades instead.
