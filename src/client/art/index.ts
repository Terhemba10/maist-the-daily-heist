import { smoothActive } from '../prefs.ts';
import { FIGURES, VIEWS, type FigureName, type View } from './sprites.ts';
import vault from './vault.svg?raw';

/** Vector art, inlined as SVG source (the vault). The crew and guards are 2D images: see figure(). */
export const ART = { vault } as const;
export type ArtName = keyof typeof ART;

export function isArtName(v: string | undefined): v is ArtName {
  return v !== undefined && v in ART;
}


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


export type { FigureName, View };

/** Crew figures by operative id (0 Vale, 1 Wren, 2 Oto). */
export const CREW_FIG: readonly FigureName[] = ['vale', 'wren', 'oto'];

/**
 * A 2D figure: one <img> per view, all loaded up front; CSS shows the one that matches the parent's
 * data-view (crew) or data-facing (guards), so turning never waits for an image. Smooth mode
 * loads the 128 px copies.
 */
export function figure(name: FigureName, views: readonly View[] = VIEWS, cls = ''): HTMLElement {
  const el = document.createElement('span');
  el.className = `pic pic-${name}${cls ? ` ${cls}` : ''}`;
  const small = smoothActive() ? 1 : 0;
  for (const v of views) {
    const img = document.createElement('img');
    img.className = `v-${v}`;
    img.src = FIGURES[name][v][small];
    img.alt = '';
    img.decoding = 'async';
    img.draggable = false;
    el.append(img);
  }
  return el;
}

export function isFigureName(v: string | undefined): v is FigureName {
  return v === 'vale' || v === 'wren' || v === 'oto' || v === 'guard';
}
