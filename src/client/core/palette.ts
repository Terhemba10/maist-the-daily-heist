import type { ThemeId } from './settings.ts';

/** Colours for one layer of a dream. Hex numbers for three.js, plus CSS strings for the UI. */
export type LayerLook = {
  name: string;
  skyTop: number;
  skyBottom: number;
  fog: number;
  floorA: number;
  floorB: number;
  slab: number;
  wall: number;
  edge: number;
  accent: number;
  /** Tint that pulls props toward the layer's mood. */
  tint: number;
  ambient: number;
};

type ThemeDef = { id: ThemeId; label: string; layers: [LayerLook, LayerLook, LayerLook]; ui: { accent: string; ink: string } };

const moonlit: ThemeDef = {
  id: 'moonlit',
  label: 'Moonlit',
  ui: { accent: '#ffe2a6', ink: '#120d24' },
  layers: [
    { name: 'dusk', skyTop: 0x120d24, skyBottom: 0x3a2a5e, fog: 0x231a3d, floorA: 0x4a4862, floorB: 0x3f3d57, slab: 0x3b2f66, wall: 0x6a5f8f, edge: 0xf3d9ff, accent: 0xb9a8e6, tint: 0x7d6bc0, ambient: 0x8c7fd0 },
    { name: 'deep', skyTop: 0x041c22, skyBottom: 0x0f4a52, fog: 0x07323a, floorA: 0x9c8e6c, floorB: 0x8c7f60, slab: 0x1d5552, wall: 0x2f7a78, edge: 0xd6fff8, accent: 0x8fd6cf, tint: 0x2f9a94, ambient: 0x6fc7c0 },
    { name: 'ember', skyTop: 0x1c0d04, skyBottom: 0x5a2e0c, fog: 0x3a1c08, floorA: 0x9a6a2a, floorB: 0x875c24, slab: 0x6e3c14, wall: 0x9a5a22, edge: 0xfff1c9, accent: 0xf2c27a, tint: 0xd88a3a, ambient: 0xf0b070 },
  ],
};

const rose: ThemeDef = {
  id: 'rose',
  label: 'Rose Dream',
  ui: { accent: '#ffc7d9', ink: '#1e0d1c' },
  layers: [
    { ...moonlit.layers[0], skyTop: 0x1e0d1c, skyBottom: 0x5a2a4e, fog: 0x3a1a34, slab: 0x5a2a52, wall: 0x8a5a86, edge: 0xffd9ec, accent: 0xf0a8cc, tint: 0xc06ba0, ambient: 0xd88fb8 },
    { ...moonlit.layers[1], skyTop: 0x1a0d22, skyBottom: 0x4a2a5a, fog: 0x2e1a3a, slab: 0x4a2a5a, wall: 0x7a5a9a, edge: 0xf0e0ff, accent: 0xd0b0f0, tint: 0x9a6bc0, ambient: 0xb898e0 },
    { ...moonlit.layers[2], skyTop: 0x2a0d10, skyBottom: 0x6a2a2a, fog: 0x401818, edge: 0xffe0d0, accent: 0xffb0a0, tint: 0xe07a6a, ambient: 0xf0a090 },
  ],
};

const ocean: ThemeDef = {
  id: 'ocean',
  label: 'Ocean',
  ui: { accent: '#bdf3ff', ink: '#03141f' },
  layers: [
    { ...moonlit.layers[0], skyTop: 0x03141f, skyBottom: 0x0c3a5a, fog: 0x082638, slab: 0x0f3a5a, wall: 0x3a6a8a, edge: 0xd0f4ff, accent: 0x8fd0f0, tint: 0x3a8ac0, ambient: 0x7ab8e0 },
    { ...moonlit.layers[1], skyTop: 0x021a1a, skyBottom: 0x0a4a4a, fog: 0x063030 },
    { ...moonlit.layers[2], skyTop: 0x0a1424, skyBottom: 0x2a4a6a, fog: 0x14283c, edge: 0xfff6dc, tint: 0xc0a060, ambient: 0xd0c0a0 },
  ],
};

