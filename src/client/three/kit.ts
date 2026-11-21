import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export type MatKind = 'solid' | 'shine' | 'glow' | 'glass';

type Part = { geo: THREE.BufferGeometry; kind: MatKind };

export type PartOpts = {
  pos?: [number, number, number];
  rot?: [number, number, number];
  scale?: [number, number, number];
  kind?: MatKind;
  /** Darken toward the ground (baked contact shadow). */
  ao?: boolean;
  /** Pull the colour toward this tint (0..1). */
  tint?: [number, number];
};

const tmpColor = new THREE.Color();
const tintColor = new THREE.Color();

/**
 * Collects low-poly parts with per-vertex colours and merges them into one mesh per material.
 * Baked shading: a contact-shadow gradient near the floor and a little top light.
 */
export class Kit {
  private parts: Part[] = [];

  add(geo: THREE.BufferGeometry, color: number, o: PartOpts = {}): void {
    let g = geo.index ? geo.toNonIndexed() : geo.clone();
    g.deleteAttribute('uv');
    if (g.getAttribute('uv1')) g.deleteAttribute('uv1');
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(...(o.rot ?? [0, 0, 0])));
    m.compose(new THREE.Vector3(...(o.pos ?? [0, 0, 0])), q, new THREE.Vector3(...(o.scale ?? [1, 1, 1])));
    g.applyMatrix4(m);
    g = g.index ? g.toNonIndexed() : g;
    const pos = g.getAttribute('position');
    const nor = g.getAttribute('normal');
    const pre = g.getAttribute('color');
    const colors = new Float32Array(pos.count * 3);
    tmpColor.setHex(color);
    if (o.tint) tmpColor.lerp(tintColor.setHex(o.tint[0]), o.tint[1]);
    for (let i = 0; i < pos.count; i++) {
      let k = 1;
      if (o.ao !== false) k *= 0.55 + 0.45 * THREE.MathUtils.clamp(pos.getY(i) / 0.55, 0, 1);
      if (nor && nor.getY(i) > 0.7) k *= 1.12; // top faces catch the moon
      const r = pre ? pre.getX(i) : 1;
      const gg = pre ? pre.getY(i) : 1;
      const b = pre ? pre.getZ(i) : 1;
      colors[i * 3] = tmpColor.r * k * r;
      colors[i * 3 + 1] = tmpColor.g * k * gg;
      colors[i * 3 + 2] = tmpColor.b * k * b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    this.parts.push({ geo: g, kind: o.kind ?? 'solid' });
  }

  get empty(): boolean {
    return this.parts.length === 0;
  }

  build(mats: Record<MatKind, THREE.Material>): THREE.Group {
    const group = new THREE.Group();
    (['solid', 'shine', 'glow', 'glass'] as const).forEach((kind) => {
      const geos = this.parts.filter((p) => p.kind === kind).map((p) => p.geo);
      if (!geos.length) return;
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) return;
      const mesh = new THREE.Mesh(merged, mats[kind]);
      if (kind === 'glass') mesh.renderOrder = 2;
      group.add(mesh);
    });
    this.parts = [];
    return group;
  }
}

/** Shared materials for one room (flat-shaded paper look, no shadow maps). */
export function roomMaterials(edge: number): Record<MatKind, THREE.Material> {
  return {
    solid: new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }),
    shine: new THREE.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 60, specular: 0x2a2a3a }),
    glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    glass: new THREE.MeshPhongMaterial({
      vertexColors: true,
      flatShading: true,
      transparent: true,
      opacity: 0.55,
      shininess: 120,
      specular: 0xffffff,
      emissive: new THREE.Color(edge).multiplyScalar(0.15),
      depthWrite: false,
    }),
  };
}

/** Deterministic hash for picking props per tile. */
export function hash2(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
