// Records the demo-video gameplay: the built client (dist/client served on BASE) in a 390x844 phone
// viewport, driven by Playwright with a stand-in server. Every tap shows a teal ripple; every action is
// logged with its time so the edit can cut scenes and place sound effects.
//
//   python -m http.server 4174 --directory dist/client      (in another terminal)
//   PLAYWRIGHT_FROM=<a folder whose package.json has playwright> node --experimental-strip-types scripts/video/record.mjs
//
// Frames come from Chrome's screencast at full device resolution (780x1688), with their own timestamps,
// and are assembled into a 30 fps MP4 (Playwright's built-in video shrinks the page and pads it).
// Output: docs/video/rec/<session>.mp4 + <session>.json (events on the same clock as the video).
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync, existsSync, rmSync, linkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { E, bfs, planNight } from './plan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const S = await import(`file:///${ROOT}/src/shared/logic/season.ts`);
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM ?? ROOT, 'package.json'));
const { chromium } = require('playwright');
const BASE = process.env.BASE ?? 'http://127.0.0.1:4174';
const OUT = `${ROOT}/docs/video/rec`;
mkdirSync(OUT, { recursive: true });
const ONLY = process.argv[2] ?? '';

const NIGHT = Number(process.env.NIGHT ?? 19);
const plan = planNight(NIGHT);
if (!plan) throw new Error(`night ${NIGHT} cannot fit the script`);
const heist = E.buildHeist(NIGHT);
const ghostL3 = [0, 1, 2].map((o) => bfs(E.newLayerState(heist.layers[2]), o, (n) => n.status === 'cleared', heist.layers[2].ap)).find(Boolean)?.path ?? [];
const W = { t: 'w' };
const ghostRecord = { v: 1, layers: [[W, W, ...plan.l1], [W, W, ...plan.l2], [W, W, ...ghostL3]] };

// ------------------------------------------------------------------ stand-in server
function mockServer(ctx, state) {
  return ctx.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const json = (b) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
    const p = url.pathname;
    if (p.endsWith('/api/init'))
      return json({
        type: 'init',
        postId: 't3_demo',
        username: 'Dangerous_Lie_7980',
        snoovatar: null,
        loggedIn: true,
        postNight: NIGHT,
        today: NIGHT,
        scored: null,
        streak: { count: 4, best: 6, lastNight: NIGHT - 1 },
        kicks: { granted: 0, asked: false },
        crews: 37,
        history: [
          { night: NIGHT - 2, score: 1950 },
          { night: NIGHT - 1, score: 2150 },
          { night: NIGHT, score: null },
        ],
        nextMs: S.msUntilNextDream(),
        subreddit: 'MaistHeist',
        joined: false,
      });
    if (p.endsWith('/api/ghost')) return json({ ok: true, night: NIGHT, name: 'NightOwl_42', record: ghostRecord });
    if (p.endsWith('/api/run')) {
      const body = JSON.parse(route.request().postData() ?? '{}');
      const r = E.replay(heist, body.record);
      state.score = r.ok ? E.totalScore(r.results) : 0;
      return json({ type: 'run', scored: !!body.scored, score: state.score, results: r.ok ? r.results : [], rank: 3, streak: { count: 5, best: 6, lastNight: NIGHT } });
    }
    if (p.endsWith('/api/limbo')) {
      state.kickCalls = 0;
      return json({ ok: true, message: 'Your call for help is posted under the crew thread.' });
    }
    if (p.endsWith('/api/kick')) {
      state.kickCalls = (state.kickCalls ?? 0) + 1;
      // the fake "WAKE UP" reply arrives on the second check
      return json({ granted: state.kickCalls >= 2 ? 1 : 0, asked: true });
    }
    if (p.endsWith('/api/leaderboard')) {
      const me = { rank: 3, name: 'Dangerous_Lie_7980', score: state.score ?? 2100, snoovatar: null, me: true };
      const rows = [
        { rank: 1, name: 'NightOwl_42', score: 2450, snoovatar: null, me: false },
        { rank: 2, name: 'quiet_fox', score: 2300, snoovatar: null, me: false },
        me,
        { rank: 4, name: 'PaperLantern', score: Math.min(2050, (state.score ?? 2100) - 40), snoovatar: null, me: false },
        { rank: 5, name: 'vault_breaker', score: Math.min(1900, (state.score ?? 2100) - 110), snoovatar: null, me: false },
        { rank: 6, name: 'mothwatcher', score: 1750, snoovatar: null, me: false },
      ];
      return json({ night: NIGHT, rows, me, total: 37 });
    }
    if (p.endsWith('/api/share')) return json({ ok: true, message: 'Shared to the crew thread.' });
    if (p.endsWith('/api/join')) return json({ ok: true });
    return route.fulfill({ status: 404, body: '' });
  });
}

