import * as Phaser from 'phaser';
import { Scene } from 'phaser';
import { NIGHT_1 } from '../../shared/dreams/night1.ts';
import { audio } from '../core/audio.ts';
import { Backdrop } from '../core/backdrop.ts';
import { LANTERN } from '../core/palette.ts';
import { settings } from '../core/settings.ts';
import { makeButton, makeMuteToggle, sans, serif } from '../core/ui.ts';
import { t } from '../i18n/index.ts';

export class Title extends Scene {
  private backdrop!: Backdrop;

  constructor() {
    super('Title');
  }

  create(): void {
    this.backdrop = new Backdrop(this, 0);
    const { width, height } = this.scale;
    const cx = width / 2;
    const s = Math.min(1, width / 600);

    // A tiny floating room with the Diver, the game's emblem.
    const slab = this.add.image(0, 0, 'wall-0').setScale(1.6, 0.9).setAlpha(0.95);
    const diver = this.add.image(0, -30, 'diver').setOrigin(0.5, 0.94).setScale(0.9);
    const glow = this.add.image(12, -50, 'glow').setTint(LANTERN).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6).setScale(1.5);
    const emblem = this.add.container(cx, height * 0.62, [glow, slab, diver]).setScale(s);
    if (!settings.reducedMotion) {
      this.tweens.add({ targets: emblem, y: emblem.y - 10, duration: 2600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({ targets: glow, alpha: 0.35, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    const logo = this.add.image(cx, height * 0.27, 'logo').setScale(Math.min(0.9, (width - 40) / 560));
    this.add.text(cx, logo.y + logo.displayHeight * 0.42, t('app.tagline'), serif(Math.round(18 * Math.max(0.85, s)), '#e9dcff', true)).setOrigin(0.5);
    this.add
      .text(cx, logo.y - logo.displayHeight * 0.55, t('title.season').toUpperCase(), { ...sans(11, 'rgba(244,236,255,0.6)'), letterSpacing: 3 })
      .setOrigin(0.5);

    this.add
      .text(cx, height * 0.77, t('title.night', { night: NIGHT_1.night, dreamer: t('dreamer.ines') }), serif(17, '#ffe9c4'))
      .setOrigin(0.5);
    makeButton(this, cx, height * 0.86, t('title.dive'), () => this.dive(), 200);

    makeMuteToggle(this, width - 6, 8);
    const q = this.add
      .text(8, 8, '', sans(13, 'rgba(244,236,255,0.65)'))
      .setPadding(8, 6, 8, 6)
      .setInteractive({ useHandCursor: true });
    const label = () => q.setText(settings.quality === 'high' ? t('title.quality.high') : t('title.quality.low'));
    label();
    q.on('pointerdown', () => {
      settings.setQuality(settings.quality === 'high' ? 'low' : 'high');
      label();
      this.scene.restart();
    });

    this.input.keyboard?.once('keydown-ENTER', () => this.dive());
    this.input.keyboard?.once('keydown-SPACE', () => this.dive());
    this.input.gamepad?.once('down', () => this.dive());
    this.scale.on('resize', this.restartOnResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.restartOnResize, this));
  }

  private restartOnResize(): void {
    this.scene.restart();
  }

  private dive(): void {
    audio.unlock();
    this.cameras.main.fadeOut(350, 5, 3, 12);
    this.time.delayedCall(360, () => this.scene.start('Pick'));
  }

  override update(time: number): void {
    this.backdrop.update(time);
  }
}
