// Builds the demo video from the recordings (scripts/video/record.mjs), the narration
// (scripts/video/voiceover.py), the real Reddit screenshots (docs/video/real/*.png) and a music track.
//
//   PLAYWRIGHT_FROM=<folder with playwright> MUSIC=<path to mp3> node --experimental-strip-types scripts/video/compose.mjs [main|teaser|stills|all]
//
// Output: docs/video/maist-demo.mp4 (1920x1080, < 58 s), docs/video/maist-teaser-vertical.mp4 (1080x1920, 15 s),
// docs/devpost/still-*.png, docs/video/frames-check/*.png.
import { createRequire } from 'node:module';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const VID = `${ROOT}/docs/video`;
const REC = `${VID}/rec`;
const WORK = `${VID}/work`;
const REAL = `${VID}/real`;
const require = createRequire(path.join(process.env.PLAYWRIGHT_FROM ?? ROOT, 'package.json'));
const { chromium } = require('playwright');
const MUSIC = process.env.MUSIC ?? `${VID}/music.mp3`;
const WHAT = process.argv[2] ?? 'all';
const FPS = 30;

const { E } = await import(pathToFileURL(`${ROOT}/scripts/video/plan.mjs`).href);
const logs = Object.fromEntries(['abilities', 'run', 'montage'].map((n) => [n, JSON.parse(readFileSync(`${REC}/${n}.json`, 'utf8'))]));
const vo = JSON.parse(readFileSync(`${VID}/vo/lines.json`, 'utf8'));
/** Time of the first logged event of a type (and label) in a recording. */
function mark(clip, type, label) {
  const e = logs[clip].events.find((x) => x.type === type && (label === undefined || x.label === label));
  if (!e) throw new Error(`no ${type} ${label ?? ''} in ${clip}`);
  return e.t;
}
const real = (f) => (existsSync(`${REAL}/${f}`) ? pathToFileURL(`${REAL}/${f}`).href : null);

