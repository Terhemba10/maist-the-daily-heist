import { CREW_FIG, figure, sprite } from './art/index.ts';
import { floorCanvas } from './floor.ts';
import { audio } from './core/audio.ts';
import { prefs, savePrefs, smoothActive, type ThemePref } from './prefs.ts';
import { reducedMotion, saveSettings, settings } from './core/settings.ts';
import { getLang, LANGS, setLang, t, type Key, type Lang } from './i18n/heist.ts';
import type { BoardRes, GhostRes, HeistInit, JoinRes, KickRes, LimboRes, RunRes, ShareRes } from '../shared/heist/api.ts';
import { navigateTo } from '@devvit/web/client';
import {
  apply,
  buildHeist,
  canApply,
  DIRS,
  guardVision,
  idx,
  KICK_AP,
  layerScore,
  resultOf,
  SLIP_BONUS,
  newLayerState,
  SIZE,
  SQUAD,
  type Action,
  type Dir,
  type HeistDef,
  type RunRecord,
  type LayerState,
  type Tier,
  type OpId,
  type Pos,
} from '../shared/heist/engine.ts';
import { msUntilNextDream, nightNumber } from '../shared/logic/season.ts';

// ------------------------------------------------------------------ server

async function call<T>(path: string, body?: unknown): Promise<T | null> {
  try {
    const res = await fetch(`/api/${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok || !(res.headers.get('content-type') ?? '').includes('json')) return null;
    const data: T = await res.json();
    return data;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------------ state

type Mode = 'title' | 'play' | 'over';

const app = {
  init: null as HeistInit | null,
  night: nightNumber(),
  heist: null as HeistDef | null,
  mode: 'title' as Mode,
  scored: false,
  li: 0,
  s: null as LayerState | null,
  record: [] as Action[][],
  sel: 0 as OpId,
  targeting: false,
  kickTimer: 0,
  /** First-play tutorial step (1-4), 0 when off. */
  tut: 0,
  tutAt: 0,
  /** Tonight's #1 run, replayed one action per player action. */
  ghost: null as null | { name: string; record: RunRecord; s: LayerState | null; i: number; lastOp: number },
  idleTimer: 0,
  lastAp: 0,
  nextAt: Date.now() + msUntilNextDream(),
};

const ui = document.getElementById('ui') as HTMLElement;
const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text) el.textContent = text;
  return el;
};
const opName = (o: number): string => t((SQUAD[o]?.key ?? 'shaper') as Key);
/** Just the crew member's name ("Vale", "维尔", "ヴェイル"), without their title. */
const shortName = (o: number): string => (opName(o).split(/[,·（(]/)[0] ?? opName(o)).trim();
const tierName = (i: number): string => t((['easy', 'hard', 'difficult'] as const)[i] ?? 'easy');

const saveKey = () => `heist.run.${app.night}`;
function saveProgress(): void {
  if (!app.scored) return;
  try {
    window.localStorage.setItem(saveKey(), JSON.stringify(app.record));
  } catch {
    /* ignore */
  }
}
function loadProgress(): Action[][] | null {
  try {
    const raw = window.localStorage.getItem(saveKey());
    if (!raw) return null;
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? (v as Action[][]) : null;
  } catch {
    return null;
  }
}
function clearProgress(): void {
  try {
    window.localStorage.removeItem(saveKey());
  } catch {
    /* ignore */
  }
}

const canScore = () => !!app.init && app.init.loggedIn && app.init.postNight === app.init.today && !app.init.scored;

// ------------------------------------------------------------------ toast

let toastTimer = 0;
function toast(msg: string): void {
  let el = document.querySelector<HTMLElement>('.toast');
  if (!el) {
    el = h('div', 'toast');
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('on');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el?.classList.remove('on'), 2200);
}

// ------------------------------------------------------------------ layer background

/**
 * One persistent background behind the UI (outside #ui, which is rebuilt every layer), so its colours
 * can fade from one layer's mood to the next. 4 light rays + 12 dust motes, all CSS.
 */
const layerBg = (() => {
  const el = h('div', 'layer-bg');
  el.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < 4; i++) el.append(h('i', `ray r${i}`));
  for (let i = 0; i < 12; i++) el.append(h('b', `dust d${i}`));
  document.body.prepend(el);
  return el;
})();

function setLayerBg(tier: Tier | null): void {
  if (tier) layerBg.dataset.tier = tier;
  layerBg.classList.toggle('on', tier !== null);
}

// ------------------------------------------------------------------ title

function fmtCountdown(): string {
  const s = Math.max(0, Math.floor((app.nextAt - Date.now()) / 1000));
  const p = (v: number) => String(v).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

function topBar(): HTMLElement {
  const bar = h('div', 'topbar');
  const who = h('div', 'who chip');
  if (!app.init?.snoovatar) who.append(h('span', 'dot'));
  if (app.init?.snoovatar) {
    const img = h('img', 'snoo');
    img.src = app.init.snoovatar;
    img.alt = '';
    who.append(img);
  }
  if (app.init?.username) who.append(h('span', '', `u/${app.init.username}`));
  if (!app.init?.username) who.append(h('span', '', 'MAIST'));
  if (app.init?.streak.count) who.append(h('span', 'streak', t('streak', { n: app.init.streak.count })));
  const tools = h('div', 'tools chip');
  const gear = h('button', 'icon', '⚙');
  gear.setAttribute('aria-label', t('settings'));
  gear.title = t('settings');
  gear.addEventListener('click', showSettings);
  tools.append(gear);
  bar.append(who, tools);
  return bar;
}

/** A row of choices; the chosen one is highlighted. */
function seg<T extends string>(values: readonly T[], label: (v: T) => string, current: () => T, set: (v: T) => void): HTMLElement {
  const row = h('div', 'seg');
  const buttons = values.map((v) => {
    const b = h('button', `seg-btn${current() === v ? ' on' : ''}`, label(v));
    b.setAttribute('aria-pressed', String(current() === v));
    b.addEventListener('click', () => {
      set(v);
      buttons.forEach((x, i) => {
        const on = values[i] === current();
        x.classList.toggle('on', on);
        x.setAttribute('aria-pressed', String(on));
      });
    });
    return b;
  });
  row.append(...buttons);
  return row;
}

function showSettings(): void {
  const body = h('div', 'settings-list');
  const row = (label: string, control: HTMLElement, desc = '') => {
    const r = h('div', 'set-row');
    const l = h('div', 'set-label', label);
    if (desc) l.append(h('small', '', desc));
    r.append(l, control);
    body.append(r);
  };
  const sel = h('select', 'lang');
  sel.setAttribute('aria-label', t('language'));
  for (const [code, label] of Object.entries(LANGS)) {
    const o = h('option', '', label);
    o.value = code;
    if (code === getLang()) o.selected = true;
    sel.append(o);
  }
  sel.addEventListener('change', () => {
    setLang(sel.value as Lang);
    closeModal();
    render();
    showSettings();
  });
  row(t('language'), sel);
  row(
    t('sound'),
    seg(['on', 'off'] as const, (v) => t(v), () => (settings.sfx > 0 ? 'on' : 'off'), (v) => {
      saveSettings({ sfx: v === 'on' ? 0.8 : 0, music: v === 'on' ? 0.6 : 0 });
      audio.applyVolumes();
    })
  );
  row(t('theme'), seg(['system', 'light', 'dark'] as const, (v: ThemePref) => t(v === 'system' ? 'themeSystem' : v === 'light' ? 'themeLight' : 'themeDark'), () => prefs.theme, (v) => savePrefs({ theme: v })));
  row(
    t('ghostRace'),
    seg(['on', 'off'] as const, (v) => t(v), () => (prefs.ghost ? 'on' : 'off'), (v) => {
      savePrefs({ ghost: v === 'on' });
      if (app.mode === 'play') renderGhost();
    }),
    t('ghostRaceDesc')
  );
  row(t('bigText'), seg(['on', 'off'] as const, (v) => t(v), () => (prefs.bigText ? 'on' : 'off'), (v) => savePrefs({ bigText: v === 'on' })));
  row(t('smooth'), seg(['auto', 'on', 'off'] as const, (v) => t(v), () => prefs.smooth, (v) => savePrefs({ smooth: v })));
  modal(t('settings'), body);
}

function renderTitle(): void {
  setLayerBg(null);
  ui.replaceChildren();
  const wrap = h('main', 'title-screen');
  wrap.append(topBar());
  const hero = h('div', 'hero');
  hero.append(h('p', 'kicker', `MAIST · ${t('night', { n: app.night })}`), h('h1', 'logo', t('title')), h('p', 'tag', t('tag')));
  const squad = h('div', 'squad-row');
  SQUAD.forEach((sq, i) => {
    const c = h('div', `crew c${i}`);
    const pic = h('span', 'bob');
    pic.append(figure(CREW_FIG[i] ?? 'vale', ['front']));
    c.append(pic, h('b', '', shortName(i)), h('small', '', `${t(sq.ability)} · ${sq.cost} AP`));
    squad.append(c);
  });
  hero.append(squad, seasonStrip());

  const status = h('p', 'status');
  const init = app.init;
  if (!init) status.textContent = t('offline');
  else if (init.postNight !== init.today) status.textContent = t('archived');
  else if (init.scored) status.textContent = `${t('scoredDone', { score: init.scored.score })}${init.scored.rank ? ` · ${t('rankLine', { rank: init.scored.rank })}` : ''}`;
  else if (!init.loggedIn) status.textContent = t('loggedOut');

  const actions = h('div', 'actions');
  if (canScore()) {
    const saved = loadProgress();
    const go = h('button', 'btn primary big', saved?.some((l) => l.length) ? t('resume') : t('start'));
    go.addEventListener('click', () => startRun(true, saved));
    actions.append(go);
  }
  // When there is no scored run to start (logged out, already played, an older night),
  // practice becomes the one big button; otherwise it is a quiet link under "Start".
  const prac = h('button', canScore() ? 'link' : 'btn primary big', t('practice'));
  prac.addEventListener('click', () => startRun(false, null));
  const row = h('div', 'links');
  const lb = h('button', 'link', t('board'));
  lb.addEventListener('click', () => void showBoard());
  const how = h('button', 'link', t('howto'));
  how.addEventListener('click', showHowTo);
  if (canScore()) row.append(prac);
  row.append(lb, how);
  if (!canScore()) actions.append(prac);
  actions.append(row);
  const cd = h('p', 'countdown', t('next', { t: fmtCountdown() }));
  wrap.append(hero, status, actions, cd);
  ui.append(wrap);
}

/** Your last 3 nights (scores) and the next 3 (locked, with the time until they unlock). */
function seasonStrip(): HTMLElement {
  const wrap = h('div', 'season');
  wrap.append(h('p', 'season-title', t('yourNights')));
  const row = h('div', 'season-row');
  const today = app.init?.today ?? app.night;
  const past = (app.init?.history?.length ? app.init.history : [{ night: today, score: null }]).slice(-3);
  for (const d of past) {
    const tile = h('div', `night-tile${d.night === today ? ' now' : ''}${d.score === null ? ' empty' : ''}`);
    tile.append(h('b', '', d.night === today ? t('tonight') : t('night', { n: d.night })), h('span', '', d.score === null ? t('notPlayed') : t('pts', { score: d.score })));
    row.append(tile);
  }
  const hours = Math.max(1, Math.ceil((app.nextAt - Date.now()) / 3_600_000));
  for (let k = 1; k <= 1; k++) {
    const tile = h('div', 'night-tile locked');
    tile.append(h('b', '', `🔒 ${t('night', { n: today + k })}`), h('span', '', t('unlocksIn', { h: hours + 24 * (k - 1) })));
    row.append(tile);
  }
  wrap.append(row);
  return wrap;
}

window.setInterval(() => {
  const cd = document.querySelector('.countdown');
  if (cd) cd.textContent = t('next', { t: fmtCountdown() });
}, 1000);

// ------------------------------------------------------------------ modals

function modal(title: string, body: HTMLElement, buttons: HTMLElement[] = []): HTMLElement {
  closeModal();
  const back = h('div', 'modal-back');
  const box = h('div', 'modal');
  box.append(h('h2', '', title), body);
  const row = h('div', 'modal-actions');
  const close = h('button', 'btn', t('close'));
  close.addEventListener('click', closeModal);
  row.append(...buttons, close);
  box.append(row);
  back.append(box);
  back.addEventListener('click', (e) => {
    if (e.target === back) closeModal();
  });
  document.body.append(back);
  return box;
}
function closeModal(): void {
  document.querySelector('.modal-back')?.remove();
}

function showHowTo(): void {
  const body = h('ol', 'howto');
  (['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const).forEach((k) => body.append(h('li', '', t(k))));
  modal(t('howto'), body);
}

async function showBoard(): Promise<void> {
  const body = h('div', 'board-list', t('loading'));
  modal(`${t('board')} · ${t('night', { n: app.night })}`, body);
  const res = await call<BoardRes>(`leaderboard?night=${app.night}`);
  body.textContent = '';
  if (!res || !res.rows.length) {
    body.textContent = t('empty');
    return;
  }
  const rows = [...res.rows];
  if (res.me && !rows.some((r) => r.me)) rows.push(res.me);
  for (const r of rows) {
    const line = h('div', `lb-row${r.me ? ' me' : ''}`);
    const av = h('span', 'av');
    if (r.snoovatar) {
      const img = h('img');
      img.src = r.snoovatar;
      img.alt = '';
      av.append(img);
    } else av.textContent = (r.name[0] ?? '?').toUpperCase();
    line.append(h('span', 'rk', `#${r.rank}`), av, h('span', 'nm', `u/${r.name}`), h('span', 'sc', String(r.score)));
    body.append(line);
  }
}

// ------------------------------------------------------------------ run flow

function startRun(scored: boolean, saved: Action[][] | null): void {
  audio.unlock();
  app.heist = buildHeist(app.night);
  app.scored = scored;
  app.record = [];
  app.li = 0;
  app.mode = 'play';
  app.s = newLayerState(app.heist.layers[0]!);
  // Resume a saved scored run by replaying it.
  if (scored && saved) {
    for (const [i, acts] of saved.entries()) {
      const def = app.heist.layers[i];
      if (!def) break;
      app.li = i;
      app.record[i] = [];
      let s = newLayerState(def);
      for (const a of acts) {
        if (!canApply(s, a).ok) break;
        s = apply(s, a);
        app.record[i]!.push(a);
      }
      app.s = s;
      if (s.status !== 'cleared') break;
      if (i < 2) {
        app.li = i + 1;
        app.s = newLayerState(app.heist.layers[i + 1]!);
        app.record[i + 1] = app.record[i + 1] ?? [];
      }
    }
  }
  app.record[app.li] = app.record[app.li] ?? [];
  app.sel = firstActive();
  app.targeting = false;
  void loadGhost();
  audio.playMusic(app.li);
  renderPlay(true);
  if (app.s.status === 'limbo') showLimbo();
}

function firstActive(): OpId {
  const i = app.s?.ops.findIndex((o) => !o.out) ?? 0;
  return (i < 0 ? 0 : i) as OpId;
}

function act(a: Action): void {
  const s = app.s;
  if (!s || app.mode !== 'play') return;
  const c = canApply(s, a);
  if (!c.ok) {
    audio.bump();
    toast(c.reason === 'no AP' ? t('noAp') : t('blocked'));
    return;
  }
  const n = apply(s, a);
  app.s = n;
  clearSlipPing();
  app.record[app.li]!.push(a);
  saveProgress();
  app.targeting = false;
  if (a.t === 'm') audio.step();
  else if (a.t === 'a') {
    audio.ability();
    retrigger(opEls[a.o], 'cast');
  } else audio.click();
  advanceTutorial();
  stepGhost();
  wakeFromIdle();
  for (const o of n.lastCaught) {
    audio.caught();
    toast(t('caught', { name: opName(o) }));
    buzz(80);
  }
  if (n.ops[app.sel]?.out) app.sel = firstActive();
  if (n.ap > 0 && n.ap <= 3 && n.status === 'play') audio.heartbeat();
  renderPlay(false);
  if (n.justSlipped) vaultSlipped(s.vault, n.vault);
  if (n.status === 'cleared') window.setTimeout(showCleared, 350);
  else if (n.status === 'limbo') window.setTimeout(showLimbo, 450);
}

/** "The vault slipped!": poof on the old tile, the vault reappears, and a gold ping marks it for one turn. */
function vaultSlipped(from: Pos, to: Pos): void {
  const old = tiles[idx(from[0], from[1])]?.querySelector<HTMLElement>('.art-vault');
  if (old) {
    old.classList.add('poof');
    window.setTimeout(() => old.remove(), reducedMotion() ? 0 : 700);
  }
  tiles[idx(to[0], to[1])]?.append(vaultArt());
  if (boardEl) {
    const ping = h('span', 'slip-ping');
    ping.style.transform = `translate(calc(var(--cell) * ${to[0]}), calc(var(--cell) * ${to[1]}))`;
    boardEl.append(ping);
  }
  audio.tide();
  buzz(40);
  toast(t('slipped'));
}

/** The ping lasts one turn: the next action removes it (and in fog the vault is hidden again). */
function clearSlipPing(): void {
  document.querySelectorAll('.slip-ping').forEach((p) => p.remove());
}

function vaultArt(): HTMLElement {
  const v = sprite('vault');
  v.append(h('span', 'glint'));
  return v;
}

function buzz(ms: number): void {
  try {
    if (settings.vibration) navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

function showCleared(): void {
  const s = app.s;
  if (!s) return;
  audio.drop();
  const pts = layerScore(resultOf(s, 0));
  const body = h('div', 'cleared');
  const vault = sprite('vault', 'big open');
  body.append(vault, h('p', '', t('clearedSub', { pts, ap: s.ap })));
  if (s.quick) body.append(h('p', 'slip-bonus', t('slipBonus', { pts: SLIP_BONUS })));
  document.querySelector('.tile.vault .art')?.classList.add('open');
  opEls.forEach((el) => {
    if (!el.classList.contains('out')) el.classList.add('cheer');
  });
  const last = app.li >= 2;
  const next = h('button', 'btn primary', last ? t('finish') : t('nextLayer', { i: app.li + 2 }));
  next.addEventListener('click', () => {
    closeModal();
    if (last) void finish();
    else {
      app.li += 1;
      app.record[app.li] = [];
      app.s = newLayerState(app.heist!.layers[app.li]!);
      app.sel = 0;
      saveProgress();
      audio.playMusic(app.li);
      resetGhost();
      renderPlay(true);
    }
  });
  const box = modal(t('cleared'), body, [next]);
  box.querySelector('.modal-actions .btn:last-child')?.remove();
}

function kicksUsed(): number {
  return app.record.flat().filter((a) => a.t === 'kick').length;
}

function showLimbo(): void {
  audio.caught();
  const body = h('div', 'limbo');
  body.append(h('p', '', t('limboSub')));
  const msg = h('p', 'small');
  body.append(msg);
  const buttons: HTMLElement[] = [];
  if (app.scored) {
    const ask = h('button', 'btn primary', t('callKick'));
    ask.addEventListener('click', async () => {
      ask.setAttribute('disabled', '');
      const res = await call<LimboRes>('limbo', { night: app.night, record: { v: 1, layers: app.record } });
      msg.textContent = res?.message ?? t('blocked');
      if (res?.ok) {
        msg.textContent = `${res.message} ${t('kickWait')}`;
        pollKick(msg, ask);
      } else ask.removeAttribute('disabled');
    });
    buttons.push(ask);
    if (app.init?.kicks.asked) pollKick(msg, ask);
  } else {
    const retry = h('button', 'btn primary', t('retry'));
    retry.addEventListener('click', () => {
      closeModal();
      app.record[app.li] = [];
      app.s = newLayerState(app.heist!.layers[app.li]!);
      app.sel = 0;
      renderPlay(true);
    });
    buttons.push(retry);
  }
  const end = h('button', 'btn', t('endRun'));
  end.addEventListener('click', () => {
    closeModal();
    void finish();
  });
  buttons.push(end);
  const box = modal(t('limbo'), body, buttons);
  box.classList.add('limbo-box');
  box.querySelector('.modal-actions .btn:last-child')?.remove();
}

function pollKick(msg: HTMLElement, ask: HTMLElement): void {
  window.clearInterval(app.kickTimer);
  const check = async () => {
    const k = await call<KickRes>('kick');
    if (!k) return;
    if (k.granted > kicksUsed()) {
      window.clearInterval(app.kickTimer);
      msg.textContent = t('kickGot');
      ask.textContent = t('useKick');
      ask.removeAttribute('disabled');
      ask.onclick = () => {
        closeModal();
        if (!app.s) return;
        app.s = apply(app.s, { t: 'kick' });
        app.record[app.li]!.push({ t: 'kick' });
        saveProgress();
        audio.drop();
        app.sel = firstActive();
        renderPlay(false);
      };
    }
  };
  void check();
  app.kickTimer = window.setInterval(() => void check(), 8000);
}

async function finish(): Promise<void> {
  setLayerBg(null);
  window.clearTimeout(app.idleTimer);
  window.clearInterval(app.kickTimer);
  app.mode = 'over';
  audio.bloom();
  const record = { v: 1 as const, layers: app.record };
  ui.replaceChildren();
  const wrap = h('main', 'results');
  wrap.append(topBar(), h('h1', 'logo small', t('results')), celebration());
  const box = h('div', 'res-box', t('loading'));
  wrap.append(box);
  ui.append(wrap);

  const res = app.init ? await call<RunRes>('run', { night: app.night, record, scored: app.scored }) : null;
  const results = res?.results ?? localResults();
  const score = res?.score ?? results.reduce((n, r) => n + layerScore(r), 0);
  if (res?.scored) {
    clearProgress();
    if (app.init) {
      app.init.scored = { score, rank: res.rank };
      app.init.streak = res.streak;
    }
  }
  box.textContent = '';
  box.append(h('p', 'score', t('pts', { score })));
  if (res?.scored && res.rank) box.append(h('p', 'rank', t('rankTonight', { rank: res.rank })));
  else if (!app.scored) box.append(h('p', 'rank', t('practiceDone')));
  const layers = h('div', 'res-layers');
  results.forEach((r, i) => {
    const row = h('div', `res-row ${r.cleared ? 'ok' : 'fail'}`);
    const def = app.heist?.layers[i];
    const name = h('span', 'res-name', `${t('layer', { i: i + 1 })} · ${tierName(i)}`);
    if (def) name.append(h('small', '', t('par', { par: def.par, used: r.cleared ? def.ap + r.kicks * KICK_AP - r.ap : '—' })));
    if (r.quick) name.append(h('small', 'slip-bonus', t('slipBonus', { pts: SLIP_BONUS })));
    row.append(name, h('b', '', r.cleared ? `◈ ${layerScore(r)}` : '—'));
    layers.append(row);
  });
  box.append(layers);
  const streak = app.init?.streak.count ?? 0;
  if (res?.scored && streak > 0) box.append(h('p', 'streak-line', t('streakNights', { n: streak })));
  const acts = h('div', 'actions');
  acts.append(joinButton());
  const row = h('div', 'links');
  if (res?.scored) {
    const share = h('button', 'link', t('share'));
    share.addEventListener('click', async () => {
      share.setAttribute('disabled', '');
      const r = await call<ShareRes>('share', {});
      toast(r?.message ?? t('blocked'));
    });
    row.append(share);
  }
  const lb = h('button', 'link', t('board'));
  lb.addEventListener('click', () => void showBoard());
  const back = h('button', 'link', t('backTitle'));
  back.addEventListener('click', () => {
    app.mode = 'title';
    audio.stopMusic();
    render();
  });
  row.append(lb, back);
  acts.append(row);
  box.append(acts);
}

/**
 * The one next step after a run: join the subreddit for tomorrow's heist. Logged-in players are
 * subscribed by the app (as themselves) when Reddit allows it; otherwise, and when logged out, they are
 * sent to the subreddit to join there.
 */
function joinButton(): HTMLElement {
  const sub = app.init?.subreddit || 'MaistHeist';
  if (app.init?.joined) return h('p', 'joined', t('joinedSub', { sub }));
  const b = h('button', 'btn primary big', t('joinSub', { sub }));
  b.addEventListener('click', async () => {
    if (!app.init?.loggedIn) {
      navigateTo(`https://www.reddit.com/r/${sub}/`);
      return;
    }
    b.setAttribute('disabled', '');
    const r = await call<JoinRes>('join', {});
    if (r?.ok) {
      if (app.init) app.init.joined = true;
      b.replaceWith(h('p', 'joined', t('joinedSub', { sub })));
      audio.drop();
    } else {
      // Reddit has not granted SUBSCRIBE_TO_SUBREDDIT to the app (it is unpublished): send the player
      // to the subreddit so they can join it there with one tap.
      b.removeAttribute('disabled');
      navigateTo(`https://www.reddit.com/r/${sub}/`);
    }
  });
  return b;
}

function localResults() {
  const out = [];
  for (let i = 0; i < app.record.length; i++) {
    const def = app.heist!.layers[i]!;
    let s = newLayerState(def);
    for (const a of app.record[i]!) if (canApply(s, a).ok) s = apply(s, a);
    out.push(resultOf(s, 0));
  }
  return out;
}

/** Crew around a spinning vault, with twinkling sparks. */
function celebration(): HTMLElement {
  const box = h('div', 'celebrate');
  // crew, vault, crew, crew: the vault stands among them
  CREW_FIG.forEach((name, i) => {
    const b = h('span', `c-crew c-crew${i} bob cheer`);
    b.append(figure(name, ['front']));
    box.append(b);
    if (i === 0) box.append(sprite('vault', 'c-vault open'));
  });
  ['#ffd166', '#00f0ff', '#b388ff', '#7cffb2', '#ff2e88'].forEach((c, i) => {
    const sp = h('span', `spark s${i}`, '✦');
    sp.style.color = c;
    box.append(sp);
  });
  return box;
}

/** Restart a one-shot CSS animation class. */
/**
 * One-shot effects run on the Web Animations API: restarting a CSS animation needs a forced reflow
 * per sprite, which made every move janky on slow phones.
 */
const FX: Record<string, { sel: string; frames: Keyframe[]; ms: number }[]> = {
  go: [
    {
      sel: '',
      frames: [
        { translate: '0 0', scale: '1 1' },
        { translate: '0 -12%', scale: '0.94 1.06', offset: 0.4 },
        { translate: '0 0', scale: '1.08 0.92', offset: 0.8 },
        { translate: '0 0', scale: '1 1' },
      ],
      ms: 240,
    },
  ],
  cast: [
    { sel: '.fx', frames: [{ opacity: 0.9, scale: 0.4 }, { opacity: 0, scale: 1.3 }], ms: 550 },
    { sel: '.bob', frames: [{ rotate: '0deg', scale: '1' }, { rotate: '-9deg', scale: '1.08', offset: 0.35 }, { rotate: '0deg', scale: '1' }], ms: 500 },
  ],
};
function retrigger(el: HTMLElement | undefined, cls: keyof typeof FX): void {
  if (!el || reducedMotion()) return;
  for (const f of FX[cls] ?? []) {
    const target = f.sel ? el.querySelector<HTMLElement>(f.sel) : el;
    target?.animate(f.frames, { duration: f.ms, easing: 'ease-out' });
  }
}

/** Float "−1 AP" (or "+6 AP" after a Pull) next to the AP number. */
function apFloat(delta: number): void {
  const host = document.querySelector('.ap');
  if (!host || delta === 0 || smoothActive()) return; // the AP number itself still updates
  const f = h('span', `ap-float${delta > 0 ? ' up' : ''}`, `${delta > 0 ? '+' : '−'}${Math.abs(delta)} ${t('ap')}`);
  host.append(f);
  window.setTimeout(() => f.remove(), 900);
}

// ------------------------------------------------------------------ ghost race

/** On tonight's post, fetch tonight's #1 run (unless it's yours) to race against. */
async function loadGhost(): Promise<void> {
  app.ghost = null;
  const init = app.init;
  if (!init || app.night !== init.today || init.postNight !== init.today) return;
  const g = await call<GhostRes>(`ghost?night=${app.night}`);
  if (!g?.ok || !g.name || !g.record || g.name === init.username || app.mode !== 'play') return;
  app.ghost = { name: g.name, record: g.record, s: null, i: 0, lastOp: 0 };
  resetGhost();
  renderGhost();
}

function resetGhost(): void {
  const g = app.ghost;
  if (!g || !app.heist) return;
  const def = app.heist.layers[app.li];
  g.s = def ? newLayerState(def) : null;
  g.i = 0;
  g.lastOp = 0;
}

/** The ghost takes one (valid) action from its record each time you act. */
function stepGhost(): void {
  const g = app.ghost;
  if (!g?.s || g.s.status !== 'play') return;
  const acts = g.record.layers[app.li] ?? [];
  while (g.i < acts.length) {
    const a = acts[g.i++];
    if (!a || !canApply(g.s, a).ok) continue;
    g.s = apply(g.s, a);
    if (a.t === 'm' || a.t === 'a') g.lastOp = a.o;
    break;
  }
  renderGhost();
}

const ghostEls: HTMLElement[] = [];
let ghostTag: HTMLElement | null = null;

function renderGhost(): void {
  const g = app.ghost;
  const show = !!g?.s && prefs.ghost && app.mode === 'play' && !!boardEl;
  if (!show) {
    ghostEls.forEach((e) => e.classList.add('gone'));
    ghostTag?.classList.add('gone');
    return;
  }
  if (!ghostEls.length || !boardEl?.contains(ghostEls[0] ?? null)) {
    ghostEls.length = 0;
    CREW_FIG.forEach((name, i) => {
      const el = h('div', `op ghost c${i}`);
      el.dataset.view = 'front';
      const face = h('span', 'face');
      // Smooth mode draws ghosts simply: one small front image, no turning
      face.append(smoothActive() ? figure(name, ['front']) : figure(name));
      el.append(face);
      ghostEls.push(el);
      boardEl!.append(el);
    });
    ghostTag = h('div', 'ghost-tag');
    boardEl!.append(ghostTag);
  }
  const s = g!.s!;
  s.ops.forEach((o, i) => {
    const el = ghostEls[i];
    if (!el) return;
    el.classList.toggle('gone', o.out);
    place(el, o.x, o.y, false);
  });
  const lead = s.ops[g!.lastOp] ?? s.ops[0];
  if (ghostTag && lead) {
    setText(ghostTag, t('ghostOf', { name: g!.name }));
    ghostTag.classList.remove('gone');
    ghostTag.style.transform = `translate(calc(var(--cell) * ${lead.x} + var(--cell) / 2), calc(var(--cell) * ${lead.y}))`;
  }
}

// ------------------------------------------------------------------ living board

/** After 5 s without a move the crew look around; any action wakes them. */
function wakeFromIdle(): void {
  boardEl?.classList.remove('idle');
  window.clearTimeout(app.idleTimer);
  app.idleTimer = window.setTimeout(() => {
    if (app.mode === 'play' && !smoothActive() && !document.querySelector('.modal-back')) boardEl?.classList.add('idle');
  }, 5000);
}

/** A small puff of dust where a crew member just stepped off. */
function puff(x: number, y: number): void {
  if (!boardEl || smoothActive()) return; // no dust in Smooth mode
  const p = h('span', 'puff');
  p.style.transform = `translate(calc(var(--cell) * ${x}), calc(var(--cell) * ${y}))`;
  boardEl.append(p);
  window.setTimeout(() => p.remove(), 600);
}

// ------------------------------------------------------------------ tutorial

const TUT = ['tut1', 'tut2', 'tut3', 'tut4'] as const;
const TUT_KEY = 'heist.tutorialDone';

/** The tutorial is shown once per player: on the first layer of their first play. */
function tutorialDone(): boolean {
  try {
    return window.localStorage.getItem(TUT_KEY) === '1' || settings.onboarded;
  } catch {
    return settings.onboarded;
  }
}
function markTutorialDone(): void {
  try {
    window.localStorage.setItem(TUT_KEY, '1');
  } catch {
    /* storage blocked: the setting below still records it for this session */
  }
  saveSettings({ onboarded: true });
}

function renderTutorial(): void {
  document.querySelector('.tip')?.remove();
  if (!app.tut) return;
  const key = TUT[app.tut - 1];
  if (!key) return;
  const tip = h('button', 'tip');
  tip.append(h('b', '', `${t('tutStep', { i: app.tut, n: TUT.length })}: `), document.createTextNode(t(key)));
  tip.addEventListener('click', () => advanceTutorial(true));
  app.tutAt = Date.now();
  document.querySelector('.panel')?.append(tip);
}

/** Tapping the bubble always advances; playing advances it only after the step has been readable for 3 s. */
function advanceTutorial(tapped = false): void {
  if (!app.tut) return;
  if (!tapped && Date.now() - app.tutAt < 3000) return;
  app.tut = app.tut >= TUT.length ? 0 : app.tut + 1;
  renderTutorial();
}

// ------------------------------------------------------------------ board view

let boardEl: HTMLElement | null = null;
const tiles: HTMLElement[] = [];
const opEls: HTMLElement[] = [];
const guardEls = new Map<number, HTMLElement>();

function visibleSet(s: LayerState): Set<number> | null {
  if (!s.def.fog) return null;
  const v = new Set<number>();
  for (const o of s.ops) {
    if (o.out) continue;
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const x = o.x + dx;
        const y = o.y + dy;
        if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) v.add(idx(x, y));
      }
  }
  // The vault shows through the fog until it slips; after that only on the ping turn, then you search.
  if (s.slipAt === 0 || s.justSlipped) v.add(idx(s.vault[0], s.vault[1]));
  return v;
}

/** Put a sprite on its tile; on a change, face the direction of travel and hop. */
function place(el: HTMLElement, x: number, y: number, isGuard: boolean): void {
  const px = Number(el.dataset.x ?? x);
  const py = Number(el.dataset.y ?? y);
  if (px !== x || py !== y) {
    if (!isGuard && x !== px) el.dataset.face = x < px ? 'l' : 'r';
    // front = walking down, back = walking up, side = left/right (mirrored for left)
    if (!isGuard && el.dataset.x !== undefined) el.dataset.view = y > py ? 'front' : y < py ? 'back' : 'side';
    if (!isGuard && !el.classList.contains('ghost') && el.dataset.x !== undefined) puff(px, py);
    retrigger(el.querySelector<HTMLElement>('.hop') ?? undefined, 'go');
  }
  if (el.dataset.x === String(x) && el.dataset.y === String(y)) return;
  el.dataset.x = String(x);
  el.dataset.y = String(y);
  el.style.transform = `translate(calc(var(--cell) * ${x}), calc(var(--cell) * ${y}))`;
  el.style.zIndex = String(10 + y * 2 + (isGuard ? 0 : 1)); // lower rows stand in front
}

function moveTargets(s: LayerState): Map<number, Action> {
  const m = new Map<number, Action>();
  const o = s.ops[app.sel];
  if (!o || o.out || s.status !== 'play') return m;
  if (app.targeting) {
    const spec = SQUAD[app.sel];
    if (spec.ability === 'fold') {
      for (const [dx, dy] of Object.values(DIRS)) {
        const a: Action = { t: 'a', o: app.sel, x: o.x + dx, y: o.y + dy };
        if (canApply(s, a).ok) m.set(idx(o.x + dx, o.y + dy), a);
      }
    } else if (spec.ability === 'haze') {
      for (const g of s.guards) {
        const a: Action = { t: 'a', o: app.sel, x: g.x, y: g.y };
        if (canApply(s, a).ok) m.set(idx(g.x, g.y), a);
      }
    }
    return m;
  }
  for (const d of Object.keys(DIRS) as Dir[]) {
    const a: Action = { t: 'm', o: app.sel, d };
    if (canApply(s, a).ok) {
      const [dx, dy] = DIRS[d];
      m.set(idx(o.x + dx, o.y + dy), a);
    }
  }
  return m;
}

/** Write text only when it changes: every write dirties layout, and renderPlay runs on each move. */
function setText(el: HTMLElement | null, text: string): void {
  if (el && el.textContent !== text) el.textContent = text;
}

/** A guard looks along this op's row or column, towards it, within its range + 2 tiles. */
function facedByGuard(s: LayerState, x: number, y: number, vis: Set<number> | null): boolean {
  return s.guards.some((g) => {
    if (g.stunned > 0 || (vis && !vis.has(idx(g.x, g.y)))) return false;
    const [dx, dy] = DIRS[g.facing];
    const ax = x - g.x;
    const ay = y - g.y;
    const along = dx !== 0 ? ax * dx : ay * dy;
    const across = dx !== 0 ? ay : ax;
    return across === 0 && along > 0 && along <= s.def.range + 2;
  });
}

function renderPlay(fresh: boolean): void {
  const s = app.s;
  if (!s) return;
  if (fresh || !boardEl || !document.body.contains(boardEl)) buildPlay();
  const vis = visibleSet(s);
  const seen = new Set<number>();
  for (const g of s.guards) {
    if (vis && !vis.has(idx(g.x, g.y))) continue;
    for (const [x, y] of guardVision(s, g, s.def.range)) seen.add(idx(x, y));
  }
  const targets = moveTargets(s);
  for (let i = 0; i < SIZE * SIZE; i++) {
    const el = tiles[i]!;
    const tile = s.grid[i];
    const hidden = vis !== null && !vis.has(i);
    const cls = `tile${(i % SIZE) % 2 === Math.floor(i / SIZE) % 2 ? '' : ' alt'}${tile === 1 ? ' wall' : ''}${tile === 2 ? ' vault' : ''}${!hidden && seen.has(i) ? ' seen' : ''}${targets.has(i) ? (app.targeting ? ' target' : ' move') : ''}${hidden ? ' fog' : ''}`;
    if (el.className !== cls) el.className = cls; // only touch tiles that changed
  }
  s.ops.forEach((o, i) => {
    const el = opEls[i]!;
    place(el, o.x, o.y, false);
    el.classList.toggle('faded', o.fade > 0);
    el.classList.toggle('sel', i === app.sel && !o.out);
    if (s.lastCaught.includes(i)) el.classList.add('spotted');
    else if (!o.out) el.classList.remove('spotted');
    el.classList.toggle('out', o.out);
    el.classList.toggle('crouch', !o.out && facedByGuard(s, o.x, o.y, vis));
  });
  for (const g of s.guards) {
    const el = guardEls.get(g.id);
    if (!el) continue;
    place(el, g.x, g.y, true);
    el.dataset.facing = g.facing;
    el.style.setProperty('--sight', String(Math.max(0, guardVision(s, g, s.def.range).length - 1)));
    el.classList.toggle('stunned', g.stunned > 0);
    el.classList.toggle('hidden', !!vis && !vis.has(idx(g.x, g.y)));
    el.classList.toggle('watcher', g.kind === 'watcher');
  }
  // HUD
  const ap = document.querySelector<HTMLElement>('.ap-num');
  setText(ap, String(s.ap));
  if (!fresh) apFloat(s.ap - app.lastAp);
  app.lastAp = s.ap;
  if (s.status === 'cleared') document.querySelector('.tile.vault .art')?.classList.add('open');
  const bar = document.querySelector<HTMLElement>('.ap-fill');
  if (bar) bar.style.scale = `${Math.min(1, s.ap / s.def.ap)} 1`;
  document.querySelector('.hud')?.classList.toggle('low', s.ap <= 3);
  document.querySelectorAll<HTMLElement>('.op-card').forEach((c, i) => {
    const o = s.ops[i];
    c.classList.toggle('sel', i === app.sel);
    c.classList.toggle('out', !!o?.out);
  });
  const ab = document.querySelector<HTMLElement>('.ability-btn');
  if (ab) {
    const spec = SQUAD[app.sel];
    setText(ab, app.targeting ? t('cancel') : `${t(spec.ability)} · ${spec.cost} AP`);
    ab.title = t(`${spec.ability}Desc` as Key);
    ab.classList.toggle('on', app.targeting);
  }
  const hint = document.querySelector<HTMLElement>('.hint');
  if (hint) {
    const spec = SQUAD[app.sel];
    setText(hint, app.targeting ? (spec.ability === 'fold' ? t('pickWall') : t('pickGuard')) : s.def.fog ? t('fog') : t(`${spec.ability}Desc` as Key));
  }
}

function buildPlay(): void {
  const s = app.s!;
  ui.replaceChildren();
  const wrap = h('main', `play tier-${s.def.tier}`);
  setLayerBg(s.def.tier);
  const hud = h('div', 'hud');
  const left = h('div', 'hud-left');
  const layerName = h('b', 'layer-name', `${t('layer', { i: app.li + 1 })} · ${tierName(app.li)}`);
  if (s.def.vault2) {
    // Warn up front: this layer's vault will slip.
    const icon = h('span', 'slip-icon', '⇄');
    icon.title = t('slipWarn');
    icon.setAttribute('role', 'img');
    icon.setAttribute('aria-label', t('slipWarn'));
    layerName.append(icon);
  }
  left.append(h('span', 'kicker', `${t('night', { n: app.night })} · ${app.scored ? t('scoredTag') : t('practiceTag')}`), layerName);
  const apBox = h('div', 'ap');
  const num = h('span', 'ap-num', String(s.ap));
  const meter = h('div', 'ap-meter');
  meter.append(h('div', 'ap-fill'));
  apBox.append(num, h('small', '', t('ap')), meter);
  hud.append(left, apBox);

  const stage = h('div', 'stage');
  boardEl = h('div', 'board room');
  boardEl.style.setProperty('--range', String(s.def.range));
  const floor = h('div', 'floor');
  boardEl.append(floor);
  tiles.length = 0;
  opEls.length = 0;
  guardEls.clear();
  for (let i = 0; i < SIZE * SIZE; i++) {
    const el = h('div', 'tile');
    const x = i % SIZE;
    const y = Math.floor(i / SIZE);
    if (x === s.vault[0] && y === s.vault[1]) el.append(vaultArt());
    el.addEventListener('click', () => onTile(x, y));
    tiles.push(el);
    boardEl.append(el);
  }
  for (const g of s.guards) {
    const el = h('div', `guard${g.kind === 'watcher' ? ' watcher' : ''}`);
    el.style.setProperty('--blink', `${(0.9 + ((g.id * 7) % 5) * 0.35).toFixed(2)}s`);
    const face = h('span', 'face');
    const hop = h('span', 'hop');
    const bob = h('span', 'bob');
    bob.append(figure('guard'));
    hop.append(bob);
    face.append(hop);
    el.append(h('span', 'cone'), h('span', 'ring'), h('span', 'dir'), face, h('span', 'zzz', 'Zzz'));
    el.addEventListener('click', () => onTile(app.s!.guards.find((q) => q.id === g.id)!.x, app.s!.guards.find((q) => q.id === g.id)!.y));
    guardEls.set(g.id, el);
    boardEl.append(el);
  }
  SQUAD.forEach((_sq, i) => {
    const el = h('div', `op c${i}`);
    const face = h('span', 'face');
    const hop = h('span', 'hop');
    const bob = h('span', 'bob');
    bob.append(figure(CREW_FIG[i] ?? 'vale'));
    el.dataset.view = 'front';
    hop.append(bob);
    face.append(hop);
    el.append(h('span', 'ring'), face, h('span', 'alert', '!'), h('span', 'fx'));
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      select(i as OpId);
    });
    opEls.push(el);
    boardEl!.append(el);
  });
  stage.append(boardEl);
  bindSwipe(boardEl);
  // Draw the floor at the board's real size once it is laid out (smaller in Smooth mode).
  const board = boardEl;
  requestAnimationFrame(() => {
    const ratio = smoothActive() ? 1 : Math.min(2, window.devicePixelRatio || 1);
    floor.append(floorCanvas(app.night * 7 + app.li + 1, board.clientWidth * ratio));
  });

  const panel = h('div', 'panel');
  const cards = h('div', 'op-cards');
  SQUAD.forEach((_sq, i) => {
    const c = h('button', `op-card c${i}`);
    c.append(figure(CREW_FIG[i] ?? 'vale', ['front']), h('span', 'nm', shortName(i)), h('small', '', `${i + 1}`));
    c.addEventListener('click', () => select(i as OpId));
    cards.append(c);
  });
  const row = h('div', 'act-row');
  const ab = h('button', 'btn ability-btn');
  ab.addEventListener('click', onAbility);
  const wait = h('button', 'btn', `${t('wait')} · 1 AP`);
  wait.title = t('waitDesc');
  wait.addEventListener('click', () => act({ t: 'w' }));
  const how = h('button', 'btn icon', '?');
  how.setAttribute('aria-label', t('howto'));
  how.addEventListener('click', showHowTo);
  const gear = h('button', 'btn icon', '⚙');
  gear.setAttribute('aria-label', t('settings'));
  gear.addEventListener('click', showSettings);
  row.append(ab, wait, how, gear);
  panel.append(cards, row, h('p', 'hint'));
  wrap.append(hud, stage, panel);
  ui.append(wrap);
  wrap.classList.add('dive');
  app.lastAp = s.ap;
  ghostEls.length = 0;
  renderGhost();
  wakeFromIdle();
  // First play: a short tutorial bubble instead of the full how-to.
  if (app.li === 0 && !app.tut && !tutorialDone()) {
    app.tut = 1;
    // Saved as soon as it appears, so it never shows again (not on later layers, not on later plays).
    markTutorialDone();
  } else if (app.li > 0) app.tut = 0;
  renderTutorial();
}

