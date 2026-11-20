import * as Phaser from 'phaser';
import type { GameObjects } from 'phaser';
import { Scene } from 'phaser';
import { NIGHT_1 } from '../../shared/dreams/night1.ts';
import { mirrorRows } from '../../shared/logic/board.ts';
import {
  createLayer,
  echoPositions,
  move,
  pullFraction,
  stillActive,
  tick,
  timeLeftMs,
  useAbility,
  type LayerState,
  type MoveEvent,
} from '../../shared/logic/layer.ts';
import { moonsFor, playStyle, type LayerResult } from '../../shared/logic/score.ts';
import type { AbilityId, Dir, DreamDef, Vec } from '../../shared/logic/types.ts';
import { audio } from '../core/audio.ts';
import { Backdrop } from '../core/backdrop.ts';
import { LANTERN, PALETTES, SANS, TILE_D } from '../core/palette.ts';
import { buzz, settings } from '../core/settings.ts';
import { makeButton, makeMuteToggle, sans, serif, toast } from '../core/ui.ts';
import { hasKey, t } from '../i18n/index.ts';
import { RoomView, Z } from '../game/room.ts';

export type DreamData = { ability: AbilityId; startLayer?: number; demo?: string };
export type WakeData = { results: LayerResult[]; dream: DreamDef; shot: string | null; woke: boolean };

const STEP_MS = 120;

export class Dream extends Scene {
  private dream: DreamDef = NIGHT_1;
  private ability: AbilityId = 'lantern';
  private layerIndex = 0;
  private state!: LayerState;
  private room!: RoomView;
  private backdrop!: Backdrop;
  private diver!: GameObjects.Container;
  private diverSprite!: GameObjects.Image;
  private lanternGlow!: GameObjects.Image;
  private echoes: GameObjects.Image[] = [];
  private results: LayerResult[] = [];
  private busy = false;
  private paused = false;
  private moving = false;
  private queued: Dir | null = null;
  private lastBeat = 0;
  private demo = '';

  // HUD
  private ring!: GameObjects.Graphics;
  private ringText!: GameObjects.Text;
  private layerText!: GameObjects.Text;
  private movesText!: GameObjects.Text;
  private abilityBtn!: GameObjects.Container;
  private abilityPip!: GameObjects.Arc;
  private vignette!: GameObjects.Image;
  private pad: GameObjects.Container | null = null;
  private keyIcon!: GameObjects.Image;
  private pointerStart: Vec | null = null;
  private stickReady = true;

  constructor() {
    super('Dream');
  }

  init(data: DreamData): void {
    this.ability = data.ability;
    this.layerIndex = data.startLayer ?? 0;
    this.demo = data.demo ?? '';
    this.results = [];
    this.echoes = [];
    this.busy = false;
    this.paused = false;
    this.moving = false;
    this.queued = null;
    this.pad = null;
  }

