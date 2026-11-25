import guard from './guard.svg?raw';
import oto from './oto.svg?raw';
import vale from './vale.svg?raw';
import vault from './vault.svg?raw';
import watcher from './watcher.svg?raw';
import wren from './wren.svg?raw';

/** Game art, inlined as SVG source so it works inside Reddit's web view without network requests. */
export const ART = { vale, wren, oto, guard, watcher, vault } as const;
export type ArtName = keyof typeof ART;

export function isArtName(v: string | undefined): v is ArtName {
  return v !== undefined && v in ART;
}

/** Crew art by operative id (0 Vale, 1 Wren, 2 Oto). */
export const CREW_ART: readonly ArtName[] = ['vale', 'wren', 'oto'];

/** A sprite element holding one inline SVG. The SVG scales to the element's size. */
export function sprite(name: ArtName, cls = ''): HTMLElement {
  const el = document.createElement('span');
  el.className = `art art-${name}${cls ? ` ${cls}` : ''}`;
  el.innerHTML = ART[name];
  const svg = el.firstElementChild;
  if (svg) {
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
  }
  return el;
}