function select(i: OpId): void {
  if (!app.s || app.s.ops[i]?.out) return;
  if (app.sel !== i) audio.click();
  app.sel = i;
  app.targeting = false;
  renderPlay(false);
}

function onAbility(): void {
  const s = app.s;
  if (!s) return;
  if (app.targeting) {
    app.targeting = false;
    renderPlay(false);
    return;
  }
  const spec = SQUAD[app.sel];
  if (s.ap < spec.cost) {
    audio.bump();
    toast(t('noAp'));
    return;
  }
  if (spec.ability === 'fade') {
    act({ t: 'a', o: app.sel, x: 0, y: 0 });
    return;
  }
  app.targeting = true;
  if (moveTargets(s).size === 0) {
    app.targeting = false;
    audio.bump();
    toast(spec.ability === 'fold' ? t('pickWall') : t('pickGuard'));
  }
  renderPlay(false);
}

function onTile(x: number, y: number): void {
  const s = app.s;
  if (!s || app.mode !== 'play') return;
  audio.unlock();
  const opAt = s.ops.findIndex((o) => !o.out && o.x === x && o.y === y);
  if (!app.targeting && opAt >= 0) {
    select(opAt as OpId);
    return;
  }
  const a = moveTargets(s).get(idx(x, y));
  if (a) act(a);
  else if (app.targeting) {
    app.targeting = false;
    renderPlay(false);
  }
}

