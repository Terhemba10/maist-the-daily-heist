import * as THREE from 'three';
import type { LayerLook } from '../core/palette.ts';
import { hash2, type Kit } from './kit.ts';

/** Prop builders for Night 1's three layers. Each obstacle is an object, not a block. */

type P = { kit: Kit; x: number; z: number; r: number; look: LayerLook };

const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const cyl = (rt: number, rb: number, h: number, seg = 10) => new THREE.CylinderGeometry(rt, rb, h, seg);

function tint(look: LayerLook, k = 0.22): [number, number] {
  return [look.tint, k];
}

// ---------------------------------------------------------------- Layer 1: The Keeper's Rock

function crate({ kit, x, z, r, look }: P, y = 0, s = 0.78): void {
  const wood = r < 0.5 ? 0x8a6440 : 0x7a5838;
  const rot: [number, number, number] = [0, (r - 0.5) * 0.5, 0];
  kit.add(box(s, s, s), wood, { pos: [x, y + s / 2, z], rot, tint: tint(look) });
  // Plank frame on the edges.
  const t = 0.07;
  const dark = 0x4a3420;
  for (const [dx, dz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    kit.add(box(t, s + 0.02, t), dark, { pos: [x + (dx * s) / 2, y + s / 2, z + (dz * s) / 2], rot, tint: tint(look) });
  }
  kit.add(box(s + 0.02, t, t), dark, { pos: [x, y + s - t / 2, z + s / 2], rot, tint: tint(look) });
  kit.add(box(s * 1.2, t * 0.8, t), dark, { pos: [x, y + s / 2, z + s / 2 + 0.01], rot: [0, rot[1], 0.78], tint: tint(look) });
}

function ropeBollard({ kit, x, z, look }: P): void {
  kit.add(cyl(0.16, 0.2, 0.85, 8), 0x3f4150, { pos: [x, 0.42, z], tint: tint(look) });
  kit.add(cyl(0.22, 0.22, 0.06, 8), 0x2e3040, { pos: [x, 0.86, z], tint: tint(look) });
  for (let i = 0; i < 4; i++) {
    kit.add(new THREE.TorusGeometry(0.27 - i * 0.012, 0.065, 5, 14), 0xcdb48a, { pos: [x, 0.12 + i * 0.11, z], rot: [Math.PI / 2, 0, i * 0.6], tint: tint(look, 0.15) });
  }
}

function cask({ kit, x, z, r, look }: P): void {
  kit.add(cyl(0.3, 0.3, 0.8, 10), 0x6b4a30, { pos: [x, 0.4, z], rot: [0, r * 3, 0], tint: tint(look) });
  kit.add(cyl(0.34, 0.34, 0.12, 10), 0x6b4a30, { pos: [x, 0.4, z], tint: tint(look) });
  for (const y of [0.14, 0.66]) kit.add(new THREE.TorusGeometry(0.31, 0.025, 4, 14), 0x2a2a30, { pos: [x, y, z], rot: [Math.PI / 2, 0, 0], ao: false });
}

function crateStack(p: P): void {
  crate(p, 0, 0.8);
  crate({ ...p, x: p.x + 0.05, z: p.z - 0.05, r: 1 - p.r }, 0.8, 0.5);
}

// ---------------------------------------------------------------- Layer 2: The Drowned Stair

function barnacleCrate(p: P): void {
  crate(p, 0, 0.76);
  for (let i = 0; i < 7; i++) {
    const a = hash2(i, Math.round(p.x * 10), 3);
    const b = hash2(i, Math.round(p.z * 10), 5);
    p.kit.add(new THREE.SphereGeometry(0.06 + a * 0.04, 5, 3), 0xd9d2bf, { pos: [p.x - 0.35 + a * 0.7, 0.1 + b * 0.6, p.z + 0.39], ao: false });
  }
}

function anchor({ kit, x, z, look }: P): void {
  const iron = 0x3a4a50;
  kit.add(box(0.12, 0.95, 0.12), iron, { pos: [x, 0.55, z], rot: [0, 0, 0.12], tint: tint(look) });
  kit.add(box(0.6, 0.1, 0.1), iron, { pos: [x + 0.06, 0.88, z], rot: [0, 0, 0.12], tint: tint(look) });
  kit.add(new THREE.TorusGeometry(0.34, 0.06, 5, 12, Math.PI), iron, { pos: [x - 0.01, 0.38, z], rot: [Math.PI, 0, 0.12], tint: tint(look) });
  kit.add(new THREE.TorusGeometry(0.1, 0.035, 4, 10), iron, { pos: [x + 0.13, 1.08, z], rot: [0, 0, 0.12], tint: tint(look) });
  kit.add(new THREE.SphereGeometry(0.3, 6, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0xb9a77f, { pos: [x, 0, z], scale: [1.3, 0.5, 1.3], tint: tint(look, 0.1) });
}

function coral({ kit, x, z, r, look }: P): void {
  const colors = [0xff8a7a, 0xffb36b, 0xe07ab0];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r;
    const h = 0.45 + hash2(i, Math.round(x * 7)) * 0.55;
    kit.add(cyl(0.03, 0.08, h, 5), colors[i % 3] ?? 0xff8a7a, {
      pos: [x + Math.cos(a) * 0.18, h / 2, z + Math.sin(a) * 0.18],
      rot: [Math.sin(a) * 0.35, 0, Math.cos(a) * 0.35],
      tint: tint(look, 0.12),
    });
  }
  kit.add(new THREE.DodecahedronGeometry(0.32, 0), 0x7a6a8a, { pos: [x, 0.12, z], scale: [1, 0.55, 1], tint: tint(look) });
}

function kelpRock({ kit, x, z, r, look }: P): void {
  kit.add(new THREE.DodecahedronGeometry(0.42, 0), 0x55606a, { pos: [x, 0.28, z], scale: [1, 0.75, 0.9], rot: [r, r * 2, 0], tint: tint(look) });
  for (let i = 0; i < 4; i++) {
    const h = 0.8 + hash2(i, Math.round(z * 9)) * 0.5;
    kit.add(box(0.08, h, 0.02), 0x3f8a5a, { pos: [x - 0.25 + i * 0.17, 0.35 + h / 2, z + 0.2], rot: [0.1, 0, (i - 1.5) * 0.15], tint: tint(look, 0.1) });
  }
}

// ---------------------------------------------------------------- Layer 3: The Lamp Room

function lensShards({ kit, x, z, r, look }: P): void {
  kit.add(cyl(0.3, 0.36, 0.14, 8), 0x8a6a3a, { pos: [x, 0.07, z], tint: tint(look) });
  for (let i = 0; i < 3; i++) {
    const h = 0.6 + hash2(i, Math.round(x * 13)) * 0.5;
    kit.add(cyl(0, 0.16, h, 3), 0xffe9b0, {
      kind: 'glass',
      pos: [x - 0.15 + i * 0.15, 0.14 + h / 2, z + (i - 1) * 0.08],
      rot: [(i - 1) * 0.2, r * 3 + i, (i - 1) * 0.25],
      ao: false,
    });
  }
}

function gear({ kit, x, z, r, look }: P): void {
  const brass = 0xc89a48;
  const rot: [number, number, number] = [Math.PI / 2, 0, r];
  kit.add(cyl(0.38, 0.38, 0.12, 12), brass, { pos: [x, 0.5, z], rot: [Math.PI / 2, 0, 0], kind: 'shine', tint: tint(look, 0.1) });
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + r;
    kit.add(box(0.12, 0.13, 0.13), brass, { pos: [x + Math.cos(a) * 0.43, 0.5 + Math.sin(a) * 0.43, z], rot: [0, 0, a], kind: 'shine', tint: tint(look, 0.1) });
  }
  kit.add(cyl(0.08, 0.08, 0.2, 8), 0x5a4020, { pos: [x, 0.5, z], rot, ao: false });
  kit.add(box(0.5, 0.12, 0.3), 0x5a4020, { pos: [x, 0.06, z], tint: tint(look) });
}

