import { DIFFICULTIES, MOVE_SLACK, type Difficulty } from '../../shared/logic/difficulty.ts';
import { isLucid, moonsFor, scoreRun, shareLine, type LayerResult } from '../../shared/logic/score.ts';
import { SEASON_NIGHTS } from '../../shared/logic/season.ts';
import type { AbilityId } from '../../shared/logic/types.ts';
import { audio } from '../core/audio.ts';
import { canvas, drawLighthouseCard, drawLogo, iconCanvas } from '../core/art.ts';
import { CLOAKS, LANTERNS, THEMES, cssHex } from '../core/palette.ts';
import { saveSettings, settings, type MotionPref, type ThemeId } from '../core/settings.ts';
import { hasKey, t, type StringKey } from '../i18n/index.ts';
import { button, h } from './dom.ts';

const k = (key: string): StringKey => (hasKey(key) ? key : 'app.name');

// ---------------------------------------------------------------- title

export function titleScreen(opts: { night: number; dreamer: string; onDive: () => void; onSettings: () => void }): HTMLElement {
  const logo = canvas(560, 180, drawLogo, Math.min(2, window.devicePixelRatio || 1));
  logo.className = 'logo';
  const pct = Math.round((opts.night / SEASON_NIGHTS) * 100);
  const bar = h('div', 'bar', h('i'));
  const fill = bar.firstElementChild;
  if (fill instanceof HTMLElement) fill.style.width = `${pct}%`;
  return h(
    'div',
    'screen title',
    button(`⚙ ${t('title.settings')}`, 'corner left', opts.onSettings),
    h('div', 'season', t('title.season')),
    logo,
    h('div', 'tagline', t('app.tagline')),
    h('div', 'spacer'),
    h('div', 'progress', t('title.progress', { night: opts.night, total: SEASON_NIGHTS })),
    bar,
    h('div', 'night', t('title.night', { night: opts.night, dreamer: opts.dreamer })),
    button(t('title.dive'), 'pill', opts.onDive)
  );
}

// ---------------------------------------------------------------- pick

export function pickScreen(opts: { favours: AbilityId; hintKey: string; onStart: (a: AbilityId, d: Difficulty) => void }): HTMLElement {
  let chosen: AbilityId = opts.favours;
  const abilities: AbilityId[] = ['still', 'blink', 'lantern'];
  const cards = abilities.map((id, i) => {
    const el = h('div', 'ability', iconCanvas(id, 112), h('b', {}, `${i + 1}  ${t(k(`ability.${id}`))}`), h('span', {}, t(k(`ability.${id}.desc`))));
    el.addEventListener('click', () => select(id));
    return el;
  });
  const select = (id: AbilityId, silent = false) => {
    chosen = id;
    if (!silent) audio.click();
    cards.forEach((c, i) => c.classList.toggle('on', abilities[i] === id));
  };
  select(chosen, true);

  const desc = h('div', 'diffdesc');
  const segButtons = DIFFICULTIES.map((d) =>
    button(t(k(`diff.${d}`)), d === settings.difficulty ? 'on' : '', () => {
      saveSettings({ difficulty: d });
      segButtons.forEach((b, i) => b.classList.toggle('on', DIFFICULTIES[i] === d));
      desc.textContent = t(k(`diff.${d}.desc`));
    })
  );
  desc.textContent = t(k(`diff.${settings.difficulty}.desc`));

  const start = () => opts.onStart(chosen, settings.difficulty);
  const el = h(
    'div',
    'screen pick',
    h('h1', {}, t('pick.heading')),
    h('div', 'sub', t('pick.sub')),
    h('div', 'hint', t(k(opts.hintKey))),
    h('div', 'cards', ...cards),
    h('div', 'seg', ...segButtons),
    desc,
    button(t('pick.start'), 'pill', start)
  );
  const keys = (e: KeyboardEvent) => {
    if (el.classList.contains('hidden')) return;
    const map: Record<string, AbilityId> = { Digit1: 'still', Digit2: 'blink', Digit3: 'lantern' };
    const id = map[e.code];
    if (id) select(id);
    if (e.code === 'Enter') start();
  };
  window.addEventListener('keydown', keys);
  return el;
}