function moveDir(d: Dir): void {
  act({ t: 'm', o: app.sel, d });
}

function bindSwipe(el: HTMLElement): void {
  let sx = 0;
  let sy = 0;
  let down = false;
  el.addEventListener('pointerdown', (e) => {
    sx = e.clientX;
    sy = e.clientY;
    down = true;
  });
  el.addEventListener('pointerup', (e) => {
    if (!down) return;
    down = false;
    const dx = e.clientX - sx;
    const dy = e.clientY - sy;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 30) return;
    moveDir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'r' : 'l') : dy > 0 ? 'd' : 'u');
  });
}

window.addEventListener('keydown', (e) => {
  if (app.mode !== 'play' || document.querySelector('.modal-back')) {
    if (e.key === 'Escape') closeModal();
    return;
  }
  const k = e.key.toLowerCase();
  const map: Record<string, Dir> = { arrowup: 'u', w: 'u', arrowdown: 'd', s: 'd', arrowleft: 'l', a: 'l', arrowright: 'r', d: 'r' };
  const d = map[k];
  if (d) {
    e.preventDefault();
    moveDir(d);
  } else if (k === '1' || k === '2' || k === '3') select((Number(k) - 1) as OpId);
  else if (k === 'e') onAbility();
  else if (k === 'q' || k === ' ') {
    e.preventDefault();
    act({ t: 'w' });
  } else if (k === 'escape' && app.targeting) {
    app.targeting = false;
    renderPlay(false);
  }
});

// ------------------------------------------------------------------ boot

function render(): void {
  document.documentElement.lang = getLang();
  if (app.mode === 'play') renderPlay(true);
  else if (app.mode === 'title') renderTitle();
}

void (async () => {
  render();
  const init = await call<HeistInit>('init');
  if (init) {
    app.init = init;
    app.night = init.postNight;
    app.nextAt = Date.now() + init.nextMs;
  }
  if (app.mode === 'title') render();
})();