function oilBarrel({ kit, x, z, look }: P): void {
  kit.add(cyl(0.28, 0.28, 0.78, 12), 0x7a2a1a, { pos: [x, 0.39, z], kind: 'shine', tint: tint(look, 0.15) });
  for (const y of [0.2, 0.58]) kit.add(new THREE.TorusGeometry(0.285, 0.02, 4, 16), 0x2a1a10, { pos: [x, y, z], rot: [Math.PI / 2, 0, 0], ao: false });
  kit.add(cyl(0.04, 0.04, 0.06, 6), 0xd0a040, { pos: [x + 0.12, 0.8, z], ao: false });
}

function books({ kit, x, z, r, look }: P): void {
  const cols = [0x6a2a2a, 0x2a4a6a, 0x4a5a2a, 0x7a5a2a];
  let y = 0;
  for (let i = 0; i < 6; i++) {
    const h = 0.11 + hash2(i, Math.round(x * 5)) * 0.06;
    kit.add(box(0.62 - i * 0.03, h, 0.46), cols[i % 4] ?? 0x6a2a2a, { pos: [x, y + h / 2, z], rot: [0, r + (i % 2 ? 0.25 : -0.15), 0], tint: tint(look, 0.15) });
    y += h;
  }
}

/** Pick an obstacle for a wall tile, by layer. */
export function obstacle(layer: number, p: P): void {
  const sets: ((p: P) => void)[][] = [
    [crate, ropeBollard, cask, crateStack],
    [barnacleCrate, anchor, coral, kelpRock],
    [lensShards, gear, oilBarrel, books],
  ];
  const set = sets[layer] ?? sets[0] ?? [];
  const fn = set[Math.floor(p.r * set.length) % set.length];
  fn?.(p);
}

