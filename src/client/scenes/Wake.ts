import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { NIGHT_1 } from '../../shared/dreams/night1.ts';
import { isLucid, moonsFor, scoreRun, shareLine, type LayerResult } from '../../shared/logic/score.ts';
import { audio } from '../core/audio.ts';
import { Backdrop } from '../core/backdrop.ts';
import { settings } from '../core/settings.ts';
import { makeButton, makeMuteToggle, sans, serif } from '../core/ui.ts';
import { t } from '../i18n/index.ts';
import type { DreamData, WakeData } from './Dream.ts';

/** The dream shatters into paper pieces and you wake: results, near-miss and the share line preview. */
export class Wake extends Scene {
  private backdrop!: Backdrop;
  private info: WakeData = { results: [], dream: NIGHT_1, shot: null, woke: false };

  constructor() {
    super('Wake');
  }

  init(data: Partial<WakeData>): void {
    this.info = {
      results: data.results ?? demoResults(),
      dream: data.dream ?? NIGHT_1,
      shot: data.shot ?? null,
      woke: data.woke ?? false,
    };
  }

  create(): void {
    this.backdrop = new Backdrop(this, 0, false);
    const { width, height } = this.scale;
    const cx = width / 2;
    const { results, dream } = this.info;
    const layers = dream.layers.length;
    const allCleared = results.length === layers && results.every((r) => r.cleared);

    this.add.text(cx, height * 0.16, allCleared ? t('wake.title.cleared') : t('wake.title.failed'), serif(26, '#fff3dc')).setOrigin(0.5);
    const score = scoreRun(results, layers);
    this.add.text(cx, height * 0.16 + 38, t('wake.score', { score }), sans(16, '#ffe2a6', true)).setOrigin(0.5);
    if (isLucid(results, layers)) {
      this.add.text(cx, height * 0.16 + 64, `✦ ${t('wake.lucid')} ✦`, serif(16, '#d6fff8', true)).setOrigin(0.5);
    }

    dream.layers.forEach((_, i) => {
      const r = results[i];
      const y = height * 0.36 + i * 40;
      const moons = r ? moonsFor(r) : 0;
      const name = i === 0 ? t('layer.name.1') : i === 1 ? t('layer.name.2') : t('layer.name.3');
      this.add.text(cx - 130, y, name, serif(16, r?.cleared ? '#f4ecff' : 'rgba(244,236,255,0.4)')).setOrigin(0, 0.5);
      this.add.text(cx + 130, y, '●'.repeat(moons) + '○'.repeat(3 - moons), sans(18, '#ffd27a')).setOrigin(1, 0.5);
    });

    const near = nearMiss(results, layers);
    if (near) this.add.text(cx, height * 0.36 + layers * 40 + 6, t('wake.near', { near }), serif(14, '#ffb36b', true)).setOrigin(0.5);

    const shareY = height * 0.36 + layers * 40 + 50;
    this.add.text(cx, shareY, t('wake.share.preview').toUpperCase(), { ...sans(10, 'rgba(244,236,255,0.55)'), letterSpacing: 2 }).setOrigin(0.5);
    this.add
      .text(cx, shareY + 24, shareLine(dream.night, results), sans(15, '#fff3dc'))
      .setOrigin(0.5)
      .setPadding(10, 6, 10, 6)
      .setBackgroundColor('rgba(255,255,255,0.06)');

    makeButton(
      this,
      cx,
      Math.min(height - 48, shareY + 100),
      t('wake.again'),
      () => {
        const data: DreamData = { ability: NIGHT_1.favours };
        this.scene.start('Pick', data);
      },
      260
    );
    makeMuteToggle(this, width - 6, 8);

    this.shatter();
  }

  /** Break the last dream frame into paper pieces that tumble away. */
  private shatter(): void {
    const key = this.info.shot;
    if (!key || !this.textures.exists(key)) {
      this.cameras.main.flash(500, 255, 250, 240);
      return;
    }
    audio.shatter();
    const { width, height } = this.scale;
    const src = this.textures.get(key).getSourceImage();
    const sw = src.width;
    const sh = src.height;
    const sx = width / sw;
    const sy = height / sh;
    if (settings.reducedMotion) {
      const img = this.add.image(0, 0, key).setOrigin(0).setScale(sx, sy).setDepth(5000);
      this.tweens.add({ targets: img, alpha: 0, duration: 600, onComplete: () => this.cleanup(key, [img]) });
      return;
    }
    const cols = settings.quality === 'low' ? 5 : 8;
    const rows = settings.quality === 'low' ? 7 : 11;
    const pw = sw / cols;
    const ph = sh / rows;
    const pieces: Phaser.GameObjects.Image[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const piece = this.add.image(0, 0, key).setOrigin(0.5).setScale(sx, sy).setDepth(5000);
        piece.setCrop(c * pw, r * ph, pw, ph);
        // Crop keeps the frame size, so move the origin to the piece's centre.
        piece.setDisplayOrigin((c + 0.5) * pw, (r + 0.5) * ph);
        piece.setPosition((c + 0.5) * pw * sx, (r + 0.5) * ph * sy);
        pieces.push(piece);
        const dx = (c - cols / 2) / cols;
        const dist = Math.hypot(dx, (r - rows / 2) / rows);
        this.tweens.add({
          targets: piece,
          x: piece.x + dx * width * 0.6 + Phaser.Math.Between(-30, 30),
          y: piece.y + height * Phaser.Math.FloatBetween(0.7, 1.2),
          angle: Phaser.Math.Between(-140, 140),
          scaleX: sx * 0.7,
          scaleY: sy * 0.7,
          alpha: 0,
          delay: 120 + dist * 500,
          duration: 1100,
          ease: 'Quad.easeIn',
        });
      }
    }
    this.cameras.main.flash(220, 255, 250, 240);
    this.time.delayedCall(2000, () => this.cleanup(key, pieces));
  }

  private cleanup(key: string, objs: Phaser.GameObjects.GameObject[]): void {
    objs.forEach((o) => o.destroy());
    if (this.textures.exists(key)) this.textures.remove(key);
  }

  override update(time: number): void {
    this.backdrop.update(time);
  }
}

function nearMiss(results: readonly LayerResult[], layers: number): string | null {
  const last = results.at(-1);
  if (!last) return null;
  if (!last.cleared) return t('near.pull', { layer: results.length });
  if (results.length === layers) {
    const close = results.find((r) => moonsFor(r) === 2 && r.moves > r.par + 2 && r.moves <= r.par + 4);
    if (close) {
      const n = close.moves - close.par - 2;
      return n === 1 ? t('near.moons.one') : t('near.moons.many', { n });
    }
  }
  return null;
}

function demoResults(): LayerResult[] {
  return [
    { cleared: true, timeLeftMs: 52_000, pullMs: 80_000, moves: 9, par: 8, caught: 0 },
    { cleared: true, timeLeftMs: 31_000, pullMs: 70_000, moves: 10, par: 8, caught: 0 },
    { cleared: true, timeLeftMs: 19_000, pullMs: 60_000, moves: 23, par: 20, caught: 1 },
  ];
}