// ------------------------------------------------------------------ the timeline (57.6 s)
const seg = (clip, a, b, speed = 1) => ({ clip, a, b, speed });
const M = {
  title: mark('run', 'title'),
  l1: mark('run', 'layer', '1'),
  c1: mark('run', 'cleared', '1'),
  slip: mark('run', 'p:slip'),
  c2: mark('run', 'cleared', '2'),
  adrift: mark('run', 'p:adrift'),
  ask: mark('run', 'ask'),
  got: mark('run', 'p:pull-got'),
  used: mark('run', 'pull-used'),
  results: mark('run', 'p:results'),
  board: mark('run', 'p:board'),
  join: mark('run', 'join'),
  fold: mark('abilities', 'beat', 'fold'),
  foldA: mark('abilities', 'p:ability', 'fold'),
  fade: mark('abilities', 'p:ability', 'fade'),
  haze: mark('abilities', 'beat', 'haze'),
  hazeA: mark('abilities', 'p:ability', 'haze'),
  night: mark('montage', 'night'),
  langs: mark('montage', 'langs'),
  en: mark('montage', 'lang', 'en'),
  smooth: mark('montage', 'smooth'),
};
// Zoom focus for the slip: halfway between the old vault and where it reappears (board ~ x 4-97%, y 24-67% of the screen)
const L2 = E.buildHeist(logs.run.night).layers[1];
const onScreen = ([x, y]) => [(16 + (x + 0.5) * 36.2) / 390, (200 + (y + 0.5) * 36.2) / 844];
const [v1x, v1y] = onScreen(L2.vault);
const [v2x, v2y] = onScreen(L2.vault2 ?? L2.vault);
const SLIP_FOCUS = { fx: (v1x + v2x) / 2, fy: (v1y + v2y) / 2 };
const CAPS = [
  { id: 'feed', kicker: 'LIVE ON REDDIT', title: 'Maist: <em>The Daily Heist</em>', body: 'A new heist every day on Reddit' },
  { id: 'start', kicker: 'HOW IT WORKS', title: '3 dream layers.', body: '<em>One shared pool of moves.</em>' },
  { id: 'crew', kicker: 'THE CREW', title: 'Meet the crew', chips: ['Vale<small>folds walls open</small>', 'Wren<small>fades from sight</small>', 'Oto<small>puts guards to sleep</small>'] },
  { id: 'guards', kicker: 'STEALTH', title: 'Sneak past <em>security bots</em>', body: 'Stay out of the red beams' },
  { id: 'slip', kicker: 'THE TWIST', title: 'The vault <em>slips!</em>', body: 'Find it again' },
  { id: 'ghost', kicker: 'GHOST RACE', title: 'Race tonight’s <em>#1 player’s ghost</em>', body: 'Their best run replays beside you' },
  { id: 'pull', kicker: 'PLAY WITH FRIENDS', title: 'Friends <em>rescue you</em>', body: 'by replying WAKE UP' },
  { id: 'results', kicker: 'COMPETE', title: 'Daily leaderboard <em>+ streaks</em>', body: 'One scored run per night 🔥' },
  { id: 'montage', kicker: 'FOR EVERY PLAYER', title: 'Made for every phone', chips: ['White & night themes', '5 languages', 'Smooth on phones'] },
  { id: 'end', kicker: '', title: '' },
];
// scene: [start, end], caption, recording segments (played back to back), optional zoom/card/feed
// 54.0 s in all (hard limit 54.5 s). Walking plays at 1.3x at most; scenes are filled exactly.
const MAIN = [
  { t: [0, 4], cap: 'feed', feed: 'feed.png', zoom: { to: 1.06, fx: 0.5, fy: 0.3 }, fallback: [seg('run', M.title - 0.2, M.title + 3.8)] },
  { t: [4, 9], cap: 'start', segs: [seg('run', M.title + 0.3, M.title + 5.3)] },
  {
    t: [9, 16],
    cap: 'crew',
    segs: [seg('abilities', M.foldA - 1.0, M.foldA + 1.2), seg('abilities', M.fade - 0.5, M.fade + 1.9), seg('abilities', M.hazeA - 1.2, M.hazeA + 1.2)],
    chips: true,
    zoom: { to: 1.22, fx: 0.25, fy: 0.42 },
  },
  { t: [16, 21], cap: 'guards', segs: [seg('run', M.l1 + 0.3, M.l1 + 0.3 + 6.5, 1.3)] },
  // the slip itself plays at half speed so the poof and the one-turn gold ping can be seen
  { t: [21, 27], cap: 'slip', segs: [seg('run', M.slip - 3.0, M.slip - 0.25), seg('run', M.slip - 0.25, M.slip + 1.35, 0.5)], zoom: { to: 1.14, ...SLIP_FOCUS } },
  { t: [27, 32], cap: 'ghost', segs: [seg('run', M.slip + 2.6, M.slip + 2.6 + 6.5, 1.3)] },
  {
    t: [32, 39],
    cap: 'pull',
    segs: [seg('run', M.adrift - 0.4, M.ask + 1.2), seg('run', M.got - 0.3, M.used + 2.0, 1.25)],
    card: { file: 'thread.png', from: 33.0, note: 'The pinned crew thread on r/MaistHeist: a reply there sends the Pull.' },
    bubble: [34.6, 37.4],
  },
  {
    t: [39, 45],
    cap: 'results',
    segs: [seg('run', M.results - 0.1, M.results + 2.4), seg('run', M.board + 0.6, M.board + 2.4), seg('run', M.join - 0.3, M.join + 1.2)],
    card: { file: 'leaderboard.png', from: 39.6, note: 'The real leaderboard, inside Reddit.' },
  },
  {
    t: [45, 50],
    cap: 'montage',
    segs: [seg('montage', M.night + 0.3, M.night + 1.8), seg('montage', M.langs + 0.2, M.en + 0.5, 2), seg('montage', M.smooth - 0.15, M.smooth + 0.97)],
    chips: true,
  },
  { t: [50, 54], cap: 'end', segs: [seg('run', M.join + 0.2, M.join + 2.6)], end: 50.3 },
];
const VO_AT = [0.2, 4.2, 9.2, 16.2, 21.2, 27.2, 32.2, 39.2, 45.2, 50.2];

const TEASER = [
  { t: [0, 3], cap: 'slip', segs: [seg('run', M.slip - 1.2, M.slip - 0.2), seg('run', M.slip - 0.2, M.slip + 0.8, 0.5)], zoom: { to: 1.1, ...SLIP_FOCUS } },
  {
    t: [3, 7.5],
    cap: 'crew',
    segs: [seg('abilities', M.foldA - 0.5, M.foldA + 1.0), seg('abilities', M.fade - 0.2, M.fade + 1.3), seg('abilities', M.hazeA - 0.5, M.hazeA + 1.0)],
    chips: true,
  },
  { t: [7.5, 10], cap: 'ghost', segs: [seg('run', M.slip + 5, M.slip + 11.25, 2.5)] },
  { t: [10, 12.5], cap: 'pull', segs: [seg('run', M.got - 0.2, M.used + 1.5, 1.48)] },
  { t: [12.5, 15], cap: 'end', segs: [seg('run', M.join - 0.8, M.join + 1.7)], end: 12.9 },
];