// ---------------------------------------------------------------- settings

export function settingsScreen(opts: { inGame: boolean; onClose: () => void; onQuit: () => void; onChange: () => void }): HTMLElement {
  const changed = () => {
    audio.applyVolumes();
    opts.onChange();
  };
  const slider = (key: 'music' | 'sfx') => {
    const input = h('input', { type: 'range', min: 0, max: 100, value: Math.round(settings[key] * 100) });
    input.addEventListener('input', () => {
      saveSettings({ [key]: Number(input.value) / 100 });
      changed();
    });
    return input;
  };
  const seg = <T extends string>(values: readonly T[], current: () => T, label: (v: T) => string, set: (v: T) => void) => {
    const bs: HTMLButtonElement[] = values.map((v) =>
      button(label(v), v === current() ? 'on' : '', () => {
        set(v);
        bs.forEach((b, i) => b.classList.toggle('on', values[i] === v));
        changed();
      })
    );
    return h('div', 'seg', ...bs);
  };
  const themeChips: HTMLButtonElement[] = THEMES.map((th) =>
    button(th.label, `theme-chip${th.id === settings.theme ? ' on' : ''}`, () => {
      saveSettings({ theme: th.id });
      themeChips.forEach((c, i) => c.classList.toggle('on', THEMES[i]?.id === th.id));
      changed();
    })
  );
  const swatchRow = (items: readonly { id: string; label: string; color: number; nights: number }[], key: 'cloak' | 'lantern') => {
    const els: HTMLElement[] = items.map((it) => {
      const locked = settings.streak < it.nights;
      const sw = h('div', { class: `swatch${settings[key] === it.id ? ' on' : ''}${locked ? ' locked' : ''}`, title: it.label });
      sw.style.background = cssHex(it.color);
      if (locked) sw.append(h('small', {}, `🔒 ${t('settings.locked', { nights: it.nights })}`));
      sw.addEventListener('click', () => {
        if (locked) return;
        audio.click();
        saveSettings({ [key]: it.id });
        els.forEach((e, i) => e.classList.toggle('on', items[i]?.id === it.id));
        changed();
      });
      return sw;
    });
    return h('div', 'swatches', ...els);
  };
  const row = (label: string, control: Node) => h('div', 'row', h('label', {}, label), control);

  const panel = h(
    'div',
    'panel',
    h('h2', {}, t('settings.title')),
    row(t('settings.music'), slider('music')),
    row(t('settings.sfx'), slider('sfx')),
    row(
      t('settings.quality'),
      seg(['high', 'low'] as const, () => settings.quality, (v) => t(v === 'high' ? 'settings.quality.high' : 'settings.quality.low'), (v) => saveSettings({ quality: v }))
    ),
    row(
      t('settings.vibration'),
      seg(['on', 'off'] as const, () => (settings.vibration ? 'on' : 'off'), (v) => t(v === 'on' ? 'settings.on' : 'settings.off'), (v) => saveSettings({ vibration: v === 'on' }))
    ),
    row(
      t('settings.motion'),
      seg(['system', 'on', 'off'] as const, () => settings.motion, (v: MotionPref) => t(k(`settings.motion.${v}`)), (v) => saveSettings({ motion: v }))
    ),
    row(t('settings.theme'), h('div', 'swatches', ...themeChips)),
    row(t('settings.cloak'), swatchRow(CLOAKS, 'cloak')),
    row(t('settings.lantern'), swatchRow(LANTERNS, 'lantern')),
    h('div', 'credits', h('b', {}, `${t('settings.credits')}. `), t('settings.credits.body'), h('br'), t('settings.streak', { nights: settings.streak })),
    h(
      'div',
      'actions',
      button(opts.inGame ? t('settings.resume') : t('settings.done'), 'pill', opts.onClose),
      opts.inGame ? button(t('settings.quit'), 'link', opts.onQuit) : null
    )
  );
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  return h('div', 'screen settings', panel);
}