  create(): void {
    this.backdrop = new Backdrop(this, this.layerIndex);
    this.buildHud();
    this.bindInput();
    this.startLayer(this.layerIndex, false);
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));

    if (!settings.onboarded && this.layerIndex === 0 && this.demo !== 'vault') this.showHowTo();
    if (this.demo === 'vault') this.time.delayedCall(400, () => this.runDemoVault());
  }

  // ---------------------------------------------------------------- layers

  private layerDef(i: number) {
    const def = this.dream.layers[i];
    if (!def) throw new Error(`Layer ${i} missing`);
    return def;
  }

  private startLayer(i: number, animated: boolean): void {
    this.layerIndex = i;
    const def = this.layerDef(i);
    this.state = createLayer(def, this.ability);
    // The mirror layer starts as the un-mirrored page, then turns.
    const firstRows = def.twist === 'mirror' ? mirrorRows(def.rows) : def.rows;
    const old = this.room;
    this.room = new RoomView(this, firstRows, i);
    this.room.root.setDepth(10);
    this.buildActors();
    this.layout();
    this.backdrop.setLayer(i, animated ? 900 : 0);
    audio.pad(i);
    this.layerText.setText(t(this.layerKey(i)));
    this.updateAbilityPip();
    this.keyIcon.setVisible(false);
    old?.destroy();

    const announce = () => {
      const twistKey = `twist.${def.twist}`;
      if (hasKey(twistKey)) toast(this, t(twistKey), 96, 2600);
    };

    if (animated && !settings.reducedMotion) {
      this.busy = true;
      this.unfoldIn(() => {
        if (def.twist === 'mirror') this.pageTurn(() => this.afterEnter(announce));
        else this.afterEnter(announce);
      });
    } else if (def.twist === 'mirror') {
      this.busy = true;
      this.pageTurn(() => this.afterEnter(announce));
    } else {
      this.afterEnter(announce);
    }
  }

  private afterEnter(announce: () => void): void {
    this.busy = false;
    announce();
  }

  private layerKey(i: number) {
    return i === 0 ? 'layer.name.1' : i === 1 ? 'layer.name.2' : 'layer.name.3';
  }

  private buildActors(): void {
    const s = this.state;
    const c = this.room.tileCenter(s.pos);
    const shadow = this.add.image(0, 2, 'shadow').setScale(0.75);
    this.diverSprite = this.add.image(0, 0, 'diver').setOrigin(0.5, 0.94).setScale(0.82);
    this.lanternGlow = this.add.image(14, -18, 'glow').setTint(LANTERN).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.55).setScale(1.3);
    this.diver = this.add.container(c.x, c.y + TILE_D * 0.18, [shadow, this.lanternGlow, this.diverSprite]);
    this.room.addActor(this.diver, s.pos.y);
    if (!settings.reducedMotion) {
      this.tweens.add({ targets: this.lanternGlow, alpha: 0.38, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
    this.echoes = (s.def.echoDelaysMs ?? []).map(() => {
      const e = this.add.image(0, 0, 'diver').setOrigin(0.5, 0.94).setScale(0.82).setTint(PALETTES[this.layerIndex]?.glowHex ?? 0xffffff);
      e.setBlendMode(Phaser.BlendModes.ADD).setAlpha(0).setVisible(false);
      this.room.addActor(e, 0, Z.actor - 1);
      return e;
    });
  }

  // ---------------------------------------------------------------- HUD

  private buildHud(): void {
    this.vignette = this.add.image(0, 0, 'vignette').setOrigin(0).setDepth(900).setAlpha(0);
    this.ring = this.add.graphics().setDepth(1000);
    this.ringText = this.add.text(0, 0, '', sans(15, '#fff3dc', true)).setOrigin(0.5).setDepth(1001);
    this.layerText = this.add.text(0, 0, '', serif(16, '#f4ecff', true)).setOrigin(0, 0.5).setDepth(1001);
    this.movesText = this.add.text(0, 0, '', sans(13, 'rgba(244,236,255,0.8)')).setOrigin(1, 0.5).setDepth(1001);
    this.keyIcon = this.add.image(0, 0, 'orb').setDepth(1001).setScale(0.8).setVisible(false);

    const icon = this.add.image(0, 0, `icon-${this.ability}`).setScale(0.62);
    const disc = this.add.circle(0, 0, 32, 0xffffff, 0.08).setStrokeStyle(1.5, 0xffe2a6, 0.8);
    this.abilityPip = this.add.circle(22, -22, 6, 0xffd27a, 1).setStrokeStyle(1, 0x2a1406);
    const label = this.add.text(0, 44, t(`ability.${this.ability}`), sans(12, '#ffe9c4')).setOrigin(0.5);
    this.abilityBtn = this.add.container(0, 0, [disc, icon, this.abilityPip, label]).setDepth(1001).setSize(72, 72);
    this.abilityBtn.setInteractive({ useHandCursor: true });
    this.abilityBtn.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
      ev.stopPropagation();
      this.pointerStart = null;
      this.tryAbility();
    });

    makeMuteToggle(this, 0, 0).setDepth(1001).setName('mute');

    const touch = this.sys.game.device.input.touch;
    if (touch) this.buildPad();
    else {
      this.add
        .text(0, 0, t('hud.hint'), sans(12, 'rgba(244,236,255,0.55)'))
        .setOrigin(0.5, 1)
        .setDepth(1001)
        .setName('hint');
    }
  }

  private buildPad(): void {
    const dirs: [Dir, number, number, number][] = [
      ['up', 0, -54, 0],
      ['down', 0, 54, 180],
      ['left', -54, 0, -90],
      ['right', 54, 0, 90],
    ];
    const parts = dirs.map(([dir, x, y, angle]) => {
      const a = this.add.image(x, y, 'arrow').setAngle(angle).setScale(0.78).setInteractive({ useHandCursor: true });
      a.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
        ev.stopPropagation();
        this.pointerStart = null;
        a.setScale(0.7);
        this.time.delayedCall(90, () => a.setScale(0.78));
        this.input_(dir);
      });
      return a;
    });
    this.pad = this.add.container(0, 0, parts).setDepth(1001);
  }

  private layout(): void {
    const { width, height } = this.scale;
    const top = 64;
    const bottom = this.pad ? 190 : 70;
    const availW = width - 24;
    const availH = height - top - bottom;
    const scale = Math.min(availW / this.room.pixelW, availH / this.room.outerH, 1.5);
    this.room.root.setScale(scale);
    this.room.root.setPosition(width / 2, top + availH / 2 + 8);

    this.vignette.setDisplaySize(width, height);
    const rx = width / 2;
    this.ringText.setPosition(rx, 34);
    this.layerText.setPosition(16, 34);
    this.movesText.setPosition(width - 16, 64);
    this.keyIcon.setPosition(rx + 52, 34);
    const mute = this.children.getByName('mute');
    if (mute instanceof Phaser.GameObjects.Text) mute.setPosition(width - 6, 14);
    const hint = this.children.getByName('hint');
    if (hint instanceof Phaser.GameObjects.Text) hint.setPosition(width / 2, height - 12);
    if (this.pad) {
      this.pad.setPosition(Math.min(width * 0.3, 120), height - 100);
      this.abilityBtn.setPosition(width - 64, height - 110);
    } else {
      this.abilityBtn.setPosition(width - 64, height - 96);
    }
  }

  private drawRing(time: number): void {
    const frac = pullFraction(this.state);
    const g = this.ring;
    const x = this.scale.width / 2;
    const y = 34;
    let r = 24;
    const low = frac < 0.3;
    if (low && !settings.reducedMotion) {
      const rate = 1.2 + (1 - frac / 0.3) * 1.8; // beats per second
      const phase = (time / 1000) * rate;
      r += Math.pow(Math.max(0, Math.sin(phase * Math.PI * 2)), 6) * 3;
    }
    g.clear();
    g.lineStyle(5, 0xffffff, 0.12);
    g.strokeCircle(x, y, r);
    const color = frac > 0.5 ? 0xffe2a6 : frac > 0.25 ? 0xffb36b : 0xff7a6b;
    g.lineStyle(5, color, 0.95);
    g.beginPath();
    g.arc(x, y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac, false);
    g.strokePath();
    this.ringText.setText(String(Math.ceil(timeLeftMs(this.state) / 1000)));
    this.movesText.setText(t('hud.moves', { moves: this.state.moves }));

    const edge = frac < 0.25 ? (0.25 - frac) / 0.25 : 0;
    const pulse = settings.reducedMotion ? 1 : 0.8 + 0.2 * Math.sin(time * 0.012);
    this.vignette.setAlpha(Math.min(1, edge * 1.4) * pulse);
    this.vignette.setTint(frac < 0.25 ? 0x3a0a10 : 0x000000);

    if (low && this.state.status === 'playing' && !this.paused) {
      const period = 380 + 900 * (frac / 0.3);
      if (time - this.lastBeat > period) {
        this.lastBeat = time;
        audio.heartbeat();
      }
    }
  }

  private updateAbilityPip(): void {
    this.abilityPip?.setFillStyle(this.state?.charges > 0 ? 0xffd27a : 0x555066, 1);
  }

  // ---------------------------------------------------------------- input

  private bindInput(): void {
    const kb = this.input.keyboard;
    const map: Record<string, Dir> = {
      ArrowUp: 'up',
      ArrowDown: 'down',
      ArrowLeft: 'left',
      ArrowRight: 'right',
      KeyW: 'up',
      KeyS: 'down',
      KeyA: 'left',
      KeyD: 'right',
    };
    kb?.on('keydown', (ev: KeyboardEvent) => {
      audio.unlock();
      const dir = map[ev.code];
      if (dir) {
        ev.preventDefault();
        this.input_(dir);
        return;
      }
      const abilityKey: Record<string, AbilityId> = { Digit1: 'still', Digit2: 'blink', Digit3: 'lantern' };
      if (ev.code === 'Space' || abilityKey[ev.code] === this.ability) {
        ev.preventDefault();
        this.tryAbility();
      }
    });

    this.input.on('pointerdown', (p: Phaser.Input.Pointer) => {
      audio.unlock();
      this.pointerStart = { x: p.x, y: p.y };
    });
    this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
      const start = this.pointerStart;
      this.pointerStart = null;
      if (!start) return;
      const dx = p.x - start.x;
      const dy = p.y - start.y;
      if (Math.hypot(dx, dy) < 24) return;
      this.input_(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    });

    this.input.gamepad?.on('down', (_pad: Phaser.Input.Gamepad.Gamepad, button: Phaser.Input.Gamepad.Button) => {
      audio.unlock();
      const dpad: Record<number, Dir> = { 12: 'up', 13: 'down', 14: 'left', 15: 'right' };
      const dir = dpad[button.index];
      if (dir) this.input_(dir);
      else if (button.index === 0) this.tryAbility();
    });
  }

  private pollStick(): void {
    const pad = this.input.gamepad?.getPad(0);
    if (!pad) return;
    const x = pad.leftStick.x;
    const y = pad.leftStick.y;
    const mag = Math.hypot(x, y);
    if (mag < 0.35) {
      this.stickReady = true;
      return;
    }
    if (!this.stickReady || mag < 0.6) return;
    this.stickReady = false;
    this.input_(Math.abs(x) > Math.abs(y) ? (x > 0 ? 'right' : 'left') : y > 0 ? 'down' : 'up');
  }

  /** All movement input lands here (keys, swipes, pad, gamepad). */
  private input_(dir: Dir): void {
    if (this.paused) {
      this.dismissHowTo();
      return;
    }
    if (this.busy || this.state.status !== 'playing') return;
    if (this.moving) {
      this.queued = dir;
      return;
    }
    const from = { ...this.state.pos };
    const ev = move(this.state, dir);
    this.react(ev, from);
  }

  private tryAbility(): void {
    if (this.paused) {
      this.dismissHowTo();
      return;
    }
    if (this.busy || this.state.status !== 'playing') return;
    const res = useAbility(this.state);
    if (res === 'no-charge') {
      toast(this, t('ability.empty'), this.scale.height * 0.82, 1200);
      audio.bump();
      return;
    }
    if (res !== 'used') return;
    audio.ability();
    buzz(15);
    this.updateAbilityPip();
    this.room.flash(this.state.pos);
    toast(this, t('ability.used', { ability: t(`ability.${this.ability}`) }), this.scale.height * 0.82, 900);
    if (this.ability === 'lantern') {
      this.tweens.add({ targets: this.lanternGlow, scale: 3.4, duration: 260, yoyo: true, hold: 2500 });
    }
  }

  // ---------------------------------------------------------------- reactions

  private react(ev: MoveEvent, from: Vec): void {
    const s = this.state;
    if (ev === 'blocked' || ev === 'vault-locked') {
      audio.bump();
      buzz(18);
      if (!settings.reducedMotion) {
        const d = { x: s.pos.x - from.x, y: s.pos.y - from.y };
        this.tweens.add({ targets: this.diverSprite, x: 3 * Math.sign(d.x), duration: 60, yoyo: true });
      }
      if (ev === 'vault-locked') toast(this, t('event.blocked.vault'));
      return;
    }
    if (ev === 'ignored') return;

    this.walkTo(s.pos, ev === 'blink');
    audio.step();

    if (ev === 'key') {
      audio.key();
      buzz(20);
      toast(this, t('event.key'));
      const orb = this.room.keyOrb;
      if (orb) this.tweens.add({ targets: orb, alpha: 0, scale: 2, duration: 400, onComplete: () => orb.setVisible(false) });
      this.keyIcon.setVisible(true).setScale(0);
      this.tweens.add({ targets: this.keyIcon, scale: 0.8, duration: 300, ease: 'Back.easeOut' });
    }
    if (ev === 'note') {
      audio.click();
      toast(this, t(hasKeyOr(`dreamer.${this.dream.dreamer}.note`)), this.scale.height * 0.24, 4200);
      const n = this.room.noteImg;
      if (n) this.tweens.add({ targets: n, alpha: 0.35, duration: 400 });
    }
    if (ev === 'caught') this.onCaught();
    if (ev === 'drop') this.time.delayedCall(STEP_MS, () => this.fallToNext());
    if (ev === 'vault') this.time.delayedCall(STEP_MS, () => this.openVault());
  }

  private walkTo(p: Vec, blink: boolean): void {
    const c = this.room.tileCenter(p);
    const ty = c.y + TILE_D * 0.18;
    this.moving = true;
    this.room.setActorRow(this.diver, p.y);
    const done = () => {
      this.moving = false;
      this.room.ripple(p);
      const q = this.queued;
      this.queued = null;
      if (q) this.input_(q);
    };
    if (blink) {
      this.tweens.add({
        targets: this.diver,
        alpha: 0,
        duration: 90,
        onComplete: () => {
          this.diver.setPosition(c.x, ty);
          this.tweens.add({ targets: this.diver, alpha: 1, duration: 120, onComplete: done });
        },
      });
      return;
    }
    if (settings.reducedMotion) {
      this.diver.setPosition(c.x, ty);
      done();
      return;
    }
    this.tweens.add({ targets: this.diver, x: c.x, y: ty, duration: STEP_MS, ease: 'Quad.easeOut', onComplete: done });
    this.tweens.add({ targets: this.diverSprite, y: -5, duration: STEP_MS / 2, yoyo: true, ease: 'Sine.easeOut' });
  }

  private onCaught(): void {
    audio.caught();
    buzz(40);
    toast(this, t('event.caught'), this.scale.height * 0.3);
    if (!settings.reducedMotion) this.cameras.main.shake(220, 0.006);
    this.cameras.main.flash(260, 120, 30, 60);
  }

  // ---------------------------------------------------------------- update

  override update(time: number, delta: number): void {
    this.backdrop.update(time);
    this.pollStick();
    if (!this.state) return;
    if (!this.paused && !this.busy && this.state.status === 'playing') {
      const ev = tick(this.state, Math.min(delta, 100));
      if (ev === 'caught') this.onCaught();
      if (ev === 'woke') this.wakeUp(true);
    }
    this.room.sync(this.state, time);
    this.room.setXray([this.state.pos]);
    this.drawRing(time);
    this.drawEchoes();
  }

  private drawEchoes(): void {
    const pos = echoPositions(this.state);
    const frozen = stillActive(this.state);
    pos.forEach((p, i) => {
      const e = this.echoes[i];
      if (!e) return;
      if (!p) {
        e.setVisible(false);
        return;
      }
      const c = this.room.tileCenter(p);
      const ty = c.y + TILE_D * 0.18;
      if (!e.visible) {
        e.setVisible(true).setPosition(c.x, ty).setAlpha(0);
        this.tweens.add({ targets: e, alpha: 0.6, duration: 500 });
      }
      if (e.getData('tx') !== c.x || e.getData('ty') !== ty) {
        // Leave a fading light trail at the old spot.
        if (settings.quality === 'high' && !settings.reducedMotion && e.alpha > 0.3) {
          const ghost = this.add.image(e.x, e.y, 'diver').setOrigin(0.5, 0.94).setScale(0.82).setTint(e.tintTopLeft).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.25);
          this.room.addActor(ghost, Number(e.getData('row') ?? 0), Z.actor - 2);
          this.tweens.add({ targets: ghost, alpha: 0, scaleY: 0.7, duration: 700, onComplete: () => ghost.destroy() });
        }
        e.setData('tx', c.x).setData('ty', ty);
        this.room.setActorRow(e, p.y, Z.actor - 1);
        if (settings.reducedMotion) e.setPosition(c.x, ty);
        else this.tweens.add({ targets: e, x: c.x, y: ty, duration: 110 });
      }
      e.setTint(frozen ? 0x9fd8ff : (PALETTES[this.layerIndex]?.glowHex ?? 0xffffff));
      if (e.alpha > 0.1) e.setAlpha(frozen ? 0.3 : 0.6);
    });
  }

  // ---------------------------------------------------------------- transitions

  private recordResult(cleared: boolean): void {
    const s = this.state;
    this.results.push({
      cleared,
      timeLeftMs: timeLeftMs(s),
      pullMs: s.def.pullMs,
      moves: s.moves,
      par: s.def.par,
      caught: s.caught,
    });
  }

  private fallToNext(): void {
    this.busy = true;
    this.recordResult(true);
    audio.drop();
    buzz(25);
    const next = this.layerIndex + 1;
    toast(this, t('event.falling'), this.scale.height * 0.5, 600);
    const room = this.room;

    if (settings.reducedMotion) {
      this.cameras.main.fadeOut(300, 0, 0, 0);
      this.time.delayedCall(320, () => {
        this.startLayer(next, false);
        this.cameras.main.fadeIn(300, 0, 0, 0);
      });
      return;
    }

    // The Diver sinks into the well, then the paper folds and falls away.
    this.tweens.add({ targets: this.diver, scale: 0.2, alpha: 0, angle: 200, duration: 380, ease: 'Quad.easeIn' });
    this.time.delayedCall(360, () => {
      const fold = room.makeFold();
      this.tweens.add({
        targets: fold.top,
        scaleY: -1,
        duration: 520,
        ease: 'Sine.easeInOut',
        onUpdate: () => fold.back.setAlpha(fold.top.scaleY < 0 ? 1 : 0),
      });
      this.time.delayedCall(480, () => {
        this.backdrop.rush();
        this.tweens.add({
          targets: room.root,
          y: room.root.y + this.scale.height * 0.8,
          angle: 8,
          scale: room.root.scale * 0.6,
          alpha: 0,
          duration: 650,
          ease: 'Quad.easeIn',
          onComplete: () => this.startLayer(next, true),
        });
      });
    });
  }

  /** The next room drops in from above, still folded, and opens flat. */
  private unfoldIn(done: () => void): void {
    const root = this.room.root;
    const targetY = root.y;
    const targetScale = root.scale;
    const fold = this.room.makeFold();
    fold.top.scaleY = -1;
    fold.back.setAlpha(1);
    root.setY(targetY - this.scale.height * 0.7).setScale(targetScale * 0.7).setAlpha(0);
    this.diver.setAlpha(0);
    this.tweens.add({
      targets: root,
      y: targetY,
      scale: targetScale,
      alpha: 1,
      duration: 600,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.tweens.add({
          targets: fold.top,
          scaleY: 1,
          duration: 560,
          ease: 'Back.easeOut',
          onUpdate: () => fold.back.setAlpha(fold.top.scaleY < 0 ? 1 : 0),
          onComplete: () => {
            fold.restore();
            this.diver.setScale(0.4);
            this.tweens.add({ targets: this.diver, alpha: 1, scale: 1, duration: 260, ease: 'Back.easeOut', onComplete: done });
          },
        });
      },
    });
  }

  /** Mirror twist: the room turns like a book page and comes back mirrored. */
  private pageTurn(done: () => void): void {
    const root = this.room.root;
    const sx = root.scaleX;
    const rebuild = () => {
      const y = root.y;
      const x = root.x;
      const sc = root.scaleY;
      this.room.destroy();
      this.room = new RoomView(this, this.state.def.rows, this.layerIndex);
      this.room.root.setDepth(10).setPosition(x, y).setScale(sc);
      this.buildActors();
      return this.room.root;
    };
    if (settings.reducedMotion) {
      this.cameras.main.fadeOut(200);
      this.time.delayedCall(210, () => {
        rebuild();
        this.cameras.main.fadeIn(200);
        done();
      });
      return;
    }
    audio.tide();
    this.time.delayedCall(450, () => {
      this.tweens.add({
        targets: root,
        scaleX: 0,
        duration: 320,
        ease: 'Sine.easeIn',
        onComplete: () => {
          const r = rebuild();
          const sc = r.scaleY;
          r.scaleX = 0;
          this.tweens.add({ targets: r, scaleX: sc || sx, duration: 380, ease: 'Back.easeOut', onComplete: done });
        },
      });
    });
  }

  private openVault(): void {
    this.busy = true;
    this.recordResult(true);
    audio.bloom();
    buzz(30);
    const petals = this.room.vaultPetals;
    const core = this.room.vaultCore;
    const reduced = settings.reducedMotion;
    petals.forEach((p, i) => {
      const angle = (i - 2.5) * 34;
      this.tweens.add({ targets: p, angle, scale: 0.9, duration: reduced ? 1 : 900, delay: reduced ? 0 : i * 60, ease: 'Back.easeOut' });
    });
    this.diver.setAlpha(0.4);
    if (!core) {
      this.showCard();
      return;
    }
    // The memory rises out of the flower and blooms into the story card.
    const world = core.getWorldTransformMatrix();
    const orb = this.add.image(world.tx, world.ty, 'orb').setDepth(2000).setScale(0.6);
    const glow = this.add.image(world.tx, world.ty, 'glow').setDepth(1999).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setScale(0.6);
    core.setVisible(false);
    this.tweens.add({
      targets: [orb, glow],
      x: this.scale.width / 2,
      y: this.scale.height * 0.42,
      duration: reduced ? 1 : 1100,
      delay: reduced ? 0 : 500,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: glow,
      scale: 9,
      alpha: 0,
      duration: reduced ? 200 : 700,
      delay: reduced ? 0 : 1500,
      onStart: () => this.tweens.add({ targets: orb, scale: 3, alpha: 0, duration: 500 }),
      onComplete: () => {
        orb.destroy();
        glow.destroy();
        this.showCard();
      },
    });
  }

  private hideHud(): void {
    const hud = [this.ring, this.ringText, this.layerText, this.movesText, this.abilityBtn, this.keyIcon, this.pad, this.children.getByName('hint')];
    this.tweens.add({ targets: hud.filter((o) => o !== null), alpha: 0, duration: 300 });
  }

  private showCard(): void {
    this.hideHud();
    const { width, height } = this.scale;
    const d = this.dream.dreamer;
    const style = playStyle(this.results, this.dream.layers.length);
    const scale = Math.min(1, (height - 40) / 470, (width - 24) / 310);

    const shade = this.add.rectangle(0, 0, width, height, 0x05030c, 0.6).setOrigin(0).setDepth(2500).setAlpha(0);
    this.tweens.add({ targets: shade, alpha: 1, duration: 400 });

    const card = this.add.container(width / 2, height / 2).setDepth(2600);
    const paper = this.add.image(0, 0, 'paper-card');
    const art = this.add.image(0, -120, 'card-art');
    const ink = '#2b2133';
    const heading = this.add.text(0, -14, t('card.memory').toUpperCase(), { ...sans(11, '#8a6f52', true), letterSpacing: 2 }).setOrigin(0.5);
    const name = this.add.text(0, 6, t(hasKeyOr(`dreamer.${d}.name`)), serif(20, ink)).setOrigin(0.5);
    const body = this.add
      .text(0, 30, t(hasKeyOr(`dreamer.${d}.card`)), { ...serif(14, ink), align: 'center', wordWrap: { width: 250 }, lineSpacing: 3 })
      .setOrigin(0.5, 0);
    const clueLabel = this.add.text(-125, 112, t('card.clue').toUpperCase(), { ...sans(10, '#8a6f52', true), letterSpacing: 2 });
    const clue = this.add
      .text(-125, 126, t(hasKeyOr(`dreamer.${d}.clue`)), { ...serif(13, '#4a3a52', true), wordWrap: { width: 250 }, lineSpacing: 2 })
      .setOrigin(0, 0);
    const moonsLine = this.results.map((r) => '●'.repeat(moonsFor(r)).padEnd(3, '○')).join('   ');
    const moons = this.add.text(0, 186, moonsLine, { fontFamily: SANS, fontSize: '14px', color: '#b07a2a' }).setOrigin(0.5);
    card.add([paper, art, heading, name, body, clueLabel, clue, moons]);
    const quote = t(hasKeyOr(`dreamer.${d}.${style}`));

    if (settings.reducedMotion) card.setScale(scale);
    else {
      card.setScale(scale, 0).setAngle(-3);
      this.tweens.add({ targets: card, scaleY: scale, angle: 0, duration: 650, ease: 'Back.easeOut' });
    }

    const btn = makeButton(this, width / 2, Math.min(height - 36, height / 2 + 232 * scale + 34), t('card.wake'), () => this.wakeUp(false), 200);
    btn.setDepth(2700).setAlpha(0);
    this.tweens.add({ targets: btn, alpha: 1, delay: 700, duration: 400 });
    this.time.delayedCall(900, () => toast(this, quote, height * 0.08, 3800));
  }

  /** Take a snapshot of the frame, then hand over to the Wake scene, which shatters it. */
  private wakeUp(byPull: boolean): void {
    if (byPull) {
      this.busy = true;
      this.recordResult(false);
    }
    this.busy = true;
    const go = (shot: string | null) => {
      const data: WakeData = { results: this.results, dream: this.dream, shot, woke: byPull };
      this.scene.start('Wake', data);
    };
    try {
      this.game.renderer.snapshot((img) => {
        if (!(img instanceof HTMLImageElement)) return go(null);
        const key = `shot-${Date.now()}`;
        const add = () => {
          this.textures.addImage(key, img);
          go(key);
        };
        if (img.complete) add();
        else img.onload = add;
      });
    } catch {
      go(null);
    }
  }

  // ---------------------------------------------------------------- onboarding

  private howTo: GameObjects.Container | null = null;

  private showHowTo(): void {
    this.paused = true;
    const { width, height } = this.scale;
    const panel = this.add.rectangle(0, 8, Math.min(420, width - 32), 150, 0x0b0716, 0.86).setStrokeStyle(1, 0xffe2a6, 0.6);
    const text = this.add.text(0, -10, t('how.1'), { ...serif(18, '#fff3dc'), align: 'center', wordWrap: { width: Math.min(380, width - 60) } }).setOrigin(0.5);
    const dots = this.add.text(0, 40, '● ○ ○', sans(12, '#ffe2a6')).setOrigin(0.5);
    const skip = this.add.text(0, 64, t('how.skip'), sans(11, 'rgba(244,236,255,0.6)')).setOrigin(0.5);
    this.howTo = this.add.container(width / 2, height * 0.5, [panel, text, dots, skip]).setDepth(3000);
    const steps = ['how.1', 'how.2', 'how.3'] as const;
    steps.forEach((key, i) => {
      if (i === 0) return;
      this.time.delayedCall(3300 * i, () => {
        if (!this.howTo) return;
        text.setText(t(key));
        dots.setText(steps.map((_, j) => (j === i ? '●' : '○')).join(' '));
      });
    });
    this.time.delayedCall(3300 * steps.length, () => this.dismissHowTo());
    this.input.once('pointerdown', () => this.dismissHowTo());
  }

  private dismissHowTo(): void {
    if (!this.howTo) return;
    const h = this.howTo;
    this.howTo = null;
    settings.setOnboarded();
    this.tweens.add({ targets: h, alpha: 0, duration: 250, onComplete: () => h.destroy() });
    this.paused = false;
  }

  // ---------------------------------------------------------------- demo helpers (for screenshots)

  private runDemoVault(): void {
    if (this.layerIndex !== 2) return;
    this.results = [
      { cleared: true, timeLeftMs: 49_000, pullMs: 80_000, moves: 8, par: 8, caught: 0 },
      { cleared: true, timeLeftMs: 38_000, pullMs: 70_000, moves: 9, par: 8, caught: 0 },
    ];
    this.state.hasKey = true;
    this.state.moves = 19;
    this.state.elapsedMs = 31_000;
    this.state.pos = { x: 6, y: 1 };
    this.diver.setPosition(this.room.tileCenter({ x: 6, y: 1 }).x, this.room.tileCenter({ x: 6, y: 1 }).y + TILE_D * 0.18);
    this.room.setActorRow(this.diver, 1);
    this.input_('up');
  }
}

/** Dreamer strings are looked up by id; fall back to the app name if one is missing. */
function hasKeyOr(key: string) {
  return hasKey(key) ? key : 'app.name';
}
