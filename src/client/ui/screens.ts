import type { BoardRow, LeaderboardResponse, RunResponse } from '../../shared/api.ts';
import { nightInfo } from '../../shared/dreams/season1.ts';
import { story } from '../../shared/dreams/story.ts';
import { DIFFICULTIES, MOVE_SLACK, type Difficulty } from '../../shared/logic/difficulty.ts';
import { isLucid, moonsFor, scoreRun, shareLine, type LayerResult } from '../../shared/logic/score.ts';
import { archiveStatus, SEASON_NIGHTS } from '../../shared/logic/season.ts';
import type { AbilityId, TwistId } from '../../shared/logic/types.ts';
import { audio } from '../core/audio.ts';
import { canvas, drawLighthouseCard, drawLogo, drawMemoryCard, iconCanvas } from '../core/art.ts';
import { CLOAKS, LANTERNS, THEMES, cssHex } from '../core/palette.ts';
import { saveSettings, settings, type MotionPref, type ThemeId } from '../core/settings.ts';
import { hasKey, t, type StringKey } from '../i18n/index.ts';
import { button, h } from './dom.ts';

const k = (key: string): StringKey => (hasKey(key) ? key : 'app.name');

export function formatCountdown(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

// ---------------------------------------------------------------- title

export type TitleInfo = {
  night: number;
  status: string;
  streak: number;
  nextDreamAt: number | null;
  onDive: () => void;
  onSettings: () => void;
  onArchive: () => void;
  onBoard: () => void;
};

export function titleScreen(o: TitleInfo): HTMLElement {
  const logo = canvas(560, 180, drawLogo, Math.min(2, window.devicePixelRatio || 1));
  logo.className = 'logo';
  const bar = h('div', 'bar', h('i'));
  const fill = bar.firstElementChild;
  if (fill instanceof HTMLElement) fill.style.width = `${Math.round((o.night / SEASON_NIGHTS) * 100)}%`;
  const countdown = h('div', 'countdown');
  const tickCountdown = () => {
    if (!o.nextDreamAt) return;
    countdown.textContent = t('title.next', { time: formatCountdown(o.nextDreamAt - Date.now()) });
    if (countdown.isConnected) window.setTimeout(tickCountdown, 1000);
  };
  const el = h(
    'div',
    'screen title',
    button(`⚙ ${t('title.settings')}`, 'corner left', o.onSettings),
    o.streak > 0 ? h('div', 'corner right streak', t('title.streak', { nights: o.streak })) : null,
    h('div', 'season', t('title.season')),
    logo,
    h('div', 'tagline', t('app.tagline')),
    h('div', 'spacer'),
    h('div', 'progress', t('title.progress', { night: o.night, total: SEASON_NIGHTS })),
    bar,
    h('div', 'night', t('title.night', { night: o.night, dreamer: story(nightInfo(o.night).dreamer).role })),
    h('div', 'status', o.status),
    button(t('title.dive'), 'pill', o.onDive),
    h('div', 'links', button(t('title.archive'), 'link', o.onArchive), h('span', {}, '·'), button(t('title.board'), 'link', o.onBoard)),
    countdown
  );
  window.setTimeout(tickCountdown, 0);
  return el;
}

// ---------------------------------------------------------------- pick

export function pickScreen(opts: { favours: AbilityId; hint: string; badge: string; onStart: (a: AbilityId, d: Difficulty) => void; onBack: () => void }): HTMLElement {
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
    button('←', 'corner left', opts.onBack),
    h('div', 'badge', opts.badge),
    h('h1', {}, t('pick.heading')),
    h('div', 'sub', t('pick.sub')),
    h('div', 'hint', opts.hint),
    h('div', 'cards', ...cards),
    h('div', 'seg', ...segButtons),
    desc,
    button(t('pick.start'), 'pill', start)
  );
  const keys = (e: KeyboardEvent) => {
    if (!el.isConnected) return window.removeEventListener('keydown', keys);
    const map: Record<string, AbilityId> = { Digit1: 'still', Digit2: 'blink', Digit3: 'lantern' };
    const id = map[e.code];
    if (id) select(id);
    if (e.code === 'Enter') start();
  };
  window.addEventListener('keydown', keys);
  return el;
}

