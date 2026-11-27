// Real Reddit screenshots for the demo video, taken in the owner's own logged-in Chrome profile at
// phone size. Never types a password; stops if Reddit shows a human check. Uses a PRACTICE run only.
//
//   CHROME_PROFILE_COPY=<temp folder holding "Local State" + "Profile 2/{Network,Local Storage,Preferences}">
//   PLAYWRIGHT_FROM=<folder with playwright> node scripts/video/reddit-shots.mjs [probe|feed|game|thread]
//
// Output: docs/video/real/{feed,title,play,thread,leaderboard}.png
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = `${ROOT}/docs/video/real`;
mkdirSync(OUT, { recursive: true });
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM ?? ROOT, 'package.json'));
const { chromium } = require('playwright');
const STEP = process.argv[2] ?? 'probe';
const SUB = 'https://www.reddit.com/r/MaistHeist/new/'; // newest first: tonight's post on top
const SCRATCH = process.env.SCRATCH ?? OUT;

const ctx = await chromium.launchPersistentContext(process.env.CHROME_PROFILE_COPY, {
  channel: 'chrome',
  headless: false,
  args: ['--profile-directory=Profile 2'],
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  // Phone-sized window with Chrome's own identity: a phone user agent makes Reddit's mobile web
  // redirect to the app store, while this gets the responsive phone layout.
  hasTouch: true,
});
const page = ctx.pages()[0] ?? (await ctx.newPage());

async function humanCheck() {
  const t = `${await page.title()} ${await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? '')}`;
  const blocked = (s) => /prove your humanity|are you a robot|verify you are human|select all images/i.test(s);
  // a challenge counts only when it is visible (Reddit preloads a hidden reCAPTCHA for its login form)
  const visibleChallenge = () =>
    page.evaluate(() => [...document.querySelectorAll('iframe')].some((f) => /captcha|challenge/i.test(f.src + f.title) && f.getBoundingClientRect().width > 150 && f.getBoundingClientRect().height > 150));
  if (blocked(t) || (await visibleChallenge())) {
    await page.screenshot({ path: `${SCRATCH}/human-check.png` });
    if (!process.env.WAIT_HUMAN) {
      console.log('HUMAN CHECK: Reddit is asking to prove you are human. Stopping.');
      await ctx.close();
      process.exit(2);
    }
    // The owner solves it in the visible window; this only waits (up to 15 minutes) and never touches it.
    console.log('HUMAN CHECK: waiting for you to solve it in the Chrome window...');
    const until = Date.now() + 15 * 60_000;
    for (;;) {
      await page.waitForTimeout(3000);
      const now = `${await page.title().catch(() => '')} ${await page.evaluate(() => document.body?.innerText?.slice(0, 2000) ?? '').catch(() => '')}`;
      const challenge = await visibleChallenge().catch(() => false);
      if (!blocked(now) && !challenge) break;
      if (Date.now() > until) {
        console.log('HUMAN CHECK: still not solved after 15 minutes. Stopping.');
        await ctx.close();
        process.exit(2);
      }
    }
    console.log('HUMAN CHECK: solved, continuing.');
    await page.waitForTimeout(4000);
  }
}

/** The Devvit web view frame for the game (feed card or expanded), or null. */
function gameFrame(sel) {
  return (async () => {
    for (const f of page.frames()) {
      try {
        if (await f.locator(sel).count()) return f;
      } catch {
        /* frame went away */
      }
    }
    return null;
  })();
}

