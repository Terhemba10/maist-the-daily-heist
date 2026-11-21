import type { AbilityId, Dir } from '../../shared/logic/types.ts';
import { iconCanvas } from '../core/art.ts';
import { reducedMotion } from '../core/settings.ts';
import { t } from '../i18n/index.ts';
import { button, h } from './dom.ts';

const C = 2 * Math.PI * 24;

/** In-dream HUD: layer name, heartbeat Pull ring, moves, ability button, touch pad. */
export class Hud {
  readonly el: HTMLElement;
  private layer = h('div', 'layer serif');
  private moves = h('div', 'moves');
  private fg: SVGCircleElement;
  private ring: HTMLElement;
  private secs = h('b');
  private key = h('i', 'key');
  private pip = h('i');
  private vignette = h('div', 'vignette');

  constructor(ability: AbilityId, touch: boolean, on: { dir: (d: Dir) => void; ability: () => void; settings: () => void }) {
    const ns = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 60 60');
    const bg = document.createElementNS(ns, 'circle');
    this.fg = document.createElementNS(ns, 'circle');
    for (const [c, stroke, op] of [
      [bg, '#ffffff', '0.12'],
      [this.fg, '#ffe2a6', '0.95'],
    ] as const) {
      c.setAttribute('cx', '30');
      c.setAttribute('cy', '30');
      c.setAttribute('r', '24');
      c.setAttribute('fill', 'none');
      c.setAttribute('stroke', stroke);
      c.setAttribute('stroke-opacity', op);
      c.setAttribute('stroke-width', '5');
      svg.append(c);
    }
    this.fg.setAttribute('stroke-dasharray', String(C));
    this.ring = h('div', 'ring');
    this.ring.append(svg, this.secs, this.key);

    const abil = h('div', 'abil', iconCanvas(ability, 84), this.pip, h('span', {}, t(ability === 'still' ? 'ability.still' : ability === 'blink' ? 'ability.blink' : 'ability.lantern')));
    abil.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      on.ability();
    });

    const pad = touch
      ? h(
          'div',
          'pad',
          ...(
            [
              ['u', '▲', 'up'],
              ['d', '▼', 'down'],
              ['l', '◀', 'left'],
              ['r', '▶', 'right'],
            ] as const
          ).map(([cls, label, dir]) => {
            const b = h('button', { class: cls, type: 'button', 'aria-label': dir }, label);
            b.addEventListener('pointerdown', (e) => {
              e.stopPropagation();
              e.preventDefault();
              on.dir(dir);
            });
            return b;
          })
        )
      : h('div', 'hint', t('hud.hint'));

    this.el = h(
      'div',
      'screen hud',
      this.vignette,
      h('div', 'top', this.layer, this.ring, this.moves, button('⚙', 'corner gear', on.settings)),
      abil,
      pad
    );
  }

  setLayer(name: string): void {
    this.layer.textContent = name;
  }

  setMoves(n: number): void {
    this.moves.textContent = t('hud.moves', { moves: n });
  }

  setKey(on: boolean): void {
    this.key.classList.toggle('on', on);
  }

  setCharge(n: number): void {
    this.pip.classList.toggle('empty', n <= 0);
  }

  /** Ring, heartbeat pulse and red edge as the Pull closes. */
  setPull(frac: number, secondsLeft: number, time: number): void {
    this.fg.setAttribute('stroke-dashoffset', String(C * (1 - frac)));
    this.fg.setAttribute('stroke', frac > 0.5 ? '#ffe2a6' : frac > 0.25 ? '#ffb36b' : '#ff7a6b');
    this.secs.textContent = String(Math.ceil(secondsLeft));
    let scale = 1;
    if (frac < 0.3 && !reducedMotion()) {
      const rate = 1.2 + (1 - frac / 0.3) * 1.8;
      scale += Math.pow(Math.max(0, Math.sin(time * rate * Math.PI * 2)), 6) * 0.12;
    }
    this.ring.style.transform = `scale(${scale})`;
    const edge = frac < 0.25 ? (0.25 - frac) / 0.25 : 0;
    const pulse = reducedMotion() ? 1 : 0.8 + 0.2 * Math.sin(time * 12);
    this.vignette.style.opacity = String(Math.min(1, edge * 1.3) * pulse);
  }
}
