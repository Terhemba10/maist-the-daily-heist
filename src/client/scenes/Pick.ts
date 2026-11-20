import { Scene, type GameObjects } from 'phaser';
import { NIGHT_1 } from '../../shared/dreams/night1.ts';
import type { AbilityId } from '../../shared/logic/types.ts';
import { audio } from '../core/audio.ts';
import { Backdrop } from '../core/backdrop.ts';
import { makeButton, makeMuteToggle, sans, serif } from '../core/ui.ts';
import { t } from '../i18n/index.ts';
import type { DreamData } from './Dream.ts';

const ABILITIES: AbilityId[] = ['still', 'blink', 'lantern'];

/** Choose one ability before the dream. One charge per layer. */
export class Pick extends Scene {
  private backdrop!: Backdrop;
  private chosen: AbilityId = NIGHT_1.favours;
  private cards: { id: AbilityId; frame: GameObjects.Rectangle }[] = [];

  constructor() {
    super('Pick');
  }

  create(): void {
    this.cameras.main.fadeIn(300, 5, 3, 12);
    this.backdrop = new Backdrop(this, 0, false);
    this.cards = [];
    const { width, height } = this.scale;
    const cx = width / 2;
    const narrow = width < 560;

    this.add.text(cx, height * 0.12, t('pick.heading'), serif(26, '#fff3dc')).setOrigin(0.5);
    this.add.text(cx, height * 0.12 + 32, t('pick.sub'), sans(13, 'rgba(244,236,255,0.7)')).setOrigin(0.5);
    this.add.text(cx, height * 0.12 + 56, t('dreamer.ines.hint'), serif(14, '#ffe2a6', true)).setOrigin(0.5);

    const cardW = narrow ? Math.min(320, width - 40) : 170;
    const cardH = narrow ? 92 : 210;
    ABILITIES.forEach((id, i) => {
      const x = narrow ? cx : cx + (i - 1) * (cardW + 18);
      const y = narrow ? height * 0.33 + i * (cardH + 12) : height * 0.47;
      const frame = this.add.rectangle(0, 0, cardW, cardH, 0x150f26, 0.82).setStrokeStyle(1.5, 0xffe2a6, 0.35);
      const icon = this.add.image(narrow ? -cardW / 2 + 44 : 0, narrow ? 0 : -54, `icon-${id}`).setScale(narrow ? 0.8 : 1);
      const name = this.add.text(narrow ? -cardW / 2 + 86 : 0, narrow ? -22 : 6, `${i + 1}  ${t(`ability.${id}`)}`, serif(19, '#fff3dc')).setOrigin(narrow ? 0 : 0.5, 0);
      const desc = this.add
        .text(narrow ? -cardW / 2 + 86 : 0, narrow ? 4 : 36, t(`ability.${id}.desc`), {
          ...sans(12, 'rgba(244,236,255,0.78)'),
          wordWrap: { width: narrow ? cardW - 100 : cardW - 24 },
          align: narrow ? 'left' : 'center',
        })
        .setOrigin(narrow ? 0 : 0.5, 0);
      const card = this.add.container(x, y, [frame, icon, name, desc]).setSize(cardW, cardH);
      card.setInteractive({ useHandCursor: true });
      card.on('pointerdown', () => this.choose(id));
      this.cards.push({ id, frame });
    });
    this.choose(this.chosen, true);

    const btnY = narrow ? Math.min(height - 50, height * 0.33 + 3 * (cardH + 12) + 30) : height * 0.8;
    makeButton(this, cx, btnY, t('pick.start'), () => this.start(), 200);
    makeMuteToggle(this, width - 6, 8);

    const keys: Record<string, AbilityId> = { Digit1: 'still', Digit2: 'blink', Digit3: 'lantern' };
    this.input.keyboard?.on('keydown', (ev: KeyboardEvent) => {
      const id = keys[ev.code];
      if (id) this.choose(id);
      if (ev.code === 'Enter' || ev.code === 'Space') this.start();
    });
    this.scale.on('resize', this.restartOnResize, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.restartOnResize, this));
  }

  private restartOnResize(): void {
    this.scene.restart();
  }

  private choose(id: AbilityId, silent = false): void {
    this.chosen = id;
    if (!silent) audio.click();
    for (const c of this.cards) {
      const on = c.id === id;
      c.frame.setStrokeStyle(on ? 2.5 : 1.5, 0xffe2a6, on ? 1 : 0.35);
      c.frame.setFillStyle(on ? 0x2a1f44 : 0x150f26, on ? 0.92 : 0.82);
    }
  }

  private start(): void {
    audio.unlock();
    const data: DreamData = { ability: this.chosen };
    this.cameras.main.fadeOut(400, 5, 3, 12);
    this.time.delayedCall(420, () => this.scene.start('Dream', data));
  }

  override update(time: number): void {
    this.backdrop.update(time);
  }
}