// ------------------------------------------------------------------ frames from the recordings
function extract(scenes, tag) {
  const dir = `${WORK}/${tag}`;
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  let k = 0;
  for (const sc of scenes) {
    const segs = sc.feed && real(sc.feed) ? [] : (sc.segs ?? sc.fallback ?? []);
    sc.parts = [];
    let at = sc.t[0];
    const total = sc.t[1] - sc.t[0];
    const natural = segs.reduce((n, s) => n + (s.b - s.a) / s.speed, 0);
    for (const s of segs) {
      // stretch or squeeze each segment a little so the scene is filled exactly
      const len = ((s.b - s.a) / s.speed) * (total / natural);
      const speed = (s.b - s.a) / len;
      const out = `${dir}/s${k++}`;
      mkdirSync(out);
      const n = Math.round(len * FPS);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-ss', String(s.a), '-i', `${REC}/${s.clip}.mp4`, '-vf', `fps=${FPS / speed},scale=444:-2`, '-frames:v', String(n), '-q:v', '3', `${out}/%05d.jpg`]);
      const files = readdirSync(out).sort();
      sc.parts.push({ start: at, end: at + len, files: files.map((f) => `${out}/${f}`), clip: s.clip, a: s.a, speed });
      at += len;
    }
  }
}

// ------------------------------------------------------------------ per-frame state
const fade = (t, a, b, inn = 0.35, out = 0.25) => Math.max(0, Math.min(1, (t - a) / inn, (b - t) / out));
function stateAt(t, scenes, vertical) {
  const sc = scenes.find((s) => t >= s.t[0] && t < s.t[1]) ?? scenes.at(-1);
  const st = { zoom: { scale: 1, fx: 0.5, fy: 0.5 }, cap: { id: sc.cap, a: 0, chip: null }, card: null, bubble: 0, sub: null, end: 0, rec: null, feed: null };
  // phone content
  if (sc.feed && real(sc.feed)) st.feed = real(sc.feed);
  else if (sc.parts.length) {
    const p = sc.parts.find((q) => t >= q.start && t < q.end) ?? sc.parts.at(-1);
    const i = Math.min(p.files.length - 1, Math.max(0, Math.floor((t - p.start) * FPS)));
    st.rec = pathToFileURL(p.files[i]).href;
    if (sc.chips) st.cap.chip = sc.parts.indexOf(p);
  }
  if (sc.chips && sc.feed === undefined && sc.cap === 'montage' && st.cap.chip === null) st.cap.chip = 0;
  // zoom in at the start of the scene, back out at the end
  if (sc.zoom) {
    const k = Math.min(1, (t - sc.t[0]) / 0.6) * Math.min(1, (sc.t[1] - t) / 0.4);
    const e = 1 - Math.pow(1 - Math.max(0, k), 3);
    st.zoom = { scale: 1 + (sc.zoom.to - 1) * e, fx: sc.zoom.fx, fy: sc.zoom.fy };
  }
  st.cap.a = sc.cap === 'end' ? 0 : fade(t, sc.t[0], sc.t[1]);
  if (sc.card && !vertical) {
    st.card = { a: fade(t, sc.card.from, sc.t[1]), src: real(sc.card.file), placeholder: `${sc.card.file} (live screenshot)`, note: sc.card.note };
  }
  if (sc.bubble && !vertical) st.bubble = fade(t, sc.bubble[0], sc.bubble[1], 0.25, 0.25);
  if (sc.end !== undefined) st.end = Math.min(1, Math.max(0, (t - sc.end) / 0.6));
  if (!vertical) {
    const i = VO_AT.findIndex((a, j) => t >= a && t < a + vo[j].duration + 0.25);
    if (i >= 0) st.sub = { text: vo[i].text, a: fade(t, VO_AT[i], VO_AT[i] + vo[i].duration + 0.25, 0.15, 0.2) };
  }
  return st;
}

