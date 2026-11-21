import { NIGHT_1 } from '../shared/dreams/night1.ts';
import type { Difficulty } from '../shared/logic/difficulty.ts';
import type { LayerResult } from '../shared/logic/score.ts';
import { currentNight } from '../shared/logic/season.ts';
import type { AbilityId, Dir } from '../shared/logic/types.ts';
import { audio } from './core/audio.ts';
import { theme } from './core/palette.ts';
import { onSettingsChange, saveSettings, settings } from './core/settings.ts';
import { DreamRun } from './game/dream.ts';
import { t, type StringKey } from './i18n/index.ts';
import { Diver } from './three/diver.ts';
import { RoomView } from './three/room3d.ts';
import { World } from './three/world.ts';
import { h, toast, ui } from './ui/dom.ts';
import { Hud } from './ui/hud.ts';
import { applyThemeCss, cardScreen, howToScreen, pickScreen, resultsScreen, settingsScreen, titleScreen } from './ui/screens.ts';

type Mode = 'title' | 'pick' | 'dream' | 'card' | 'results';

const params = new URLSearchParams(window.location.search);
const demo = params.get('demo') ?? '';
const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;

function abilityParam(v: string | null): AbilityId {
  return v === 'still' || v === 'blink' ? v : 'lantern';
}

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

  constructor() {
    const stage = document.getElementById('stage');
    if (!stage) throw new Error('#stage missing');
    this.world = new World(stage);
    ui().append(h('div', 'fade'));
    applyThemeCss(settings.theme);
    this.bindInput(stage);
    this.world.onFrame(() => this.pollGamepad());
    onSettingsChange(() => applyThemeCss(settings.theme));
    Object.assign(window, { __maist: { app: this, run: () => this.run, world: this.world } });

    if (demo === 'pick') this.showPick();
    else if (demo === 'dream' || demo === 'vault') {
      const layer = Math.max(0, Math.min(2, Number(params.get('layer') ?? '1') - 1));
      this.startDream(abilityParam(params.get('ability')), settings.difficulty, demo === 'vault' ? 2 : layer);
    } else if (demo === 'settings') {
      this.showTitle();
      this.openSettings();
    } else this.showTitle();
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
        night: currentNight(),
        dreamer: t('dreamer.ines'),
        onDive: () => this.dive(),
        onSettings: () => this.openSettings(),
      })
    );
    this.showPreview();
  }

  private dive(): void {
    audio.unlock();
    audio.playMusic(0); // music only starts after the player taps Dive
    this.showPick();
  }

  /** The title shows Night 1's first room floating below the logo. */
  private showPreview(): void {
    if (this.preview) return;
    const look = theme(settings.theme).layers[0];
    const room = new RoomView(NIGHT_1.layers[0]?.rows ?? [], 0, look);
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
    this.world.setFrame({ top: hgt * 0.36, bottom: hgt * 0.22, side: 24 });
  }

  private hidePreview(): void {
    if (!this.preview) return;
    this.preview.off();
    this.preview.room.dispose();
    this.preview = null;
  }

  private showPick(): void {
    this.mode = 'pick';
    if (!this.preview) this.showPreview();
    this.setScreen(
      pickScreen({
        favours: NIGHT_1.favours,
        hintKey: 'dreamer.ines.hint',
        onStart: (a, d) => this.startDream(a, d, 0),
      })
    );
  }

  // ---------------------------------------------------------------- dream

  private dreamFrame(): void {
    const narrow = window.innerWidth < 700;
    this.world.setFrame(touch || narrow ? { top: 74, bottom: 200, side: 8 } : { top: 72, bottom: 40, side: 24 });
  }

  private startDream(ability: AbilityId, difficulty: Difficulty, startLayer: number): void {
    this.hidePreview();
    this.clearRun();
    audio.unlock();
    audio.playMusic(startLayer);
    this.mode = 'dream';
    const hud = new Hud(ability, touch, {
      dir: (d) => this.dir(d),
      ability: () => this.run?.useAbility(),
      settings: () => this.openSettings(),
    });
    this.hud = hud;
    this.setScreen(hud.el);
    this.dreamFrame();
    this.run = new DreamRun(
      NIGHT_1,
      ability,
      difficulty,
      this.world,
      hud,
      {
        onCard: (results, quote) => this.showCard(results, quote),
        onResults: (results) => this.showResults(results),
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

  private showCard(results: LayerResult[], quote: StringKey): void {
    this.mode = 'card';
    const card = cardScreen({
      dreamer: NIGHT_1.dreamer,
      results,
      onWake: () => {
        card.remove();
        this.run?.wake();
      },
    });
    ui().append(card);
    this.hud?.el.classList.add('hidden');
    window.setTimeout(() => toast(t(quote), '5%', 3800), 800);
  }

  private showResults(results: LayerResult[]): void {
    this.mode = 'results';
    this.clearRun();
    const look = theme(settings.theme).layers[0];
    this.world.setLook(look, look, 1);
    this.setScreen(
      resultsScreen({
        night: NIGHT_1.night,
        layers: NIGHT_1.layers.length,
        results,
        onAgain: () => this.showPick(),
      })
    );
  }

  // ---------------------------------------------------------------- settings

  private openSettings(): void {
    if (this.overlay) return;
    const inGame = this.mode === 'dream';
    if (this.run) this.run.paused = true;
    this.overlay = settingsScreen({
      inGame,
      onClose: () => this.closeSettings(),
      onQuit: () => {
        this.closeSettings();
        this.run?.wake();
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
    this.overlay?.remove();
    this.overlay = null;
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
      if (e.code === 'Escape' && this.mode === 'dream') {
        if (this.overlay) this.closeSettings();
        else this.openSettings();
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
