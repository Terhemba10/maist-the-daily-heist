import type { InitResponse, PlayerSettings, RunResponse } from '../shared/api.ts';
import { nightInfo } from '../shared/dreams/season1.ts';
import { story } from '../shared/dreams/story.ts';
import type { Difficulty } from '../shared/logic/difficulty.ts';
import { buildDream } from '../shared/logic/generator.ts';
import type { RunRecord } from '../shared/logic/replay.ts';
import type { LayerResult } from '../shared/logic/score.ts';
import { currentNight, msUntilNextDream } from '../shared/logic/season.ts';
import type { AbilityId, Dir, DreamDef, TwistId } from '../shared/logic/types.ts';
import { api } from './core/api.ts';
import { audio } from './core/audio.ts';
import { theme } from './core/palette.ts';
import { onSettingsChange, saveSettings, settings, type MotionPref, type Quality, type ThemeId } from './core/settings.ts';
import { DreamRun } from './game/dream.ts';
import { t } from './i18n/index.ts';
import { Diver } from './three/diver.ts';
import { RoomView } from './three/room3d.ts';
import { World } from './three/world.ts';
import { h, toast, ui } from './ui/dom.ts';
import { Hud } from './ui/hud.ts';
import {
  applyThemeCss,
  archiveScreen,
  cardScreen,
  howToScreen,
  leaderboardScreen,
  pickScreen,
  resultsScreen,
  settingsScreen,
  titleScreen,
} from './ui/screens.ts';

type Mode = 'title' | 'pick' | 'dream' | 'card' | 'results';

const params = new URLSearchParams(window.location.search);
const demo = params.get('demo') ?? '';
const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function abilityParam(v: string | null): AbilityId {
  return v === 'still' || v === 'blink' ? v : 'lantern';
}

/** Settings fields that follow the player across devices (saved in Redis). */
const SYNCED = ['music', 'sfx', 'vibration', 'motion', 'theme', 'cloak', 'lantern', 'difficulty', 'flair', 'quality', 'onboarded'] as const;

class App {
  private world: World;
  private mode: Mode = 'title';
  private screen: HTMLElement | null = null;
  private overlay: HTMLElement | null = null;
  private run: DreamRun | null = null;
  private hud: Hud | null = null;
  private preview: { room: RoomView; diver: Diver; off: () => void } | null = null;
  private howto: { el: HTMLElement; finish: () => void } | null = null;
  private pointer: { x: number; y: number } | null = null;
  private padHeld = new Set<number>();
  private stickReady = true;
  private lastTheme = settings.theme;
  private server: InitResponse | null = null;
  private loaded = false;
  /** What is being played right now. */
  private playing: { night: number; dream: DreamDef; scored: boolean; difficulty: Difficulty } | null = null;
  private syncTimer: number | null = null;

  constructor() {
    const stage = document.getElementById('stage');
    if (!stage) throw new Error('#stage missing');
    this.world = new World(stage);
    ui().append(h('div', 'fade'));
    applyThemeCss(settings.theme);
    this.bindInput(stage);
    this.world.onFrame(() => this.pollGamepad());
    onSettingsChange(() => {
      applyThemeCss(settings.theme);
      this.queueSync();
    });
    Object.assign(window, { __maist: { app: this, run: () => this.run, world: this.world } });

    if (demo === 'pick') this.showPick(currentNight());
    else if (demo === 'dream' || demo === 'vault') {
      const layer = Math.max(0, Math.min(2, Number(params.get('layer') ?? '1') - 1));
      const night = Number(params.get('night') ?? '1');
      this.startDream(night, null, abilityParam(params.get('ability')), settings.difficulty, demo === 'vault' ? 2 : layer, false);
    } else if (demo === 'settings') {
      this.showTitle();
      this.openSettings();
    } else if (demo === 'archive') {
      this.showTitle();
      this.openArchive();
    } else this.showTitle();

    void this.load();
  }

  // ---------------------------------------------------------------- server state

  private async load(): Promise<void> {
    const init = await api.init();
    this.loaded = true;
    if (init) {
      this.server = init;
      this.applyServerSettings(init.settings);
      saveSettings({ streak: init.streak.count });
    }
    if (this.mode === 'title' && !this.overlay) this.showTitle();
  }