// ------------------------------------------------------------------ recording helpers
const RIPPLE = `
(() => {
  const css = document.createElement('style');
  css.textContent = '@keyframes __rip{0%{transform:scale(.25);opacity:1}100%{transform:scale(1.5);opacity:0}}' +
    '@keyframes __dot{0%{opacity:1}100%{opacity:0}}';
  const add = () => document.head.append(css);
  if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  window.__tap = (x, y) => {
    const r = document.createElement('div');
    r.style.cssText = 'position:fixed;left:' + (x - 30) + 'px;top:' + (y - 30) + 'px;width:60px;height:60px;border-radius:50%;' +
      'border:3px solid #0B7FA3;background:rgba(11,127,163,.22);pointer-events:none;z-index:2147483647;animation:__rip .55s ease-out forwards';
    const d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:' + (x - 9) + 'px;top:' + (y - 9) + 'px;width:18px;height:18px;border-radius:50%;' +
      'background:rgba(11,127,163,.75);box-shadow:0 0 0 3px rgba(255,255,255,.8);pointer-events:none;z-index:2147483647;animation:__dot .5s ease-in forwards';
    document.body.append(r, d);
    setTimeout(() => { r.remove(); d.remove(); }, 700);
  };
})();`;

/**
 * In-page event log on the browser's clock (the same clock as the screencast frames), so the edit and
 * the sound effects line up with what is on screen, not with when the driver sent a tap.
 */
const PAGE_LOG = `
(() => {
  const ev = (window.__ev = []);
  const now = () => (performance.timeOrigin + performance.now()) / 1000;
  const add = (type, label = '') => ev.push({ t: now(), type, label });
  const seen = new WeakSet();
  const scan = (n) => {
    if (!(n instanceof Element)) return;
    const one = (sel, type) => { for (const e of [n, ...n.querySelectorAll(sel)]) if (e.matches?.(sel) && !seen.has(e)) { seen.add(e); add(type); } };
    one('.slip-ping', 'p:slip');
    one('.limbo-box', 'p:adrift');
    one('.cleared', 'p:cleared');
    one('main.results', 'p:results');
    one('.board-list .lb-row', 'p:board');
    one('p.joined', 'p:joined');
    one('main.play', 'p:layer');
    one('main.title-screen', 'p:title');
  };
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === 'childList') {
        m.addedNodes.forEach(scan);
        if (m.target instanceof Element && m.target.matches('.modal p.small') && /Pull received|\\+6 AP/.test(m.target.textContent)) add('p:pull-got');
      } else if (m.type === 'attributes') {
        const el = m.target;
        if (m.attributeName === 'data-x' || m.attributeName === 'data-y') {
          if (el.classList.contains('op') && !el.classList.contains('ghost') && m.oldValue !== null && m.oldValue !== el.getAttribute(m.attributeName)) add('p:step');
        } else if (m.attributeName === 'class') {
          const was = m.oldValue ?? '';
          const has = (c) => el.classList.contains(c) && !was.split(' ').includes(c);
          if (el.classList.contains('op') && !el.classList.contains('ghost') && has('faded')) add('p:ability', 'fade');
          if (el.classList.contains('guard') && has('stunned')) add('p:ability', 'haze');
          if (el.classList.contains('tile') && was.split(' ').includes('wall') && !el.classList.contains('wall') && !el.classList.contains('fog')) add('p:ability', 'fold');
          if (el.classList.contains('op') && !el.classList.contains('ghost') && has('spotted')) add('p:caught');
        }
      }
    }
  }).observe(document, { subtree: true, childList: true, attributes: true, attributeOldValue: true, attributeFilter: ['class', 'data-x', 'data-y'] });
})();`;