await page.goto(SUB, { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(6000);
await humanCheck();

const loggedIn = () => page.evaluate(() => !/\bLog In\b/.test(document.querySelector('header, reddit-header-large, shreddit-app')?.innerText?.slice(0, 3000) ?? document.body.innerText.slice(0, 3000)));
console.log('logged in:', await loggedIn());

if (STEP === 'probe') {
  const titles = await page.evaluate(() => [...document.querySelectorAll('shreddit-post, article')].map((p) => p.getAttribute('post-title') ?? p.innerText.split('\n')[0]).slice(0, 8));
  console.log('posts:', titles);
  await page.screenshot({ path: `${SCRATCH}/probe.png` });
}

if (STEP === 'login') {
  // The owner logs in themselves in the visible window; this only waits for it (up to 10 minutes).
  await page.goto('https://www.reddit.com/login/', { waitUntil: 'domcontentloaded' });
  console.log('LOGIN: please log in to Reddit in the Chrome window...');
  const until = Date.now() + 10 * 60_000;
  for (;;) {
    await page.waitForTimeout(3000);
    const ok = await page.evaluate(() => !location.pathname.startsWith('/login') && !/\bLog In\b/.test(document.body.innerText.slice(0, 3000))).catch(() => false);
    if (ok) break;
    if (Date.now() > until) {
      console.log('LOGIN: not logged in after 10 minutes. Stopping.');
      break;
    }
  }
  await page.goto(SUB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  console.log('logged in:', await loggedIn());
}

/** Newest heist post card in the feed: scroll it into view. */
let tonight = 0;
async function newestCard() {
  // tonight's post = the highest night number (Reddit can show an older "Happening now" post first)
  const night = await page.evaluate(() =>
    Math.max(...[...document.querySelectorAll('shreddit-post')].map((p) => Number(/Night (\d+)/.exec(p.getAttribute('post-title') ?? '')?.[1] ?? 0)))
  );
  console.log('tonight is Night', night);
  tonight = night;
  const post = page.locator(`shreddit-post[post-title*="Night ${night} ·"]`).first();
  await post.scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -90));
  await page.waitForTimeout(5000);
  return post;
}

if (STEP === 'feed' || STEP === 'all') {
  await newestCard();
  await page.screenshot({ path: `${OUT}/feed.png` });
  console.log('feed.png');
}

if (STEP === 'game' || STEP === 'all') {
  await page.goto(SUB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  await newestCard();
  // the card frame for tonight's post (an older "Happening now" card can be on the page too)
  let card = null;
  for (const f of page.frames()) {
    try {
      if ((await f.locator('#night').count()) && (await f.locator('#night').innerText()).includes(`NIGHT ${tonight}`)) card = f;
    } catch {
      /* frame went away */
    }
  }
  if (!card) throw new Error('feed card not found');
  await card.locator('#go').click();
  // expanded mode: the game opens in its own web view
  let game = null;
  for (let k = 0; k < 30 && !game; k++) {
    await page.waitForTimeout(1000);
    game = await gameFrame('main.title-screen');
  }
  if (!game) throw new Error('game did not open');
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/title.png` });
  console.log('title.png; scored run available:', await game.locator('text=Start tonight’s heist').count());
  // leaderboard
  await game.locator('.links .link', { hasText: 'Leaderboard' }).first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/leaderboard.png` });
  console.log('leaderboard.png');
  await game.locator('.modal .btn', { hasText: 'Close' }).click().catch(() => {});
  await page.waitForTimeout(800);
  // PRACTICE run only: never the scored "Start tonight's heist"
  await game.locator('text=Practice run').first().click();
  await page.waitForTimeout(2500);
  for (let k = 0; k < 4; k++) {
    const move = game.locator('.tile.move').first();
    if (!(await move.count())) break;
    await move.click();
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/play.png` });
  console.log('play.png (practice)');
}

if (STEP === 'thread' || STEP === 'all') {
  await page.goto(SUB, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(5000);
  const post = await newestCard();
  const href = await post.getAttribute('permalink');
  await page.goto(new URL(href, 'https://www.reddit.com').href, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(6000);
  const c = page.locator('shreddit-comment').first();
  if (await c.count()) {
    await c.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -140));
  }
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/thread.png` });
  console.log('thread.png', href);
}

await ctx.close();