const midnight: ThemeDef = {
  id: 'midnight',
  label: 'Midnight',
  ui: { accent: '#dfe6ff', ink: '#05060f' },
  layers: [
    { ...moonlit.layers[0], skyTop: 0x05060f, skyBottom: 0x141a33, fog: 0x0a0d1e, floorA: 0x45485a, floorB: 0x3c3f50, slab: 0x1c2140, wall: 0x4a5070, edge: 0xdfe6ff, accent: 0xa8b4e6, tint: 0x5a64a0, ambient: 0x7a84c0 },
    { ...moonlit.layers[1], skyTop: 0x020a10, skyBottom: 0x0a2230, fog: 0x05141c, edge: 0xdff6ff, ambient: 0x5aa0b0 },
    { ...moonlit.layers[2], skyTop: 0x0c0805, skyBottom: 0x2a1a0c, fog: 0x160e06, ambient: 0xc09060 },
  ],
};

/** Colour-blind safe: Okabe-Ito accents, dark neutral grounds, bright path edges. */
const contrast: ThemeDef = {
  id: 'contrast',
  label: 'High contrast',
  ui: { accent: '#F0E442', ink: '#000000' },
  layers: [
    { name: 'dusk', skyTop: 0x000000, skyBottom: 0x101018, fog: 0x08080c, floorA: 0x3a3a3a, floorB: 0x333333, slab: 0x1a1a1a, wall: 0x666666, edge: 0xf0e442, accent: 0x56b4e9, tint: 0x888888, ambient: 0xcccccc },
    { name: 'deep', skyTop: 0x000000, skyBottom: 0x081018, fog: 0x04080c, floorA: 0x3a3a3a, floorB: 0x333333, slab: 0x1a1a1a, wall: 0x666666, edge: 0x56b4e9, accent: 0x009e73, tint: 0x888888, ambient: 0xcccccc },
    { name: 'ember', skyTop: 0x000000, skyBottom: 0x180c00, fog: 0x0c0600, floorA: 0x3a3a3a, floorB: 0x333333, slab: 0x1a1a1a, wall: 0x666666, edge: 0xe69f00, accent: 0xd55e00, tint: 0x888888, ambient: 0xcccccc },
  ],
};

export const THEMES: readonly ThemeDef[] = [moonlit, rose, ocean, midnight, contrast];

export function theme(id: ThemeId): ThemeDef {
  return THEMES.find((t) => t.id === id) ?? moonlit;
}

export function cssHex(n: number): string {
  return `#${n.toString(16).padStart(6, '0')}`;
}

/** Diver cosmetics. `nights` = streak needed to unlock (0 = always). */
export const CLOAKS = [
  { id: 'ink', label: 'Ink', color: 0x1d1830, nights: 0 },
  { id: 'plum', label: 'Plum', color: 0x4a1f4f, nights: 0 },
  { id: 'moss', label: 'Moss', color: 0x24402c, nights: 0 },
  { id: 'sand', label: 'Sand', color: 0x7a6248, nights: 0 },
  { id: 'pearl', label: 'Pearl', color: 0xd8d2e6, nights: 3 },
] as const;

export const LANTERNS = [
  { id: 'amber', label: 'Amber', color: 0xffd27a, nights: 0 },
  { id: 'mint', label: 'Mint', color: 0x9dffd8, nights: 0 },
  { id: 'rose', label: 'Rose', color: 0xff9fc4, nights: 0 },
  { id: 'gold', label: 'Gold', color: 0xffc23a, nights: 7 },
  { id: 'moon', label: 'Moonwhite', color: 0xeaf2ff, nights: 14 },
] as const;

export function cloakColor(id: string): number {
  return CLOAKS.find((c) => c.id === id)?.color ?? 0x1d1830;
}

export function lanternColor(id: string): number {
  return LANTERNS.find((c) => c.id === id)?.color ?? 0xffd27a;
}

export const SERIF = 'Georgia, "Times New Roman", serif';
