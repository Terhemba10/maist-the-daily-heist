import * as THREE from 'three';
import { cellAt, parseBoard, type Board } from '../../shared/logic/board.ts';
import { doorOpen, isRevealed, lanternLit, tideAboutToTurn, type LayerState } from '../../shared/logic/layer.ts';
import type { Cell, Vec } from '../../shared/logic/types.ts';
import { beamCanvas, causticCanvas, glowCanvas } from '../core/art.ts';
import type { LayerLook } from '../core/palette.ts';
import { particleCap, reducedMotion } from '../core/settings.ts';
import { hash2, Kit, roomMaterials, type MatKind } from './kit.ts';
import { doorFrame, doorPanel, obstacle, spiralStair, wallLantern } from './props.ts';

const TILE_TOP = 0;
const WALL_H = 1.15;
const SLAB = 0.62;

let glowTex: THREE.CanvasTexture | null = null;
let beamTex: THREE.CanvasTexture | null = null;
let causticTex: THREE.CanvasTexture | null = null;

export function glowTexture(): THREE.CanvasTexture {
  glowTex ??= new THREE.CanvasTexture(glowCanvas(128));
  return glowTex;
}
function beamTexture(): THREE.CanvasTexture {
  beamTex ??= new THREE.CanvasTexture(beamCanvas());
  return beamTex;
}
function causticTexture(): THREE.CanvasTexture {
  if (!causticTex) {
    causticTex = new THREE.CanvasTexture(causticCanvas());
    causticTex.wrapS = causticTex.wrapT = THREE.RepeatWrapping;
  }
  return causticTex;
}

export function glowSprite(color: number, scale: number, opacity = 0.8): THREE.Sprite {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
  s.scale.setScalar(scale);
  return s;
}

type DoorView = { p: Vec; group: 'doorA' | 'doorB'; panel: THREE.Mesh; open: number };
type HiddenView = { p: Vec; obj: THREE.Group; shown: boolean; outline: THREE.LineSegments };
type Fragment = { a: THREE.Vector3[]; c: THREE.Vector3; v: THREE.Vector3; axis: THREE.Vector3; spin: number };

/** One layer's paper diorama. Local origin = centre of the floor's top face. */
export class RoomView {
  readonly root = new THREE.Group();
  readonly board: Board;
  /** Hinged halves for the fold-open fall. */
  private pivots: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private halves: [THREE.Group, THREE.Group] = [new THREE.Group(), new THREE.Group()];
  private mats: Record<MatKind, THREE.Material>;
  private edgeMat: THREE.LineBasicMaterial;
  private doors: DoorView[] = [];
  private hidden: HiddenView[] = [];
  private keyObj: THREE.Group | null = null;
  private dropGlow: THREE.Sprite | null = null;
  private noteObj: THREE.Mesh | null = null;
  private petals: THREE.Group[] = [];
  private vaultCore: THREE.Group | null = null;
  private petalOpen = 0;
  private petalTarget = 0;
  private atmosphere = new THREE.Group();
  private sea: THREE.Mesh | null = null;
  private seaBase: Float32Array | null = null;
  private beam: THREE.Group | null = null;
  private pool: THREE.Mesh | null = null;
  private caustics: THREE.Mesh[] = [];
  private rings: THREE.Mesh[] = [];
  private shafts: THREE.Mesh[] = [];
  private foam: THREE.Mesh | null = null;
  private particles: THREE.Points | null = null;
  private pVel: Float32Array | null = null;
  private fragments: { mesh: THREE.Mesh; list: Fragment[]; t: number } | null = null;
  private readonly halfW: number;
  /** Ambient flicker the layer asks for (lamp room). */
  ambientPulse = 1;

  constructor(
    rows: readonly string[],
    readonly layer: number,
    readonly look: LayerLook
  ) {
    this.board = parseBoard(rows);
    this.halfW = this.board.w / 2 + 0.15;
    this.mats = roomMaterials(look.edge);
    this.edgeMat = new THREE.LineBasicMaterial({ color: look.edge, transparent: true, opacity: 0.75, toneMapped: false });
    this.pivots[0].position.set(-this.halfW, -SLAB, 0);
    this.halves[0].position.set(this.halfW, SLAB, 0);
    this.pivots[1].position.set(this.halfW, -SLAB, 0);
    this.halves[1].position.set(-this.halfW, SLAB, 0);
    this.pivots.forEach((p, i) => {
      const h = this.halves[i];
      if (h) p.add(h);
      this.root.add(p);
    });
    this.root.add(this.atmosphere);
    this.build();
  }