  private applyServerSettings(s: PlayerSettings | null): void {
    if (!s) return;
    const patch: Partial<typeof settings> = {};
    const num = (v: unknown) => (typeof v === 'number' ? v : undefined);
    const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
    const bool = (v: unknown) => (typeof v === 'boolean' ? v : undefined);
    const music = num(s.music);
    const sfx = num(s.sfx);
    if (music !== undefined) patch.music = music;
    if (sfx !== undefined) patch.sfx = sfx;
    const vib = bool(s.vibration);
    if (vib !== undefined) patch.vibration = vib;
    const flair = bool(s.flair);
    if (flair !== undefined) patch.flair = flair;
    const onboarded = bool(s.onboarded);
    if (onboarded !== undefined) patch.onboarded = onboarded;
    const motion = str(s.motion);
    if (motion === 'system' || motion === 'on' || motion === 'off') patch.motion = motion satisfies MotionPref;
    const th = str(s.theme);
    if (th === 'moonlit' || th === 'rose' || th === 'ocean' || th === 'midnight' || th === 'contrast') patch.theme = th satisfies ThemeId;
    const q = str(s.quality);
    if (q === 'high' || q === 'low') patch.quality = q satisfies Quality;
    const d = str(s.difficulty);
    if (d === 'easy' || d === 'medium' || d === 'hard') patch.difficulty = d;
    const cloak = str(s.cloak);
    if (cloak) patch.cloak = cloak;
    const lantern = str(s.lantern);
    if (lantern) patch.lantern = lantern;
    saveSettings(patch);
    this.lastTheme = settings.theme;
    audio.applyVolumes();
  }

  private queueSync(): void {
    if (!this.server?.loggedIn) return;
    if (this.syncTimer !== null) window.clearTimeout(this.syncTimer);
    this.syncTimer = window.setTimeout(() => {
      const out: PlayerSettings = {};
      for (const key of SYNCED) out[key] = settings[key];
      void api.settings(out);
    }, 800);
  }

  /** Scored only on tonight's post, logged in, first attempt of the day. */
  private canScore(night: number): boolean {
    const s = this.server;
    return !!s && s.loggedIn && night === s.today && night === s.postNight && !s.scored;
  }

  private titleStatus(): string {
    const s = this.server;
    if (!this.loaded) return '…';
    if (!s) return t('title.offline');
    if (s.postNight !== s.today) return t('title.archived');
    if (s.scored) return s.scored.rank ? t('title.done', { score: s.scored.score, rank: s.scored.rank }) : t('title.done.norank', { score: s.scored.score });
    return s.loggedIn ? t('title.scored') : t('title.practice');
  }

  private postNight(): number {
    return this.server?.postNight ?? currentNight();
  }

  private setScreen(el: HTMLElement | null): void {
    this.screen?.remove();
    this.screen = el;
    if (el) ui().append(el);
  }

  // ---------------------------------------------------------------- title

  private showTitle(): void {
    this.mode = 'title';
    this.clearRun();
    this.setScreen(
      titleScreen({
        night: this.postNight(),
        status: this.titleStatus(),
        streak: this.server?.streak.count ?? 0,
        nextDreamAt: Date.now() + (this.server?.nextDreamMs ?? msUntilNextDream()),
        onDive: () => this.dive(),
        onSettings: () => this.openSettings(),
        onArchive: () => this.openArchive(),
        onBoard: () => this.openBoard(),
      })
    );
    this.showPreview();
  }

  private dive(): void {
    audio.unlock();
    audio.playMusic(0); // music only starts after the player taps Dive
    this.showPick(this.postNight());
  }

  /** The title shows Night 1's first room floating below the logo. */
  private showPreview(): void {
    if (this.preview) return;
    const look = theme(settings.theme).layers[0];
    const room = new RoomView(buildDream({ night: this.postNight() }).layers[0]?.rows ?? [], 0, look);
    const diver = new Diver();
    room.root.add(diver.root);
    diver.root.position.copy(room.tile(room.board.start));
    this.world.scene.add(room.root);
    this.world.setLook(look, look, 1);
    const off = this.world.onFrame((dt, time) => {
      room.update(null, dt, time);
      diver.update(dt, time);
    });
    this.preview = { room, diver, off };
    this.framePreview();
  }

  private framePreview(): void {
    const hgt = window.innerHeight;
    this.world.setFrame({ top: hgt * 0.36, bottom: hgt * 0.3, side: 24 });
  }

  private hidePreview(): void {
    if (!this.preview) return;
    this.preview.off();
    this.preview.room.dispose();
    this.preview = null;
  }

  private showPick(night: number, voted: TwistId | null = null): void {
    this.mode = 'pick';
    this.closeOverlay();
    if (!this.preview) this.showPreview();
    const info = nightInfo(night);
    const scored = this.canScore(night);
    this.setScreen(
      pickScreen({
        favours: info.favours,
        hint: `${story(info.dreamer).name} · ${story(info.dreamer).role}`,
        badge: `${t('title.night', { night, dreamer: story(info.dreamer).role })} · ${scored ? t('pick.scored') : t('pick.practice')}`,
        onStart: (a, d) => this.startDream(night, voted ?? (night === this.server?.postNight ? this.server.voted : null), a, d, 0, scored),
        onBack: () => this.showTitle(),
      })
    );
  }