const browser = await chromium.launch({ channel: 'chrome', headless: false });

async function session(name, theme, fn, ghost = false) {
  if (ONLY && ONLY !== name) return;
  const dir = `${OUT}/${name}-frames`;
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  await ctx.addInitScript(
    ([th, gh]) => {
      localStorage.setItem('heist.prefs', JSON.stringify({ theme: th, ghost: gh, bigText: false, smooth: 'off' }));
      localStorage.setItem('maist.settings.v2', JSON.stringify({ onboarded: true, sfx: 0, music: 0 }));
      localStorage.setItem('heist.lang', 'en');
      localStorage.setItem('heist.tutorialDone', '1');
    },
    [theme, ghost]
  );
  await ctx.addInitScript(RIPPLE);
  await ctx.addInitScript(PAGE_LOG);
  const state = {};
  await mockServer(ctx, state);
  const page = await ctx.newPage();
  const events = [];
  const frames = [];
  // events and frames share one clock (seconds since the epoch); both are made relative to the first frame
  const log = (type, label = '') => events.push({ t: Date.now() / 1000, type, label });
  const cdp = await ctx.newCDPSession(page);
  let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const file = `${dir}/${String(n++).padStart(6, '0')}.jpg`;
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, ts: f.metadata.timestamp });
    try {
      await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId });
    } catch {
      /* page closing */
    }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${BASE}/game.html`);
  await page.waitForTimeout(1200);
  const d = driver(page, log);
  await fn(d, page, log);
  await page.waitForTimeout(800);
  log('end');
  // what the page saw, on the browser's clock
  events.push(...(await page.evaluate(() => window.__ev ?? [])));
  events.sort((a, b) => a.t - b.t);
  await cdp.send('Page.stopScreencast');
  await ctx.close();
  // frames -> constant 30 fps MP4: output frame k shows the latest capture at or before t0 + k/30.
  // (ffmpeg's concat input would give every capture at least 1/25 s and stretch the video.)
  frames.sort((a, b) => a.ts - b.ts);
  const t0 = frames[0].ts;
  const end = Math.max(...events.map((e) => e.t), frames.at(-1).ts);
  const cfr = `${dir}/cfr`;
  mkdirSync(cfr);
  let j = 0;
  const total = Math.floor((end - t0) * 30) + 1;
  for (let k = 0; k < total; k++) {
    const t = t0 + k / 30;
    while (j + 1 < frames.length && frames[j + 1].ts <= t) j++;
    linkSync(frames[j].file, `${cfr}/${String(k).padStart(6, '0')}.jpg`);
  }
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '30', '-i', `${cfr}/%06d.jpg`, '-vf', 'scale=584:1264:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-crf', '16', '-preset', 'medium', `${OUT}/${name}.mp4`]);
  rmSync(dir, { recursive: true, force: true });
  for (const e of events) e.t = Math.round((e.t - t0) * 1000) / 1000;
  writeFileSync(`${OUT}/${name}.json`, JSON.stringify({ name, night: NIGHT, video: `${name}.mp4`, frames: frames.length, events, errors }, null, 1));
  console.log(`${name}: ${frames.length} frames, ${events.length} events, ${(end - t0).toFixed(1)} s${errors.length ? `, PAGE ERRORS: ${errors.join(' | ')}` : ''}`);
}

function driver(page, log) {
  const d = {
    sel: 0,
    s: null,
    async tapAt(x, y) {
      await page.evaluate(([x, y]) => window.__tap(x, y), [x, y]);
      await page.waitForTimeout(110);
      await page.touchscreen.tap(x, y);
      log('tap');
    },
    async tap(locator) {
      const b = await locator.first().boundingBox();
      if (!b) throw new Error(`nothing to tap: ${locator}`);
      await d.tapAt(b.x + b.width / 2, b.y + b.height / 2);
    },
    async tile(x, y) {
      const b = await page.evaluate((i) => {
        const r = document.querySelectorAll('.board .tile')[i]?.getBoundingClientRect();
        return r && { x: r.x + r.width / 2, y: r.y + r.height / 2 };
      }, y * 10 + x);
      await d.tapAt(b.x, b.y);
    },
    async select(o) {
      if (d.sel === o) return;
      await d.tap(page.locator('.op-card').nth(o));
      d.sel = o;
      await page.waitForFunction((i) => document.querySelectorAll('.op-card')[i]?.classList.contains('sel'), o, { timeout: 4000 });
      await page.waitForTimeout(200);
    },
    ap: () => page.evaluate(() => document.querySelector('.ap-num')?.textContent ?? ''),
    async apChange(before) {
      await page.waitForFunction((b) => document.querySelector('.ap-num')?.textContent !== b, before, { timeout: 4000 }).catch(() => {});
    },
    /** One engine action, performed by tapping like a player would. */
    async act(a, gap = 420) {
      // each tap waits until the game shows its result, so the pacing follows the screen
      if (a.t === 'm') {
        await d.select(a.o);
        const op = d.s.ops[a.o];
        const [dx, dy] = E.DIRS[a.d];
        const nx = op.x + dx;
        const ny = op.y + dy;
        await d.tile(nx, ny);
        log('step', `${a.o}${a.d}`);
        await page
          .waitForFunction(([i, x, y]) => {
            const el = document.querySelectorAll('.board .op:not(.ghost)')[i];
            return el && el.dataset.x === String(x) && el.dataset.y === String(y);
          }, [a.o, nx, ny], { timeout: 4000 })
          .catch(() => {});
      } else if (a.t === 'w') {
        const before = await d.ap();
        await d.tap(page.locator('.act-row .btn', { hasText: 'Wait' }));
        log('wait');
        await d.apChange(before);
      } else if (a.t === 'a') {
        await d.select(a.o);
        const before = await d.ap();
        await d.tap(page.locator('.ability-btn'));
        const ability = E.SQUAD[a.o].ability;
        if (ability !== 'fade') {
          await page.waitForSelector('.tile.target', { timeout: 4000 }).catch(() => {});
          await page.waitForTimeout(300);
          await d.tile(a.x, a.y);
        }
        log('ability', ability);
        await d.apChange(before);
        gap = Math.max(gap, 900);
      }
      d.s = E.apply(d.s, a);
      if (d.s.justSlipped) log('slip');
      if (d.s.lastCaught.length) log('caught');
      await page.waitForTimeout(gap);
    },
    async play(acts, gap) {
      for (const a of acts) await d.act(a, gap);
    },
    startLayer(def) {
      d.s = E.newLayerState(def);
      d.sel = 0;
    },
    async next() {
      await page.waitForTimeout(700);
      await d.tap(page.locator('.modal .btn.primary'));
      await page.waitForTimeout(1500);
    },
  };
  return d;
}

// ------------------------------------------------------------------ session A: the crew's abilities (practice, layer 1)
await session('abilities', 'light', async (d, page, log) => {
  await page.waitForTimeout(400);
  await d.tap(page.locator('text=Practice run'));
  await page.waitForTimeout(1300);
  d.startLayer(heist.layers[0]);
  log('layer', '1');
  const { acts, beats } = plan.abilities;
  for (let i = 0; i < acts.length; i++) {
    if (i === beats.fold) log('beat', 'fold');
    if (i === beats.fade) log('beat', 'fade');
    if (i === beats.haze) log('beat', 'haze');
    await d.act(acts[i], 480);
  }
  await page.waitForTimeout(900);
});

// ------------------------------------------------------------------ session B: the scored run
await session('run', 'light', async (d, page, log) => {
  log('title');
  await page.waitForTimeout(1600);
  await d.tap(page.locator('text=Start tonight’s heist'));
  await page.waitForTimeout(1300);
  // layer 1: past the red beams
  d.startLayer(heist.layers[0]);
  log('layer', '1');
  await d.play(plan.l1, 400);
  log('cleared', '1');
  await d.next();
  // layer 2: the vault slips; the ghost of tonight's #1 trails along
  d.startLayer(heist.layers[1]);
  log('layer', '2');
  await d.play(plan.l2, 380);
  log('cleared', '2');
  await d.next();
  // layer 3: adrift, ask the thread, WAKE UP, the Pull, finish
  d.startLayer(heist.layers[2]);
  log('layer', '3');
  await d.play(plan.l3.before, 300);
  await page.waitForSelector('.limbo-box', { timeout: 5000 });
  log('adrift');
  await page.waitForTimeout(1300);
  await d.tap(page.locator('.modal .btn.primary'));
  log('ask');
  await page.waitForFunction(() => document.querySelector('.modal .btn.primary')?.textContent === 'Wake up!', null, { timeout: 30000 });
  log('pull-got');
  await page.waitForTimeout(1600);
  await d.tap(page.locator('.modal .btn.primary'));
  log('pull-used');
  d.s = E.apply(d.s, { t: 'kick' });
  d.sel = d.s.ops.findIndex((o) => !o.out);
  await page.waitForTimeout(900);
  await d.play(plan.l3.after, 450);
  log('cleared', '3');
  await page.waitForTimeout(700);
  await d.tap(page.locator('.modal .btn.primary'));
  await page.waitForSelector('.results .score', { timeout: 10000 });
  log('results');
  await page.waitForTimeout(2600);
  await d.tap(page.locator('.results .links .link', { hasText: 'Leaderboard' }));
  await page.waitForSelector('.lb-row', { timeout: 5000 });
  log('board');
  await page.waitForTimeout(2600);
  await d.tap(page.locator('.modal .btn', { hasText: 'Close' }));
  await page.waitForTimeout(700);
  await d.tap(page.locator('.results .btn.primary'));
  log('join');
  await page.waitForTimeout(2200);
}, true);

// ------------------------------------------------------------------ session C: night mode, 5 languages, Smooth mode
await session('montage', 'dark', async (d, page, log) => {
  await page.waitForTimeout(500);
  await d.tap(page.locator('text=Practice run'));
  await page.waitForTimeout(1300);
  d.startLayer(heist.layers[0]);
  log('night');
  await d.play(plan.l1.slice(0, 5), 380);
  await d.tap(page.locator('.act-row .btn[aria-label="Settings"]'));
  await page.waitForTimeout(500);
  log('langs');
  for (const lang of ['zh', 'ja', 'de', 'hi', 'en']) {
    await page.locator('.modal select.lang').selectOption(lang);
    log('lang', lang);
    await page.waitForTimeout(650);
  }
  log('smooth');
  await d.tap(page.locator('.modal .set-row', { hasText: 'Smooth mode' }).locator('.seg-btn', { hasText: 'On' }));
  await page.waitForTimeout(600);
  await d.tap(page.locator('.modal .btn', { hasText: 'Close' }));
  await page.waitForTimeout(500);
  await d.play(plan.l1.slice(5, 9), 380);
  await page.waitForTimeout(600);
});

await browser.close();