/** Tide door: a frame plus a panel that slides. Returns the frame parts in the kit and a separate panel mesh. */
export function doorFrame(layer: number, kit: Kit, x: number, z: number, look: LayerLook): void {
  const col = layer === 0 ? 0x5a4028 : layer === 1 ? 0xff9a8a : 0xc89a48;
  const kind = layer === 2 ? 'shine' : 'solid';
  for (const dx of [-0.42, 0.42]) kit.add(box(0.1, 1.05, 0.14), col, { pos: [x + dx, 0.52, z], kind, tint: tint(look, 0.15) });
  kit.add(box(0.96, 0.1, 0.16), col, { pos: [x, 1.07, z], kind, tint: tint(look, 0.15) });
}

export function doorPanel(layer: number, look: LayerLook, edge: number): THREE.Mesh {
  const col = layer === 0 ? 0x7a5a3a : layer === 1 ? 0x3f8a6a : 0xb08a40;
  const geo = layer === 2 ? new THREE.BoxGeometry(0.74, 0.9, 0.05) : new THREE.BoxGeometry(0.74, 0.92, 0.08);
  const mat = new THREE.MeshLambertMaterial({ color: new THREE.Color(col).lerp(new THREE.Color(look.tint), 0.2), emissive: new THREE.Color(edge), emissiveIntensity: 0, flatShading: true });
  return new THREE.Mesh(geo, mat);
}

/** The Drop: a spiral stair winding down into a glowing well. */
export function spiralStair(kit: Kit, x: number, z: number, look: LayerLook): void {
  kit.add(new THREE.TorusGeometry(0.42, 0.06, 4, 18), 0x9a94a8, { pos: [x, 0.02, z], rot: [Math.PI / 2, 0, 0], tint: tint(look, 0.3), ao: false });
  kit.add(cyl(0.4, 0.3, 1.4, 14, ), 0x050308, { pos: [x, -0.68, z], ao: false });
  for (let i = 0; i < 9; i++) {
    const a = i * 0.7;
    kit.add(box(0.32, 0.06, 0.14), 0xa8a2b8, { pos: [x + Math.cos(a) * 0.2, -0.05 - i * 0.12, z + Math.sin(a) * 0.2], rot: [0, -a, 0], tint: tint(look, 0.3), ao: false });
  }
  kit.add(new THREE.TorusGeometry(0.36, 0.015, 3, 24), look.edge, { pos: [x, 0.045, z], rot: [Math.PI / 2, 0, 0], kind: 'glow', ao: false });
}

/** Wall lanterns on the back wall (glow parts). */
export function wallLantern(kit: Kit, x: number, y: number, z: number): void {
  kit.add(box(0.14, 0.2, 0.14), 0x2a2420, { pos: [x, y, z], ao: false });
  kit.add(box(0.1, 0.13, 0.1), 0xffd27a, { pos: [x, y, z + 0.01], kind: 'glow', ao: false });
}