  /** Tile centre (top of floor) in room space. */
  tile(p: Vec): THREE.Vector3 {
    return new THREE.Vector3(p.x - (this.board.w - 1) / 2, TILE_TOP, p.y - (this.board.h - 1) / 2);
  }

  private side(x: number): 0 | 1 {
    return x <= (this.board.w - 1) / 2 ? 0 : 1;
  }

  private build(): void {
    const b = this.board;
    const L = this.layer;
    const look = this.look;
    const kits: [Kit, Kit] = [new Kit(), new Kit()];
    const solid = (q: Vec) => {
      const c = cellAt(b, q);
      return c === 'wall' || c === 'hidden';
    };
    const floorKind: MatKind = L === 1 ? 'solid' : 'shine';

    // Floor tiles with baked corner AO. The centre column is split so each half owns its own paper.
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const p = { x, y };
        const c = cellAt(b, p);
        const t = this.tile(p);
        const base = new THREE.Color(hash2(x, y, L + 3) < 0.5 ? look.floorB : look.floorA).multiplyScalar(0.86 + hash2(x, y, L) * 0.24);
        const pieces = x === (b.w - 1) / 2 ? ([[0, -0.235, 0.47], [1, 0.235, 0.47]] as const) : ([[this.side(x), 0, 0.94]] as const);
        for (const [side, dx, w] of pieces) {
          if (c === 'drop') continue;
          const geo = new THREE.BoxGeometry(w * 1.03, 0.14, 0.97).toNonIndexed();
          geo.rotateY((hash2(x, y, 21) - 0.5) * 0.05);
          geo.translate(t.x + dx, -0.07 + (hash2(x, y, 23) - 0.5) * 0.025, t.z);
          this.bakeFloor(geo, base, p, solid);
          kits[side].add(geo, 0xffffff, { kind: floorKind, ao: false });
        }
        if (c === 'wall') obstacle(L, { kit: kits[this.side(x)], x: t.x, z: t.z, r: hash2(x, y, 11 + L), look });
        if (c === 'drop') spiralStair(kits[this.side(x)], t.x, t.z, look);
        if (c === 'drop') {
          const g = glowSprite(look.edge, 1.7, 0.6);
          g.position.set(t.x, 0.15, t.z);
          this.halves[this.side(x)].add(g);
          this.dropGlow = g;
        }
        if (c === 'doorA' || c === 'doorB') this.addDoor(p, c, kits[this.side(x)]);
        if (c === 'hidden') this.addHidden(p);
        if (c === 'key') this.addKey(p);
        if (c === 'note') this.addNote(p);
        if (c === 'vault') this.addVault(p);
        this.floorDetail(kits[this.side(x)], p, c);
      }
    }

    this.addShell(kits);
    kits.forEach((k, i) => this.halves[i]?.add(k.build(this.mats)));
    this.addAtmosphere();
  }

  /** Corner AO and a soft moonlight gradient, written into the tile's vertex colours. */
  private bakeFloor(geo: THREE.BufferGeometry, base: THREE.Color, p: Vec, solid: (q: Vec) => boolean): void {
    const pos = geo.getAttribute('position');
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const cx = p.x - (this.board.w - 1) / 2;
    const cz = p.y - (this.board.h - 1) / 2;
    for (let i = 0; i < pos.count; i++) {
      const top = pos.getY(i) > -0.01;
      const sx = Math.sign(pos.getX(i) - cx) || 1;
      const sz = Math.sign(pos.getZ(i) - cz) || 1;
      let k = top ? 1 : 0.55;
      if (top) {
        let occ = 0;
        if (solid({ x: p.x + sx, y: p.y })) occ++;
        if (solid({ x: p.x, y: p.y + sz })) occ++;
        if (solid({ x: p.x + sx, y: p.y + sz })) occ += 0.6;
        if (p.y + sz < 0) occ += 0.8; // back wall
        k *= 1 - occ * 0.17;
        k *= 0.92 + 0.12 * (1 - (pos.getZ(i) + 3.5) / 7);
      }
      c.copy(base).multiplyScalar(k);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }

  /** Small per-layer floor details: puddles, shells, rivets. */
  private floorDetail(kit: Kit, p: Vec, c: Cell): void {
    if (c === 'wall' || c === 'hidden' || c === 'drop' || c === 'vault') return;
    const t = this.tile(p);
    const r = hash2(p.x, p.y, 40 + this.layer);
    if (this.layer === 0 && r < 0.3) {
      kit.add(new THREE.CircleGeometry(0.16 + r * 0.3, 9), 0x2c3658, { kind: 'shine', pos: [t.x + (r - 0.15), 0.006, t.z - (r - 0.15)], rot: [-Math.PI / 2, 0, 0], scale: [1.4, 1, 1], ao: false });
    }
    if (this.layer === 1 && r < 0.35) {
      kit.add(new THREE.ConeGeometry(0.07, 0.1, 5), 0xf0dcc8, { pos: [t.x + r - 0.2, 0.03, t.z + 0.2 - r], rot: [Math.PI / 2.4, r * 6, 0], ao: false });
    }
    if (this.layer === 2) {
      for (const [dx, dz] of [
        [-0.38, -0.38],
        [0.38, 0.38],
      ] as const) {
        kit.add(new THREE.CylinderGeometry(0.035, 0.035, 0.02, 6), 0x5a3a14, { pos: [t.x + dx, 0.01, t.z + dz], ao: false });
      }
    }
  }

  /** Slab with thickness, cut-away walls with windows and lanterns, glowing paper edges. */
  private addShell(kits: [Kit, Kit]): void {
    const d = this.board.h;
    const hw = this.halfW;
    const look = this.look;
    const wallCol = look.wall;
    const edges: [number[], number[]] = [[], []];
    const seg = (side: 0 | 1, a: [number, number, number], b: [number, number, number]) => edges[side].push(...a, ...b);

    for (const side of [0, 1] as const) {
      const sx = side === 0 ? -1 : 1;
      const kit = kits[side];
      // Slab half.
      kit.add(new THREE.BoxGeometry(hw, SLAB, d + 0.3), look.slab, { pos: [(sx * hw) / 2, -0.1 - SLAB / 2, 0], ao: false });
      // Paper underside, a shallow pyramid so the room floats.
      kit.add(new THREE.ConeGeometry(hw * 0.9, 1.6, 4, 1), look.slab, { pos: [(sx * hw) / 2, -0.1 - SLAB - 0.8, 0], rot: [Math.PI, Math.PI / 4, 0], scale: [0.75, 1, 1.05], ao: false });
      // Back wall half.
      kit.add(new THREE.BoxGeometry(hw, WALL_H, 0.3), wallCol, { pos: [(sx * hw) / 2, WALL_H / 2 - 0.1, -d / 2 - 0.15], tint: [look.tint, 0.15] });
      // Side wall: tall at the back, cut low at the front.
      kit.add(new THREE.BoxGeometry(0.3, WALL_H, d / 2), wallCol, { pos: [sx * (hw - 0.15), WALL_H / 2 - 0.1, -d / 4], tint: [look.tint, 0.15] });
      kit.add(new THREE.BoxGeometry(0.3, 0.32, d / 2 + 0.3), wallCol, { pos: [sx * (hw - 0.15), 0.06, d / 4 + 0.15], tint: [look.tint, 0.15] });
      // Windows / portholes / lens panes on the back wall, plus lanterns.
      for (let i = 0; i < 3; i++) {
        const x = sx * (0.6 + i * 1.05);
        if (this.layer === 1) {
          kit.add(new THREE.TorusGeometry(0.2, 0.05, 4, 12), 0xb8c8c0, { pos: [x, 0.62, -d / 2 + 0.01], kind: 'shine', ao: false });
          kit.add(new THREE.CircleGeometry(0.17, 12), look.edge, { pos: [x, 0.62, -d / 2 + 0.005], kind: 'glow', ao: false, tint: [look.skyBottom, 0.75] });
        } else {
          // A small arched window glowing with the night outside.
          kit.add(new THREE.PlaneGeometry(0.24, 0.34), look.skyBottom, { pos: [x, 0.55, -d / 2 + 0.006], kind: 'glow', ao: false, tint: [look.edge, 0.25] });
          kit.add(new THREE.CircleGeometry(0.12, 10, 0, Math.PI), look.skyBottom, { pos: [x, 0.72, -d / 2 + 0.006], kind: 'glow', ao: false, tint: [look.edge, 0.25] });
          seg(side, [x - 0.13, 0.37, -d / 2 + 0.03], [x - 0.13, 0.72, -d / 2 + 0.03]);
          seg(side, [x + 0.13, 0.37, -d / 2 + 0.03], [x + 0.13, 0.72, -d / 2 + 0.03]);
          seg(side, [x - 0.13, 0.37, -d / 2 + 0.03], [x + 0.13, 0.37, -d / 2 + 0.03]);
        }
        if (i === 1) wallLantern(kit, x + sx * 0.5, 0.75, -d / 2 + 0.08);
      }
      // Glowing paper edges.
      const top = -0.1;
      seg(side, [0, top, d / 2 + 0.15], [sx * hw, top, d / 2 + 0.15]);
      seg(side, [sx * hw, top, d / 2 + 0.15], [sx * hw, top, -d / 2 - 0.3]);
      seg(side, [0, WALL_H - 0.1, -d / 2 - 0.3], [sx * hw, WALL_H - 0.1, -d / 2 - 0.3]);
      seg(side, [0, WALL_H - 0.1, -d / 2], [sx * (hw - 0.3), WALL_H - 0.1, -d / 2]);
      seg(side, [sx * hw, WALL_H - 0.1, -d / 2 - 0.3], [sx * hw, WALL_H - 0.1, 0]);
      seg(side, [sx * hw, 0.22, 0], [sx * hw, 0.22, d / 2 + 0.15]);
      seg(side, [0, top - SLAB, d / 2 + 0.15], [sx * hw, top - SLAB, d / 2 + 0.15]);
    }
    edges.forEach((arr, i) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3));
      this.halves[i]?.add(new THREE.LineSegments(g, this.edgeMat));
    });
  }

  private addDoor(p: Vec, c: 'doorA' | 'doorB', kit: Kit): void {
    const t = this.tile(p);
    doorFrame(this.layer, kit, t.x, t.z, this.look);
    const panel = doorPanel(this.layer, this.look, this.look.edge);
    panel.position.set(t.x, 0.5, t.z);
    this.halves[this.side(p.x)]?.add(panel);
    this.doors.push({ p, group: c, panel, open: 1 });
  }

  private addHidden(p: Vec): void {
    const t = this.tile(p);
    const kit = new Kit();
    obstacle(this.layer, { kit, x: t.x, z: t.z, r: hash2(p.x, p.y, 11 + this.layer), look: this.look });
    const mats = roomMaterials(this.look.edge);
    Object.values(mats).forEach((m) => (m.transparent = true));
    const obj = kit.build(mats);
    const outline = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.9, 1.1, 0.9)), new THREE.LineBasicMaterial({ color: this.look.edge, transparent: true, opacity: 0, toneMapped: false }));
    outline.position.set(t.x, 0.55, t.z);
    this.halves[this.side(p.x)]?.add(obj, outline);
    this.hidden.push({ p, obj, shown: false, outline });
  }

  private addKey(p: Vec): void {
    const t = this.tile(p);
    const g = new THREE.Group();
    const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(0.16, 0), new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false }));
    g.add(orb, glowSprite(0xffd27a, 1.3, 0.85));
    g.position.set(t.x, 0.55, t.z);
    this.halves[this.side(p.x)]?.add(g);
    this.keyObj = g;
  }

  private addNote(p: Vec): void {
    const t = this.tile(p);
    const geo = new THREE.PlaneGeometry(0.38, 0.28, 2, 1);
    const pos = geo.getAttribute('position');
    pos.setZ(1, 0.06);
    pos.setZ(4, 0.06);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xefe6d2, emissive: 0x332a20, side: THREE.DoubleSide }));
    m.rotation.set(-Math.PI / 2, 0, 0.4);
    m.position.set(t.x, 0.03, t.z);
    this.halves[this.side(p.x)]?.add(m);
    this.noteObj = m;
  }

  private addVault(p: Vec): void {
    const t = this.tile(p);
    const g = new THREE.Group();
    g.position.set(t.x, 0, t.z);
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.16, 12), new THREE.MeshPhongMaterial({ color: 0x9a6a2a, shininess: 60, flatShading: true })));
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.bezierCurveTo(-0.2, 0.18, -0.16, 0.5, 0, 0.72);
    shape.bezierCurveTo(0.16, 0.5, 0.2, 0.18, 0, 0);
    const petalGeo = new THREE.ShapeGeometry(shape, 5);
    const col = petalGeo.getAttribute('position');
    const colors = new Float32Array(col.count * 3);
    const a = new THREE.Color(0x9a5a22);
    const b = new THREE.Color(0xfff1c9);
    for (let i = 0; i < col.count; i++) {
      const c = a.clone().lerp(b, col.getY(i) / 0.72);
      colors.set([c.r, c.g, c.b], i * 3);
    }
    petalGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const petalMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, emissive: 0x3a2008 });
    for (let i = 0; i < 6; i++) {
      const pivot = new THREE.Group();
      pivot.rotation.y = (i / 6) * Math.PI * 2;
      const hinge = new THREE.Group();
      hinge.position.z = 0.12;
      hinge.position.y = 0.08;
      const petal = new THREE.Mesh(petalGeo, petalMat);
      hinge.add(petal);
      pivot.add(hinge);
      g.add(pivot);
      this.petals.push(hinge);
    }
    const core = new THREE.Group();
    core.add(new THREE.Mesh(new THREE.IcosahedronGeometry(0.13, 1), new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false })), glowSprite(0xffd27a, 1.4, 0.7));
    core.position.y = 0.32;
    g.add(core);
    this.vaultCore = core;
    this.halves[this.side(p.x)]?.add(g);
    this.setPetals(0);
  }

  private setPetals(k: number): void {
    this.petals.forEach((h) => {
      h.rotation.x = THREE.MathUtils.lerp(-0.32, 1.25, k);
    });
  }

  /** Per-layer atmosphere: sea + lighthouse beam, underwater light, or the great lens. */
  private addAtmosphere(): void {
    const look = this.look;
    const L = this.layer;
    const d = this.board.h;
    if (L === 0) {
      const geo = new THREE.PlaneGeometry(70, 70, 34, 34);
      geo.rotateX(-Math.PI / 2);
      this.seaBase = Float32Array.from(geo.getAttribute('position').array);
      const seaCol = new THREE.Color(look.skyBottom).lerp(new THREE.Color(0x1a2048), 0.35).multiplyScalar(0.8);
      this.sea = new THREE.Mesh(geo, new THREE.MeshPhongMaterial({ color: seaCol, emissive: new THREE.Color(look.skyTop), shininess: 90, specular: 0x8a80c0, flatShading: true, transparent: true }));
      this.sea.position.y = -1.05;
      this.atmosphere.add(this.sea);
      const foamGeo = new THREE.RingGeometry(4.3, 5.2, 4, 1);
      foamGeo.rotateX(-Math.PI / 2);
      foamGeo.rotateY(Math.PI / 4);
      this.foam = new THREE.Mesh(foamGeo, new THREE.MeshBasicMaterial({ color: 0xdfe4ff, transparent: true, opacity: 0.25, depthWrite: false, toneMapped: false }));
      this.foam.scale.set(1.05, 1, 1.15);
      this.foam.position.y = -0.95;
      this.atmosphere.add(this.foam);
      this.addLighthouse();
    }
    if (L === 1) {
      for (const side of [0, 1] as const) {
        const m = new THREE.Mesh(
          new THREE.PlaneGeometry(this.halfW, d),
          new THREE.MeshBasicMaterial({ map: causticTexture().clone(), color: look.edge, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
        );
        m.rotation.x = -Math.PI / 2;
        m.position.set(((side === 0 ? -1 : 1) * this.halfW) / 2, 0.012, 0);
        const map = m.material.map;
        if (map) {
          map.wrapS = map.wrapT = THREE.RepeatWrapping;
          map.repeat.set(1.2, 2);
        }
        this.halves[side].add(m);
        this.caustics.push(m);
      }
      for (let i = 0; i < 4; i++) {
        const shaft = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 14),
          new THREE.MeshBasicMaterial({ map: beamTexture(), color: look.edge, transparent: true, opacity: 0.12, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
        );
        shaft.position.set(-3 + i * 2, 5, -1 + (i % 2) * 2);
        shaft.rotation.set(0, 0.3 * i, 0.25);
        this.atmosphere.add(shaft);
        this.shafts.push(shaft);
      }
    }
    if (L === 2) {
      for (const [r, o] of [
        [3.4, 0.5],
        [2.7, 0.35],
        [2.0, 0.6],
        [1.2, 0.45],
      ] as const) {
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(r, 0.06, 4, 48),
          new THREE.MeshBasicMaterial({ color: look.edge, transparent: true, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
        );
        ring.position.set(0, 2.2, -d / 2 - 2.4);
        this.atmosphere.add(ring);
        this.rings.push(ring);
      }
      const sun = glowSprite(0xffc66a, 7, 0.55);
      sun.position.set(0, 2.2, -d / 2 - 2.6);
      this.atmosphere.add(sun);
    }
    this.addParticles();
  }

  private addLighthouse(): void {
    const g = new THREE.Group();
    const kit = new Kit();
    kit.add(new THREE.DodecahedronGeometry(2.2, 0), 0x1a1628, { pos: [0, -0.6, 0], scale: [1.4, 0.7, 1.2], ao: false });
    for (let i = 0; i < 5; i++) {
      kit.add(new THREE.CylinderGeometry(0.62 - i * 0.06, 0.68 - i * 0.06, 1.3, 10), i % 2 ? 0x3a3450 : 0xb8b0d0, { pos: [0, 0.65 + i * 1.3, 0], ao: false });
    }
    kit.add(new THREE.CylinderGeometry(0.75, 0.75, 0.15, 12), 0x2a2438, { pos: [0, 7.15, 0], ao: false });
    kit.add(new THREE.CylinderGeometry(0.42, 0.42, 0.8, 10), 0xffe2a6, { pos: [0, 7.6, 0], kind: 'glow', ao: false });
    kit.add(new THREE.ConeGeometry(0.55, 0.6, 10), 0x2a2438, { pos: [0, 8.3, 0], ao: false });
    g.add(kit.build(this.mats));
    const lamp = glowSprite(0xffe2a6, 4, 0.9);
    lamp.position.y = 7.6;
    g.add(lamp);
    g.position.set(9.5, -1, -11);
    this.atmosphere.add(g);

    const beam = new THREE.Group();
    beam.position.set(9.5, 6.6, -11);
    const cone = new THREE.Mesh(
      new THREE.ConeGeometry(2.2, 18, 16, 1, true),
      new THREE.MeshBasicMaterial({ map: beamTexture(), color: 0xffe9c0, transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    );
    cone.rotation.z = Math.PI / 2;
    cone.position.x = -9;
    const tilt = new THREE.Group();
    tilt.rotation.z = 0.36;
    tilt.add(cone);
    beam.add(tilt);
    this.atmosphere.add(beam);
    this.beam = beam;

    this.pool = new THREE.Mesh(
      new THREE.CircleGeometry(1.4, 20),
      new THREE.MeshBasicMaterial({ map: glowTexture(), color: 0xffe2a6, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.scale.set(1.6, 1, 1);
    this.pool.position.y = 0.6;
    this.atmosphere.add(this.pool);
  }

  private addParticles(): void {
    const n = Math.round(particleCap() * (this.layer === 0 ? 0.6 : 0.45));
    const pos = new Float32Array(n * 3);
    this.pVel = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) this.respawn(pos, i, true);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const color = this.layer === 0 ? 0xcfd6ff : this.layer === 1 ? 0xd6fff8 : 0xffb35a;
    this.particles = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: glowTexture(), color, size: this.layer === 0 ? 0.07 : 0.12, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    this.atmosphere.add(this.particles);
  }

  private respawn(pos: Float32Array, i: number, anywhere: boolean): void {
    const v = this.pVel;
    if (!v) return;
    const x = (Math.random() - 0.5) * 14;
    const z = (Math.random() - 0.5) * 12;
    if (this.layer === 0) {
      pos.set([x, anywhere ? Math.random() * 8 - 1 : 7, z], i * 3);
      v.set([-0.8, -4.5 - Math.random() * 2, 0.3], i * 3);
    } else if (this.layer === 1) {
      pos.set([x, anywhere ? Math.random() * 7 - 2 : -2, z], i * 3);
      v.set([0, 0.5 + Math.random() * 0.7, 0], i * 3);
    } else {
      pos.set([x, anywhere ? Math.random() * 7 - 2 : -2, z], i * 3);
      v.set([(Math.random() - 0.5) * 0.3, 0.6 + Math.random() * 0.9, 0], i * 3);
    }
  }

  /** Keep doors, hidden obstacles and decorations in sync with the rules; animate the atmosphere. */
  update(state: LayerState | null, dt: number, t: number): void {
    const still = reducedMotion();
    if (state) {
      const warn = tideAboutToTurn(state);
      for (const d of this.doors) {
        const target = doorOpen(state, d.group) ? 1 : 0;
        d.open += (target - d.open) * Math.min(1, dt * 10);
        d.panel.position.y = 0.5 + d.open * 0.52;
        d.panel.scale.y = 1 - d.open * 0.82;
        const m = d.panel.material;
        if (m instanceof THREE.MeshLambertMaterial) m.emissiveIntensity = warn && !still ? 0.35 + 0.35 * Math.sin(t * 24) : 0.08;
      }
      const lit = lanternLit(state);
      for (const h of this.hidden) {
        const revealed = isRevealed(state, h.p);
        if (revealed && !h.shown) h.shown = true;
        const opacity = h.shown ? 0.22 : 1;
        h.obj.traverse((o) => {
          if (o instanceof THREE.Mesh && o.material instanceof THREE.Material) {
            o.material.opacity = opacity;
            o.material.depthWrite = !h.shown;
          }
        });
        const lm = h.outline.material;
        if (lm instanceof THREE.LineBasicMaterial) lm.opacity = h.shown ? 0.6 + 0.3 * Math.sin(t * 4) : lit ? 0.4 : 0;
      }
      if (this.keyObj) {
        this.keyObj.visible = !state.hasKey;
        this.keyObj.position.y = 0.55 + (still ? 0 : Math.sin(t * 2.4) * 0.08);
        this.keyObj.rotation.y = t;
      }
      if (this.noteObj && state.noteRead) {
        const m = this.noteObj.material;
        if (m instanceof THREE.MeshLambertMaterial) m.emissive.setHex(0x111111);
      }
    }
    if (this.dropGlow) this.dropGlow.material.opacity = 0.5 + 0.25 * Math.sin(t * 2);

    // Vault petals.
    if (this.petals.length) {
      this.petalOpen += (this.petalTarget - this.petalOpen) * Math.min(1, dt * 2.6);
      this.setPetals(this.petalOpen);
      if (this.vaultCore) this.vaultCore.rotation.y = t * 0.8;
    }

    if (this.sea && this.seaBase) {
      const p = this.sea.geometry.getAttribute('position');
      const base = this.seaBase;
      const amp = still ? 0.03 : 0.14;
      for (let i = 0; i < p.count; i++) {
        const x = base[i * 3] ?? 0;
        const z = base[i * 3 + 2] ?? 0;
        p.setY(i, Math.sin(x * 0.55 + t * 1.3) * amp + Math.cos(z * 0.7 + t * 1.1) * amp * 0.8);
      }
      p.needsUpdate = true;
    }
    if (this.foam) {
      const m = this.foam.material;
      if (m instanceof THREE.MeshBasicMaterial) m.opacity = 0.16 + 0.14 * Math.sin(t * 1.3);
      this.foam.scale.setScalar(1 + 0.03 * Math.sin(t * 1.3));
    }
    if (this.beam && this.pool) {
      const a = still ? 0.6 : t * 0.45;
      this.beam.rotation.y = a;
      // Where the beam crosses the board: pick the point on its path nearest the centre.
      const dir = new THREE.Vector3(-Math.cos(a), 0, Math.sin(a));
      const origin = new THREE.Vector3(9.5, 0, -11);
      const s = -origin.dot(dir);
      const hit = origin.clone().addScaledVector(dir, s);
      const facing = s > 0 ? 1 : 0;
      const inside = Math.max(0, 1 - Math.max(Math.abs(hit.x), Math.abs(hit.z)) / 4.2);
      this.pool.position.set(hit.x, 0.05, hit.z);
      this.pool.rotation.z = -a;
      const pm = this.pool.material;
      if (pm instanceof THREE.MeshBasicMaterial) pm.opacity = 0.55 * inside * facing;
    }
    for (const c of this.caustics) {
      const map = c.material instanceof THREE.MeshBasicMaterial ? c.material.map : null;
      if (map && !still) {
        map.offset.x = Math.sin(t * 0.3) * 0.2;
        map.offset.y = t * 0.04;
      }
    }
    this.shafts.forEach((s, i) => {
      if (!still) s.rotation.z = 0.25 + Math.sin(t * 0.4 + i) * 0.08;
    });
    this.rings.forEach((r, i) => {
      if (!still) r.rotation.z = t * (0.1 + i * 0.05) * (i % 2 ? -1 : 1);
    });
    if (this.layer === 2) this.ambientPulse = still ? 1 : 1 + 0.08 * Math.sin(t * 9) * Math.sin(t * 2.3);

    if (this.particles && this.pVel && !still) {
      const p = this.particles.geometry.getAttribute('position');
      const arr = p.array;
      if (arr instanceof Float32Array) {
        const v = this.pVel;
        for (let i = 0; i < p.count; i++) {
          arr[i * 3] = (arr[i * 3] ?? 0) + (v[i * 3] ?? 0) * dt + (this.layer === 1 ? Math.sin(t * 2 + i) * 0.004 : 0);
          arr[i * 3 + 1] = (arr[i * 3 + 1] ?? 0) + (v[i * 3 + 1] ?? 0) * dt;
          arr[i * 3 + 2] = (arr[i * 3 + 2] ?? 0) + (v[i * 3 + 2] ?? 0) * dt;
          const y = arr[i * 3 + 1] ?? 0;
          if ((this.layer === 0 && y < -1) || (this.layer > 0 && y > 6)) this.respawn(arr, i, false);
        }
        p.needsUpdate = true;
      }
    }
    this.updateFragments(dt);
  }

  openVault(): void {
    this.petalTarget = 1;
  }

  vaultCoreWorld(): THREE.Vector3 | null {
    return this.vaultCore ? this.vaultCore.getWorldPosition(new THREE.Vector3()) : null;
  }

  hideVaultCore(): void {
    if (this.vaultCore) this.vaultCore.visible = false;
  }

  /** Fade the sea away so the next layer shows through the opening floor. */
  fadeSea(k: number): void {
    for (const o of [this.sea, this.foam]) {
      if (!o) continue;
      const m = o.material;
      if (m instanceof THREE.Material) m.opacity = (o === this.foam ? 0.25 : 1) * (1 - k);
      o.visible = k < 1;
    }
  }

  /** Fold-open: both floor halves hinge down from the centre line (k: 0..1). */
  setFold(k: number): void {
    const a = k * 1.95;
    this.pivots[0].rotation.z = -a;
    this.pivots[1].rotation.z = a;
  }

  // ---------------------------------------------------------------- wake: glowing paper fragments

  /** Break the floor into glowing paper fragments that drift upward. */
  shatter(): void {
    const tris: number[] = [];
    const colors: number[] = [];
    const list: Fragment[] = [];
    const glow = new THREE.Color(this.look.edge);
    for (let y = 0; y < this.board.h; y++) {
      for (let x = 0; x < this.board.w; x++) {
        const t = this.tile({ x, y });
        const base = new THREE.Color(this.look.floorA).lerp(glow, 0.55 + hash2(x, y, 5) * 0.35);
        const corners = [
          new THREE.Vector3(t.x - 0.47, 0, t.z - 0.47),
          new THREE.Vector3(t.x + 0.47, 0, t.z - 0.47),
          new THREE.Vector3(t.x + 0.47, 0, t.z + 0.47),
          new THREE.Vector3(t.x - 0.47, 0, t.z + 0.47),
        ];
        const diag = hash2(x, y, 9) < 0.5;
        const triIdx = diag ? [[0, 1, 2], [0, 2, 3]] : [[0, 1, 3], [1, 2, 3]];
        for (const idx of triIdx) {
          const a = idx.map((i) => corners[i]?.clone() ?? new THREE.Vector3());
          const c = a.reduce((s, v) => s.add(v), new THREE.Vector3()).multiplyScalar(1 / 3);
          list.push({
            a: a.map((v) => v.clone().sub(c)),
            c,
            v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 1.2 + Math.random() * 2.2 + (3.5 - Math.abs(c.x)) * 0.15, (Math.random() - 0.5) * 0.8),
            axis: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize(),
            spin: (Math.random() - 0.5) * 6,
          });
          for (let k = 0; k < 3; k++) {
            tris.push(0, 0, 0);
            colors.push(base.r, base.g, base.b);
          }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const sparkGeo = new THREE.BufferGeometry();
    sparkGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(list.length * 3), 3));
    const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ map: glowTexture(), color: this.look.edge, size: 0.55, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    mesh.add(sparks);
    // Hide the real room (but keep the atmosphere), show fragments in its place.
    this.pivots.forEach((p) => (p.visible = false));
    this.root.add(mesh);
    this.fragments = { mesh, list, t: 0 };
    this.updateFragments(0);
  }

  private updateFragments(dt: number): void {
    const f = this.fragments;
    if (!f) return;
    f.t += dt;
    const pos = f.mesh.geometry.getAttribute('position');
    const q = new THREE.Quaternion();
    const delay = (c: THREE.Vector3) => Math.max(0, (c.z + 3.5) * 0.04 + Math.abs(c.x) * 0.02);
    f.list.forEach((fr, i) => {
      const life = Math.max(0, f.t - delay(fr.c));
      const p = fr.c.clone().addScaledVector(fr.v, life).add(new THREE.Vector3(0, 0.6 * life * life, 0));
      q.setFromAxisAngle(fr.axis, fr.spin * life);
      fr.a.forEach((v, k) => {
        const w = v.clone().applyQuaternion(q).multiplyScalar(1 - Math.min(0.5, life * 0.2)).add(p);
        pos.setXYZ(i * 3 + k, w.x, w.y, w.z);
      });
    });
    pos.needsUpdate = true;
    const fade = Math.max(0, 1 - Math.max(0, f.t - 0.9) / 1.3);
    const m = f.mesh.material;
    if (m instanceof THREE.MeshBasicMaterial) m.opacity = fade;
    const sparks = f.mesh.children[0];
    if (sparks instanceof THREE.Points) {
      const sp = sparks.geometry.getAttribute('position');
      f.list.forEach((fr, i) => {
        const life = Math.max(0, f.t - delay(fr.c));
        sp.setXYZ(i, fr.c.x + fr.v.x * life, fr.c.y + fr.v.y * life + 0.6 * life * life, fr.c.z + fr.v.z * life);
      });
      sp.needsUpdate = true;
      if (sparks.material instanceof THREE.PointsMaterial) sparks.material.opacity = 0.9 * fade;
    }
  }

  dispose(): void {
    this.root.removeFromParent();
    this.root.traverse((o) => {
      if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments || o instanceof THREE.Points) {
        o.geometry.dispose();
      }
    });
    Object.values(this.mats).forEach((m) => m.dispose());
  }
}

