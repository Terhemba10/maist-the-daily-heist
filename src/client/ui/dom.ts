/** Tiny DOM helpers for the overlay UI. */
import { audio } from '../core/audio.ts';

type Attrs = Record<string, string | number | boolean | ((ev: Event) => void)>;
type Child = Node | string | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | string = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  const a: Attrs = typeof attrs === 'string' ? { class: attrs } : attrs;
  for (const [k, v] of Object.entries(a)) {
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, ''), v);
    else if (k === 'class') el.className = String(v);
    else if (v === true) el.setAttribute(k, '');
    else if (v !== false) el.setAttribute(k, String(v));
  }
  for (const c of children) if (c) el.append(c);
  return el;
}

export const ui = (): HTMLElement => {
  const el = document.getElementById('ui');
  if (!el) throw new Error('#ui missing');
  return el;
};

/** Button with a click sound; stops the event so it never becomes a swipe. */
export function button(label: string, cls: string, onClick: () => void): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button' }, label);
  b.addEventListener('pointerdown', (e) => e.stopPropagation());
  b.addEventListener('click', (e) => {
    e.stopPropagation();
    audio.unlock();
    audio.click();
    onClick();
  });
  return b;
}

export function toast(message: string, top: number | string = '22%', ms = 2200): void {
  const el = h('div', 'toast', message);
  el.style.top = typeof top === 'number' ? `${top}px` : top;
  el.style.setProperty('--ms', `${ms}ms`);
  ui().append(el);
  window.setTimeout(() => el.remove(), ms + 50);
}

export function show(el: HTMLElement, on: boolean): void {
  el.classList.toggle('hidden', !on);
}