export function applyThemeCss(id: ThemeId): void {
  const th = THEMES.find((x) => x.id === id);
  if (!th) return;
  document.documentElement.style.setProperty('--accent', th.ui.accent);
  document.documentElement.style.setProperty('--ink', th.ui.ink);
}

// ---------------------------------------------------------------- story card

export function cardScreen(opts: { dreamer: string; results: LayerResult[]; onWake: () => void }): HTMLElement {
  const d = opts.dreamer;
  const art = canvas(280, 180, drawLighthouseCard, 2);
  const slack = MOVE_SLACK[settings.difficulty];
  const moons = opts.results.map((r) => '●'.repeat(moonsFor(r, slack)).padEnd(3, '○')).join('   ');
  return h(
    'div',
    'screen cardwrap',
    h(
      'div',
      'card',
      h(
        'div',
        'inner',
        art,
        h('div', 'kicker', t('card.memory')),
        h('h2', {}, t(k(`dreamer.${d}.name`))),
        h('p', {}, t(k(`dreamer.${d}.card`))),
        h('div', 'cluek', t('card.clue')),
        h('p', 'clue', t(k(`dreamer.${d}.clue`))),
        h('div', 'moons', moons)
      )
    ),
    button(t('card.wake'), 'pill', opts.onWake)
  );
}

// ---------------------------------------------------------------- results

export function resultsScreen(opts: { night: number; layers: number; results: LayerResult[]; onAgain: () => void }): HTMLElement {
  const { results, layers } = opts;
  const slack = MOVE_SLACK[settings.difficulty];
  const cleared = results.length === layers && results.every((r) => r.cleared);
  const rows = Array.from({ length: layers }, (_, i) => {
    const r = results[i];
    const m = r ? moonsFor(r, slack) : 0;
    return h('tr', r?.cleared ? '' : 'miss', h('td', {}, t(k(`layer.name.${i + 1}`))), h('td', {}, '●'.repeat(m) + '○'.repeat(3 - m)));
  });
  const near = nearMiss(results, layers, slack);
  return h(
    'div',
    'screen results',
    h('h1', {}, cleared ? t('wake.title.cleared') : t('wake.title.failed')),
    h('div', 'score', `${t('wake.score', { score: scoreRun(results, layers, slack) })} · ${t(k(`diff.${settings.difficulty}`))}`),
    isLucid(results, layers, slack) ? h('div', 'lucid', `✦ ${t('wake.lucid')} ✦`) : null,
    h('table', {}, ...rows),
    near ? h('div', 'near', t('wake.near', { near })) : null,
    h('div', 'share', t('wake.share.preview')),
    h('code', {}, shareLine(opts.night, results, slack)),
    button(t('wake.again'), 'pill', opts.onAgain)
  );
}

function nearMiss(results: readonly LayerResult[], layers: number, slack: number): string | null {
  const last = results.at(-1);
  if (!last) return null;
  if (!last.cleared) return t('near.pull', { layer: results.length });
  if (results.length === layers) {
    const close = results.find((r) => moonsFor(r, slack) === 2 && r.moves > r.par + slack && r.moves <= r.par + slack + 2);
    if (close) {
      const n = close.moves - close.par - slack;
      return n === 1 ? t('near.moons.one') : t('near.moons.many', { n });
    }
  }
  return null;
}

// ---------------------------------------------------------------- how to play

export function howToScreen(onDone: () => void): { el: HTMLElement; finish: () => void } {
  const steps = ['how.1', 'how.2', 'how.3'] as const;
  const text = h('p', {}, t(steps[0]));
  const dots = h('div', 'dots', '● ○ ○');
  const box = h('div', 'howto', text, dots, h('small', {}, t('how.skip')));
  let i = 0;
  const timer = window.setInterval(() => {
    i += 1;
    if (i >= steps.length) return finish();
    const key = steps[i];
    if (key) text.textContent = t(key);
    dots.textContent = steps.map((_, j) => (j === i ? '●' : '○')).join(' ');
  }, 3300);
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearInterval(timer);
    box.remove();
    onDone();
  };
  box.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    finish();
  });
  return { el: box, finish };
}