// ------------------------------------------------------------------ render frames with the HTML compositor
async function render(scenes, { tag, w, h, vertical, out, stills }) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  await page.goto(pathToFileURL(`${ROOT}/scripts/video/compose.html`).href);
  await page.evaluate(([caps, v]) => window.setup(caps, v), [CAPS, vertical]);
  await page.evaluate(() => document.fonts.ready);
  const end = scenes.at(-1).t[1];
  if (stills) {
    for (const [name, t] of stills) {
      await page.evaluate((s) => window.apply(s), stateAt(t, scenes, vertical));
      await page.screenshot({ path: name, type: 'png' });
    }
    await browser.close();
    return;
  }
  const dir = `${WORK}/${tag}-frames`;
  if (existsSync(dir)) rmSync(dir, { recursive: true });
  mkdirSync(dir, { recursive: true });
  const n = Math.round(end * FPS);
  const t0 = Date.now();
  for (let f = 0; f < n; f++) {
    await page.evaluate((s) => window.apply(s), stateAt(f / FPS, scenes, vertical));
    await page.screenshot({ path: `${dir}/${String(f).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 93 });
    if (f % 300 === 0) console.log(`${tag}: frame ${f}/${n} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  }
  await browser.close();
  return dir;
}

// ------------------------------------------------------------------ sound effects (same synthesis as src/client/core/audio.ts)
function sfxEvents(scenes) {
  const out = [];
  // page events (what the screen showed) for game sounds, driver events for the button taps
  const map = { 'p:step': 'step', 'p:ability': 'ability', 'p:cleared': 'drop', 'p:slip': 'tide', 'pull-used': 'drop', 'p:results': 'bloom', 'p:caught': 'caught', ask: 'click', join: 'drop' };
  for (const sc of scenes)
    for (const p of sc.parts ?? []) {
      for (const e of logs[p.clip].events) {
        const kind = map[e.type];
        if (!kind) continue;
        const t = p.start + (e.t - p.a) / p.speed;
        if (t >= p.start && t < p.end) out.push({ t, kind, gain: p.speed > 1.6 && kind === 'step' ? 0.5 : 1 });
      }
    }
  return out;
}
async function renderSfx(events, seconds, file) {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const page = await browser.newPage();
  const b64 = await page.evaluate(
    async ([events, seconds]) => {
      const rate = 44100;
      const ctx = new OfflineAudioContext(2, Math.ceil(seconds * rate), rate);
      const sfx = ctx.createGain();
      sfx.gain.value = 0.9 * 0.8 * 0.8;
      sfx.connect(ctx.destination);
      const len = Math.floor(rate * 1.0);
      const noise = ctx.createBuffer(1, len, rate);
      const data = noise.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const env = (g, t, peak, attack, decay) => {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(peak, t + attack);
        g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
      };
      let base = 0;
      let mul = 1;
      const tone = (freq, dur, gain, type = 'sine', when = 0, slideTo) => {
        const t0 = base + when;
        const o = ctx.createOscillator();
        o.type = type;
        o.frequency.setValueAtTime(freq, t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
        const g = ctx.createGain();
        env(g, t0, gain * mul, 0.012, dur);
        o.connect(g).connect(sfx);
        o.start(t0);
        o.stop(t0 + dur + 0.05);
      };
      const nz = (freq, q, dur, gain, when = 0) => {
        const t0 = base + when;
        const src = ctx.createBufferSource();
        src.buffer = noise;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = freq;
        f.Q.value = q;
        const g = ctx.createGain();
        env(g, t0, gain * mul, 0.003, dur);
        src.connect(f).connect(g).connect(sfx);
        src.start(t0, Math.random() * 0.5, dur + 0.05);
      };
      const play = {
        step: () => nz(900 + Math.random() * 500, 1.4, 0.08, 0.25),
        click: () => nz(2600, 2, 0.05, 0.2),
        drop: () => {
          [880, 1318.5, 1760].forEach((f, i) => tone(f, 0.9, 0.12, 'sine', i * 0.07));
          tone(330, 1.4, 0.2, 'triangle', 0, 90);
        },
        ability: () => {
          tone(660, 0.35, 0.16, 'triangle', 0, 990);
          tone(990, 0.4, 0.08, 'sine', 0.05, 1320);
        },
        caught: () => tone(220, 0.5, 0.25, 'sawtooth', 0, 90),
        tide: () => nz(400, 0.7, 0.7, 0.1),
        bloom: () => [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => tone(f, 1.6, 0.1, 'sine', i * 0.12)),
      };
      for (const e of events) {
        base = e.t;
        mul = e.gain;
        play[e.kind]?.();
      }
      const buf = await ctx.startRendering();
      // 16-bit stereo WAV
      const n = buf.length;
      const ab = new ArrayBuffer(44 + n * 4);
      const v = new DataView(ab);
      const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF');
      v.setUint32(4, 36 + n * 4, true);
      w(8, 'WAVEfmt ');
      v.setUint32(16, 16, true);
      v.setUint16(20, 1, true);
      v.setUint16(22, 2, true);
      v.setUint32(24, rate, true);
      v.setUint32(28, rate * 4, true);
      v.setUint16(32, 4, true);
      v.setUint16(34, 16, true);
      w(36, 'data');
      v.setUint32(40, n * 4, true);
      const L = buf.getChannelData(0);
      const R = buf.getChannelData(1);
      for (let i = 0; i < n; i++) {
        v.setInt16(44 + i * 4, Math.max(-1, Math.min(1, L[i])) * 32767, true);
        v.setInt16(46 + i * 4, Math.max(-1, Math.min(1, R[i])) * 32767, true);
      }
      let s = '';
      const bytes = new Uint8Array(ab);
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(s);
    },
    [events, seconds]
  );
  writeFileSync(file, Buffer.from(b64, 'base64'));
  await browser.close();
}

// ------------------------------------------------------------------ audio mix + encode
function encode(framesDir, seconds, out, { voice }) {
  const sfx = `${WORK}/sfx-${path.basename(out, '.mp4')}.wav`;
  const inputs = ['-framerate', String(FPS), '-i', `${framesDir}/%05d.jpg`, '-i', MUSIC, '-i', sfx];
  const parts = [];
  // music: ducked to 25% under the voice, faded in and out
  let duck = '0';
  if (voice) {
    for (let i = 0; i < VO_AT.length; i++) {
      const a = VO_AT[i];
      const b = a + vo[i].duration;
      const r = `min(max((t-${(a - 0.3).toFixed(2)})/0.3,0),1)*min(max((${(b + 0.3).toFixed(2)}-t)/0.3,0),1)`;
      duck = `max(${duck},${r})`;
    }
  }
  parts.push(`[1:a]atrim=0:${seconds},asetpts=N/SR/TB,volume='0.62*(1-0.75*${duck})':eval=frame,afade=t=in:d=0.4,afade=t=out:st=${(seconds - 2.5).toFixed(2)}:d=2.5[m]`);
  parts.push(`[2:a]volume=0.8[s]`);
  const mix = ['[m]', '[s]'];
  if (voice) {
    vo.forEach((l, i) => {
      inputs.push('-i', `${VID}/vo/${l.file}`);
      const ms = Math.round(VO_AT[i] * 1000);
      parts.push(`[${3 + i}:a]adelay=${ms}|${ms},volume=1.5[v${i}]`);
      mix.push(`[v${i}]`);
    });
  }
  parts.push(`${mix.join('')}amix=inputs=${mix.length}:normalize=0,alimiter=limit=0.95,atrim=0:${seconds}[a]`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', parts.join(';'), '-map', '0:v', '-map', '[a]', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-t', String(seconds), out], { stdio: 'inherit' });
}

async function build(scenes, tag, opts) {
  extract(scenes, tag);
  const seconds = scenes.at(-1).t[1];
  await renderSfx(sfxEvents(scenes), seconds, `${WORK}/sfx-${path.basename(opts.out, '.mp4')}.wav`);
  const dir = await render(scenes, { tag, ...opts });
  encode(dir, seconds, opts.out, opts);
  console.log(`${opts.out}: ${seconds} s`);
}

mkdirSync(WORK, { recursive: true });
if (WHAT === 'main' || WHAT === 'all') await build(MAIN, 'main', { w: 1920, h: 1080, vertical: false, out: `${VID}/maist-demo.mp4`, voice: true });
if (WHAT === 'teaser' || WHAT === 'all') await build(TEASER, 'teaser', { w: 1080, h: 1920, vertical: true, out: `${VID}/maist-teaser-vertical.mp4`, voice: false });
if (WHAT === 'stills' || WHAT === 'all') {
  extract(MAIN, 'stills');
  mkdirSync(`${ROOT}/docs/devpost`, { recursive: true });
  await render(MAIN, {
    tag: 'stills', w: 1920, h: 1080, vertical: false,
    stills: [
      [`${ROOT}/docs/devpost/still-1-crew.png`, 11.5],
      [`${ROOT}/docs/devpost/still-2-vault-slips.png`, 25.0],
      [`${ROOT}/docs/devpost/still-3-ghost-race.png`, 29.5],
      [`${ROOT}/docs/devpost/still-4-wake-up.png`, 36.0],
      [`${ROOT}/docs/devpost/still-5-leaderboard.png`, 42.6],
    ],
  });
  console.log('stills written to docs/devpost/');
}