  // ---------------------------------------------------------------- dream

  private dreamFrame(): void {
    const narrow = window.innerWidth < 700;
    this.world.setFrame(touch || narrow ? { top: 74, bottom: 200, side: 8 } : { top: 72, bottom: 40, side: 24 });
  }

  private startDream(night: number, voted: TwistId | null, ability: AbilityId, difficulty: Difficulty, startLayer: number, scored: boolean): void {
    this.hidePreview();
    this.clearRun();
    audio.unlock();
    audio.playMusic(startLayer);
    this.mode = 'dream';
    const dream = buildDream({ night, ...(voted ? { voted } : {}) });
    this.playing = { night, dream, scored, difficulty };
    const hud = new Hud(ability, touch, {
      dir: (d) => this.dir(d),
      ability: () => this.run?.useAbility(),
      settings: () => this.openSettings(),
    });
    this.hud = hud;
    this.setScreen(hud.el);
    this.dreamFrame();
    this.run = new DreamRun(
      dream,
      ability,
      difficulty,
      this.world,
      hud,
      {
        onCard: (results, quote) => this.showCard(results, quote),
        onResults: (results, record) => void this.finish(results, record),
      },
      startLayer
    );
    if (!settings.onboarded && startLayer === 0) {
      this.run.paused = true;
      this.howto = howToScreen(() => {
        this.howto = null;
        saveSettings({ onboarded: true });
        if (this.run) this.run.paused = false;
      });
      ui().append(this.howto.el);
    }
    if (demo === 'vault') window.setTimeout(() => this.run?.demoVault(), 500);
  }

  private clearRun(): void {
    this.run?.dispose();
    this.run = null;
    this.hud = null;
  }

  private showCard(results: LayerResult[], quote: string): void {
    this.mode = 'card';
    const card = cardScreen({
      dreamer: this.playing?.dream.dreamer ?? 'ines',
      results,
      action: t('card.wake'),
      onAction: () => {
        card.remove();
        this.run?.wake();
      },
    });
    ui().append(card);
    this.hud?.el.classList.add('hidden');
    window.setTimeout(() => toast(quote, '5%', 3800), 800);
  }

  /** Send the run to the server (it replays it to score), then show the results. */
  private async finish(results: LayerResult[], record: RunRecord): Promise<void> {
    const p = this.playing;
    this.clearRun();
    const look = theme(settings.theme).layers[0];
    this.world.setLook(look, look, 1);
    let server: RunResponse | null = null;
    if (p && this.server && !demo) {
      server = await api.run({ night: p.night, difficulty: p.difficulty, record, scored: p.scored });
      if (server && this.server) {
        if (server.scored) {
          this.server.scored = { difficulty: p.difficulty, score: server.score, results: server.results, rank: server.rank, code: server.code ?? '' };
          this.server.streak = server.streak;
          saveSettings({ streak: server.streak.count });
        }
        const done = server.results.length === p.dream.layers.length && server.results.every((r) => r.cleared);
        if (done && !this.server.cards.includes(p.night)) this.server.cards.push(p.night);
      }
    }
    this.mode = 'results';
    const night = p?.night ?? this.postNight();
    const s = this.server;
    this.setScreen(
      resultsScreen({
        night,
        layers: p?.dream.layers.length ?? 3,
        results,
        server,
        practiceReason: !s ? t('results.offline') : null,
        canShare: !!s?.loggedIn && !!server && night === s.postNight,
        username: s?.username ?? null,
        vote: s?.loggedIn ? { options: s.vote.options, mine: s.vote.mine } : null,
        onShare: async () => {
          const r = await api.share();
          return r?.ok ? t('results.shared') : (r?.message ?? t('results.offline'));
        },
        onVote: async (opt) => {
          const r = await api.vote(opt);
          if (r?.ok && this.server) this.server.vote.mine = opt;
          return !!r?.ok;
        },
        onAgain: () => this.showPick(night),
        onBoard: () => this.openBoard(),
        onArchive: () => this.openArchive(),
      })
    );
  }

  // ---------------------------------------------------------------- overlays

  private closeOverlay(): void {
    this.overlay?.remove();
    this.overlay = null;
  }

  private openArchive(): void {
    this.closeOverlay();
    this.overlay = archiveScreen({
      cards: this.server?.cards ?? [],
      onPlay: (night) => void this.playArchive(night),
      onCard: (night) => {
        this.closeOverlay();
        const card = cardScreen({
          dreamer: nightInfo(night).dreamer,
          results: null,
          action: t('archive.close'),
          onAction: () => {
            card.remove();
            this.openArchive();
          },
        });
        this.overlay = card;
        ui().append(card);
      },
      onClose: () => this.closeOverlay(),
    });
    ui().append(this.overlay);
  }

