import type * as Phaser from 'phaser';
import type { GameObjects, Scene } from 'phaser';
import { audio } from './audio.ts';
import { PAPER_TEXT, SANS, SERIF } from './palette.ts';
import { settings } from './settings.ts';
import { t } from '../i18n/index.ts';

export function serif(size: number, color = PAPER_TEXT, italic = false): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: SERIF, fontSize: `${size}px`, color, fontStyle: italic ? 'italic' : 'normal' };
}

export function sans(size: number, color = PAPER_TEXT, bold = false): Phaser.Types.GameObjects.Text.TextStyle {
  return { fontFamily: SANS, fontSize: `${size}px`, color, fontStyle: bold ? 'bold' : 'normal' };
}

/** A paper-outline pill button with press feedback. */
export function makeButton(
  scene: Scene,
  x: number,
  y: number,
  label: string,
  onClick: () => void,
  width = 220
): GameObjects.Container {
  const bg = scene.add.image(0, 0, 'button').setDisplaySize(width, 56);
  const text = scene.add.text(0, 0, label, serif(22, '#ffe9c4')).setOrigin(0.5);
  const c = scene.add.container(x, y, [bg, text]);
  c.setSize(width, 56);
  c.setInteractive({ useHandCursor: true });
  c.on('pointerover', () => bg.setAlpha(1.25));
  c.on('pointerout', () => bg.setAlpha(1));
  c.on('pointerdown', () => {
    audio.unlock();
    audio.click();
    scene.tweens.add({ targets: c, scale: 0.94, duration: 70, yoyo: true, onComplete: onClick });
  });
  return c;
}

/** Small corner toggle for sound. Returns the text so callers can reposition it. */
export function makeMuteToggle(scene: Scene, x: number, y: number): GameObjects.Text {
  const label = () => (settings.muted ? t('menu.unmute') : t('menu.mute'));
  const txt = scene.add
    .text(x, y, label(), sans(13, 'rgba(244,236,255,0.75)'))
    .setOrigin(1, 0)
    .setPadding(8, 6, 8, 6)
    .setInteractive({ useHandCursor: true });
  txt.on('pointerdown', (_p: Phaser.Input.Pointer, _x: number, _y: number, ev: Phaser.Types.Input.EventData) => {
    ev.stopPropagation();
    audio.unlock();
    audio.setMuted(!settings.muted);
    txt.setText(label());
  });
  scene.input.keyboard?.on('keydown-M', () => {
    audio.setMuted(!settings.muted);
    txt.setText(label());
  });
  return txt;
}

/** Quick fading caption in the middle of the screen. */
export function toast(scene: Scene, message: string, y?: number, ms = 2200): void {
  const { width, height } = scene.scale;
  const txt = scene.add
    .text(width / 2, y ?? height * 0.22, message, {
      ...serif(18, '#fff3dc', true),
      align: 'center',
      wordWrap: { width: Math.min(420, width - 48) },
    })
    .setOrigin(0.5)
    .setDepth(5000)
    .setAlpha(0);
  scene.tweens.add({ targets: txt, alpha: 1, y: txt.y - 6, duration: 260 });
  scene.tweens.add({ targets: txt, alpha: 0, delay: ms, duration: 400, onComplete: () => txt.destroy() });
}
