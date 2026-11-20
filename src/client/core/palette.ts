export type LayerPalette = {
  name: string;
  skyTop: string;
  skyBottom: string;
  floor: string;
  floorAlt: string;
  wallTop: string;
  wallFront: string;
  edge: string;
  glow: string;
  glowHex: number;
  ink: string;
};

/** L1 dusk violet, L2 deep teal, L3 ember gold (see docs/GAME_BIBLE.md §3). */
export const PALETTES: readonly LayerPalette[] = [
  {
    name: 'dusk',
    skyTop: '#120d24',
    skyBottom: '#3a2a5e',
    floor: '#4a3c7f',
    floorAlt: '#45387a',
    wallTop: '#c9bbf0',
    wallFront: '#4b3b82',
    edge: '#f3d9ff',
    glow: '#f3d9ff',
    glowHex: 0xf3d9ff,
    ink: '#1b1530',
  },
  {
    name: 'deep',
    skyTop: '#041c22',
    skyBottom: '#0f4a52',
    floor: '#1d4c51',
    floorAlt: '#1a464b',
    wallTop: '#a5e3dc',
    wallFront: '#235e5c',
    edge: '#d6fff8',
    glow: '#d6fff8',
    glowHex: 0xd6fff8,
    ink: '#06272c',
  },
  {
    name: 'ember',
    skyTop: '#1c0d04',
    skyBottom: '#5a2e0c',
    floor: '#653a18',
    floorAlt: '#5e3616',
    wallTop: '#f6d08f',
    wallFront: '#80461a',
    edge: '#fff1c9',
    glow: '#fff1c9',
    glowHex: 0xfff1c9,
    ink: '#2a1406',
  },
];

export const LANTERN = 0xffd27a;
export const LANTERN_CSS = '#ffd27a';
export const PAPER_TEXT = '#f4ecff';
export const SERIF = 'Georgia, "Times New Roman", serif';
export const SANS = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

/** Tile geometry for the 3/4 diorama view. */
export const TILE_W = 56;
export const TILE_D = 40;
export const WALL_H = 30;
export const SLAB_H = 22;