  private async playArchive(night: number): Promise<void> {
    const spec = night === 1 ? null : await api.dream(night);
    this.showPick(night, spec?.voted ?? null);
  }

  private openBoard(): void {
    this.closeOverlay();
    const night = this.server?.today ?? currentNight();
    this.overlay = leaderboardScreen({ night, load: (b) => api.leaderboard(night, b), onClose: () => this.closeOverlay() });
    ui().append(this.overlay);
  }

  private openSettings(): void {
    if (this.overlay) return;
    const inGame = this.mode === 'dream';
    if (this.run) this.run.paused = true;
    this.overlay = settingsScreen({
      inGame,
      loggedIn: !!this.server?.loggedIn,
      onClose: () => this.closeSettings(),
      onQuit: () => {
        this.closeSettings();
        this.run?.quit();
      },
      onChange: () => {
        this.world.applyQuality();
        this.preview?.diver.applyCosmetics();
        this.run?.refreshCosmetics();
      },
    });
    ui().append(this.overlay);
  }

  private closeSettings(): void {
    this.closeOverlay();
    if (this.lastTheme !== settings.theme) {
      this.lastTheme = settings.theme;
      this.run?.refreshLook();
      if (this.preview) {
        this.hidePreview();
        this.showPreview();
      }
    }
    if (this.run) this.run.paused = !!this.howto;
  }

  // ---------------------------------------------------------------- input

  private dir(d: Dir): void {
    audio.unlock();
    if (this.howto) {
      this.howto.finish();
      return;
    }
    if (this.mode === 'dream' && !this.overlay) this.run?.input(d);
  }

  private bindInput(stage: HTMLElement): void {
    const keys: Record<string, Dir> = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right', KeyW: 'up', KeyS: 'down', KeyA: 'left', KeyD: 'right' };
    const abil: Record<string, AbilityId> = { Digit1: 'still', Digit2: 'blink', Digit3: 'lantern' };
    window.addEventListener('keydown', (e) => {
      audio.unlock();
      if (e.code === 'KeyM') {
        const on = settings.music > 0 || settings.sfx > 0;
        saveSettings({ music: on ? 0 : 0.7, sfx: on ? 0 : 0.8 });
        audio.applyVolumes();
        return;
      }
      if (e.code === 'Escape') {
        if (this.overlay) {
          if (this.mode === 'dream') this.closeSettings();
          else this.closeOverlay();
        }
        else if (this.mode === 'dream') this.openSettings();
        return;
      }
      if (this.mode === 'title' && !this.overlay && (e.code === 'Enter' || e.code === 'Space')) {
        this.dive();
        return;
      }
      if (this.mode !== 'dream' || this.overlay) return;
      const d = keys[e.code];
      if (d) {
        e.preventDefault();
        this.dir(d);
        return;
      }
      if (e.code === 'Space' || abil[e.code]) {
        e.preventDefault();
        if (this.howto) this.howto.finish();
        else this.run?.useAbility();
      }
    });
    // Swipes on the 3D stage (fullscreen only; the in-feed view is tap-only).
    stage.addEventListener('pointerdown', (e) => {
      audio.unlock();
      this.pointer = { x: e.clientX, y: e.clientY };
      if (this.howto) this.howto.finish();
    });
    stage.addEventListener('pointerup', (e) => {
      const p = this.pointer;
      this.pointer = null;
      if (!p) return;
      const dx = e.clientX - p.x;
      const dy = e.clientY - p.y;
      if (Math.hypot(dx, dy) < 24) return;
      this.dir(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    });
    window.addEventListener('resize', () => {
      if (this.mode === 'dream') this.dreamFrame();
      else if (this.preview) this.framePreview();
    });
  }

  private pollGamepad(): void {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = pads.find((p) => p);
    if (!pad) return;
    const map: Record<number, Dir> = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
    pad.buttons.forEach((b, i) => {
      if (b.pressed && !this.padHeld.has(i)) {
        this.padHeld.add(i);
        const d = map[i];
        if (d) this.dir(d);
        else if (i === 0) {
          if (this.mode === 'dream') this.run?.useAbility();
          else if (this.mode === 'title') this.dive();
        } else if (i === 9 && this.mode === 'dream') {
          if (this.overlay) this.closeSettings();
          else this.openSettings();
        }
      } else if (!b.pressed) this.padHeld.delete(i);
    });
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    const mag = Math.hypot(x, y);
    if (mag < 0.35) this.stickReady = true;
    else if (this.stickReady && mag > 0.6) {
      this.stickReady = false;
      this.dir(Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up');
    }
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new App();
});