// ---------------------------------------------------------------- settings

export function settingsScreen(opts: { inGame: boolean; loggedIn: boolean; onClose: () => void; onQuit: () => void; onChange: () => void }): HTMLElement {
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
  const onOff = (cur: () => boolean, set: (v: boolean) => void) =>
    seg(['on', 'off'] as const, () => (cur() ? 'on' : 'off'), (v) => t(v === 'on' ? 'settings.on' : 'settings.off'), (v) => set(v === 'on'));

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
    row(t('settings.vibration'), onOff(() => settings.vibration, (v) => saveSettings({ vibration: v }))),
    row(
      t('settings.motion'),
      seg(['system', 'on', 'off'] as const, () => settings.motion, (v: MotionPref) => t(k(`settings.motion.${v}`)), (v) => saveSettings({ motion: v }))
    ),
    row(t('settings.theme'), h('div', 'swatches', ...themeChips)),
    row(t('settings.cloak'), swatchRow(CLOAKS, 'cloak')),
    row(t('settings.lantern'), swatchRow(LANTERNS, 'lantern')),
    opts.loggedIn ? row(t('settings.flair'), h('div', 'stack', onOff(() => settings.flair, (v) => saveSettings({ flair: v })), h('small', {}, t('settings.flair.desc')))) : null,
    h('div', 'credits', h('b', {}, `${t('settings.credits')}. `), t('settings.credits.body'), h('br'), t('settings.streak', { nights: settings.streak })),
    h('div', 'actions', button(opts.inGame ? t('settings.resume') : t('settings.done'), 'pill', opts.onClose), opts.inGame ? button(t('settings.quit'), 'link', opts.onQuit) : null)
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

export function cardArt(dreamer: string): HTMLCanvasElement {
  if (dreamer === 'ines') return canvas(280, 180, drawLighthouseCard, 2);
  const st = story(dreamer);
  return canvas(280, 180, (c, w, hh) => drawMemoryCard(c, w, hh, dreamer.length * 977 + (dreamer.charCodeAt(0) || 0), st.name.charAt(0)), 2);
}

export function cardScreen(opts: { dreamer: string; results: LayerResult[] | null; action: string; onAction: () => void }): HTMLElement {
  const st = story(opts.dreamer);
  const slack = MOVE_SLACK[settings.difficulty];
  const moons = opts.results ? opts.results.map((r) => '●'.repeat(moonsFor(r, slack)).padEnd(3, '○')).join('   ') : '';
  return h(
    'div',
    'screen cardwrap',
    h(
      'div',
      'card',
      h(
        'div',
        'inner',
        cardArt(opts.dreamer),
        h('div', 'kicker', t('card.memory')),
        h('h2', {}, st.name),
        h('p', {}, st.card),
        h('div', 'cluek', t('card.clue')),
        h('p', 'clue', st.clue),
        moons ? h('div', 'moons', moons) : null
      )
    ),
    button(opts.action, 'pill', opts.onAction)
  );
}

// ---------------------------------------------------------------- results

export type ResultsOpts = {
  night: number;
  layers: number;
  results: LayerResult[];
  server: RunResponse | null;
  practiceReason: string | null;
  canShare: boolean;
  username: string | null;
  vote: { options: TwistId[]; mine: TwistId | null } | null;
  onShare: () => Promise<string>;
  onVote: (t: TwistId) => Promise<boolean>;
  onAgain: () => void;
  onBoard: () => void;
  onArchive: () => void;
};

export function resultsScreen(o: ResultsOpts): HTMLElement {
  const slack = MOVE_SLACK[settings.difficulty];
  const results = o.server?.results ?? o.results;
  const cleared = results.length === o.layers && results.every((r) => r.cleared);
  const score = o.server?.score ?? scoreRun(results, o.layers, slack);
  const rows = Array.from({ length: o.layers }, (_, i) => {
    const r = results[i];
    const m = r ? moonsFor(r, slack) : 0;
    const name = o.layers > 3 ? t('layer.name.n', { n: i + 1 }) : t(k(`layer.name.${i + 1}`));
    return h('tr', r?.cleared ? '' : 'miss', h('td', {}, name), h('td', {}, '●'.repeat(m) + '○'.repeat(3 - m)));
  });
  const near = nearMiss(results, o.layers, slack);
  const official = o.server?.scored ? (o.server.rank ? t('results.official', { score, rank: o.server.rank }) : t('wake.score', { score })) : (o.practiceReason ?? t('results.practice'));
  const line = shareLine(o.night, results, slack);

  const shareBox = h('div', 'sharebox');
  if (o.canShare) {
    const shareBtn = button(t('results.share'), 'pill small', () => {
      shareBox.replaceChildren(
        h('div', 'confirm', t('results.share.confirm', { name: o.username ?? 'you' })),
        h('code', {}, line),
        h(
          'div',
          'row2',
          button(t('results.share.yes'), 'pill small', () => {
            shareBox.replaceChildren(h('div', 'confirm', '…'));
            void o.onShare().then((msg) => shareBox.replaceChildren(h('div', 'confirm', msg)));
          }),
          button(t('results.share.no'), 'link', () => shareBox.replaceChildren(shareBtn))
        )
      );
    });
    shareBox.append(shareBtn);
  }

  const voteBox = h('div', 'votebox');
  if (o.vote) {
    const vote = o.vote;
    const render = (mine: TwistId | null) => {
      voteBox.replaceChildren(
        h('div', 'share', t('results.vote')),
        h(
          'div',
          'chips',
          ...vote.options.map((opt) => {
            const b = button(t(k(`twist.name.${opt}`)), `theme-chip${mine === opt ? ' on' : ''}`, () => {
              if (mine) return;
              void o.onVote(opt).then((ok) => {
                if (ok) render(opt);
              });
            });
            if (mine) b.setAttribute('disabled', '');
            return b;
          })
        ),
        h('small', {}, mine ? t('results.voted') : '')
      );
    };
    render(vote.mine);
  }

  return h(
    'div',
    'screen results',
    h('h1', {}, cleared ? t('wake.title.cleared') : t('wake.title.failed')),
    h('div', 'score', `${t('wake.score', { score })} · ${t(k(`diff.${settings.difficulty}`))}`),
    h('div', 'official', official),
    isLucid(results, o.layers, slack) ? h('div', 'lucid', `✦ ${t('wake.lucid')} ✦`) : null,
    o.server?.scored && o.server.streak.count > 0 ? h('div', 'official', t('results.streak', { nights: o.server.streak.count })) : null,
    h('table', {}, ...rows),
    near ? h('div', 'near', t('wake.near', { near })) : null,
    h('div', 'share', t('wake.share.preview')),
    h('code', {}, line),
    shareBox,
    voteBox,
    button(t('wake.again'), 'pill', o.onAgain),
    h('div', 'links', button(t('results.board'), 'link', o.onBoard), h('span', {}, '·'), button(t('results.archive'), 'link', o.onArchive))
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

// ---------------------------------------------------------------- archive (memory wall)

export function archiveScreen(o: { cards: number[]; onPlay: (night: number) => void; onCard: (night: number) => void; onClose: () => void }): HTMLElement {
  const tiles = Array.from({ length: SEASON_NIGHTS }, (_, i) => {
    const night = i + 1;
    const status = archiveStatus(night);
    const have = o.cards.includes(night);
    const st = story(nightInfo(night).dreamer);
    const tile = h(
      'button',
      { class: `night-tile ${status}${have ? ' have' : ''}`, type: 'button' },
      h('b', {}, String(night)),
      h('span', {}, status === 'locked' ? t('archive.locked') : st.name),
      status === 'tonight' ? h('i', {}, t('archive.tonight')) : have ? h('i', {}, '✦') : null
    );
    tile.addEventListener('click', (e) => {
      e.stopPropagation();
      if (status === 'locked') return;
      audio.click();
      if (have) o.onCard(night);
      else o.onPlay(night);
    });
    return tile;
  });
  const panel = h(
    'div',
    'panel wide',
    h('h2', {}, t('archive.title')),
    h('div', 'sub center', t('archive.sub')),
    h('div', 'sub center', t('archive.collected', { n: o.cards.length, total: SEASON_NIGHTS })),
    h('div', 'nights', ...tiles),
    h('div', 'actions', button(t('archive.close'), 'pill small', o.onClose))
  );
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  return h('div', 'screen settings', panel);
}

// ---------------------------------------------------------------- leaderboard

export function leaderboardScreen(o: { night: number; load: (board: string) => Promise<LeaderboardResponse | null>; onClose: () => void }): HTMLElement {
  const boards = [...DIFFICULTIES, 'deep'] as const;
  const list = h('div', 'board');
  const tabs: HTMLButtonElement[] = boards.map((b) =>
    button(b === 'deep' ? t('board.deep') : t(k(`diff.${b}`)), b === settings.difficulty ? 'on' : '', () => show(b))
  );
  const row = (r: BoardRow, deep: boolean) => {
    const avatar = r.snoovatar ? h('img', { src: r.snoovatar, alt: '', loading: 'lazy' }) : h('span', 'initial', r.name.charAt(0).toUpperCase());
    if (avatar instanceof HTMLImageElement) avatar.addEventListener('error', () => avatar.replaceWith(h('span', 'initial', r.name.charAt(0).toUpperCase())));
    return h('div', `brow${r.me ? ' me' : ''}`, h('b', {}, `#${r.rank}`), avatar, h('span', 'bname', r.me ? `${r.name} (${t('board.you')})` : r.name), h('span', 'bscore', deep ? t('board.layers', { n: r.score }) : String(r.score)));
  };
  const show = (b: string) => {
    tabs.forEach((x, i) => x.classList.toggle('on', boards[i] === b));
    list.replaceChildren(h('div', 'sub center', '…'));
    void o.load(b).then((res) => {
      if (!res || !res.rows.length) {
        list.replaceChildren(h('div', 'sub center', t('board.empty')));
        return;
      }
      const deep = b === 'deep';
      list.replaceChildren(...res.rows.map((r) => row(r, deep)));
      if (res.me && !res.rows.some((r) => r.me)) list.append(h('div', 'gap', '⋯'), row(res.me, deep));
    });
  };
  const panel = h(
    'div',
    'panel',
    h('h2', {}, t('board.title')),
    h('div', 'sub center', t('board.night', { night: o.night })),
    h('div', 'seg tabs', ...tabs),
    list,
    h('div', 'actions', button(t('archive.close'), 'pill small', o.onClose))
  );
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  window.setTimeout(() => show(settings.difficulty), 0);
  return h('div', 'screen settings', panel);
}

// ---------------------------------------------------------------- how to play

export function howToScreen(onDone: () => void): { el: HTMLElement; finish: () => void } {
  const steps = ['how.1', 'how.2', 'how.3'] as const;
  const text = h('p', {}, t(steps[0]));
  const dots = h('div', 'dots', '● ○ ○');
  const box = h('div', 'howto', text, dots, h('small', {}, t('how.skip')));
  let i = 0;
  let done = false;
  const finish = () => {
    if (done) return;
    done = true;
    window.clearInterval(timer);
    box.remove();
    onDone();
  };
  const timer = window.setInterval(() => {
    i += 1;
    if (i >= steps.length) return finish();
    const key = steps[i];
    if (key) text.textContent = t(key);
    dots.textContent = steps.map((_, j) => (j === i ? '●' : '○')).join(' ');
  }, 3300);
  box.addEventListener('pointerdown', (e) => {
    e.stopPropagation();
    finish();
  });
  return { el: box, finish };
}
