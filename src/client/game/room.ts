import * as Phaser from 'phaser';
import type { GameObjects, Scene } from 'phaser';
import { cellAt, keyOf, parseBoard, type Board } from '../../shared/logic/board.ts';
import { doorOpen, isRevealed, lanternLit, tideAboutToTurn, type LayerState } from '../../shared/logic/layer.ts';
import type { Vec } from '../../shared/logic/types.ts';
import { PALETTES, SLAB_H, TILE_D, TILE_W, WALL_H } from '../core/palette.ts';
import { settings } from '../core/settings.ts';

type DoorView = { img: GameObjects.Image; p: Vec; group: 'doorA' | 'doorB'; open: boolean };
type HiddenView = { img: GameObjects.Image; p: Vec; shown: boolean };

const ROW = 100;
export const Z = { floor: 0, mark: 20, wall: 60, actor: 70 } as const;

/** One paper diorama room, rendered from a board. Local origin is the centre of the floor. */
export class RoomView {
  readonly root: GameObjects.Container;
  board: Board;
  private doors: DoorView[] = [];
  private blocks = new Map<string, GameObjects.Image>();
  private xray: GameObjects.Image[] = [];
  private hidden: HiddenView[] = [];
  private markers: GameObjects.GameObject[] = [];
  vaultPetals: GameObjects.Image[] = [];
  vaultCore: GameObjects.Image | null = null;
  keyOrb: GameObjects.Image | null = null;
  noteImg: GameObjects.Image | null = null;
  dropGlow: GameObjects.Image | null = null;

  constructor(
    private scene: Scene,
    rows: readonly string[],
    public layer: number
  ) {
    this.board = parseBoard(rows);
    this.root = scene.add.container(0, 0);
    this.build();
  }

  get pixelW(): number {
    return this.board.w * TILE_W;
  }
  get pixelH(): number {
    return this.board.h * TILE_D;
  }
  /** Full drawn height including raised walls and the slab. */
  get outerH(): number {
    return this.pixelH + WALL_H + SLAB_H;
  }

  /** Centre of a tile's top face, in room-local coordinates. */
  tileCenter(p: Vec): Vec {
    return { x: (p.x + 0.5) * TILE_W - this.pixelW / 2, y: (p.y + 0.5) * TILE_D - this.pixelH / 2 };
  }

  private corner(p: Vec): Vec {
    return { x: p.x * TILE_W - this.pixelW / 2, y: p.y * TILE_D - this.pixelH / 2 };
  }

  private put<T extends GameObjects.GameObject & GameObjects.Components.Depth>(obj: T, row: number, z: number): T {
    obj.setDepth(row * ROW + z);
    obj.setData('row', row);
    this.root.add(obj);
    return obj;
  }

  private build(): void {
    const L = this.layer;
    const b = this.board;
    const s = this.scene;

    // Soft shadow under the floating slab.
    const shadow = s.add.image(0, this.pixelH / 2 + SLAB_H + 26, 'shadow').setDisplaySize(this.pixelW * 1.15, 60).setAlpha(0.7);
    this.put(shadow, -2, 0);

    // Cut-away back wall behind the first row.
    for (let x = 0; x < b.w; x++) {
      const k = this.corner({ x, y: 0 });
      this.put(s.add.image(k.x, k.y - WALL_H - 16, `backwall-${L}`).setOrigin(0), -1, 1);
    }

    const solid = (q: Vec) => {
      const cc = cellAt(b, q);
      return cc === 'wall' || cc === 'hidden';
    };
    for (let y = 0; y < b.h; y++) {
      for (let x = 0; x < b.w; x++) {
        const p = { x, y };
        const c = cellAt(b, p);
        const k = this.corner(p);
        const center = this.tileCenter(p);
        this.put(s.add.image(k.x, k.y, `floor-${L}-${(x + y) % 2}`).setOrigin(0), y, Z.floor);
        if (!solid(p)) {
          if (y === 0 || solid({ x, y: y - 1 })) this.put(s.add.image(k.x, k.y, 'ao-s').setOrigin(0), y, Z.floor + 1);
          if (x > 0 && solid({ x: x - 1, y })) this.put(s.add.image(k.x, k.y, 'ao-e').setOrigin(0), y, Z.floor + 1);
        }

        if (c === 'wall') {
          this.blocks.set(keyOf(p), this.put(s.add.image(k.x, k.y - WALL_H, `wall-${L}`).setOrigin(0), y, Z.wall));
        } else if (c === 'hidden') {
          const img = this.put(s.add.image(k.x, k.y - WALL_H, `wall-${L}`).setOrigin(0), y, Z.wall);
          this.blocks.set(keyOf(p), img);
          this.hidden.push({ img, p, shown: false });
        } else if (c === 'doorA' || c === 'doorB') {
          const img = this.put(s.add.image(k.x, k.y - WALL_H, `door-open-${L}`).setOrigin(0), y, Z.wall);
          this.blocks.set(keyOf(p), img);
          this.doors.push({ img, p, group: c, open: true });
        } else if (c === 'drop') {
          this.put(s.add.image(k.x, k.y, `drop-${L}`).setOrigin(0), y, Z.mark);
          const g = this.put(
            s.add.image(center.x, center.y, 'glow').setScale(0.7, 0.4).setTint(PALETTES[L]?.glowHex ?? 0xffffff).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.7),
            y,
            Z.mark + 1
          );
          this.dropGlow = g;
          if (!settings.reducedMotion) s.tweens.add({ targets: g, alpha: 0.35, scaleX: 0.85, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (c === 'key') {
          const glow = this.put(s.add.image(center.x, center.y - 18, 'glow').setScale(0.5).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD), y, Z.actor - 1);
          const orb = this.put(s.add.image(center.x, center.y - 18, 'orb').setScale(0.9), y, Z.actor - 1);
          this.keyOrb = orb;
          this.markers.push(glow);
          if (!settings.reducedMotion) s.tweens.add({ targets: [orb, glow], y: center.y - 24, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
        } else if (c === 'note') {
          this.noteImg = this.put(s.add.image(center.x, center.y - 2, 'note').setAngle(-8), y, Z.mark);
        } else if (c === 'vault') {
          this.buildVault(center, y);
        }
      }
    }

    // The slab's paper thickness along the front edge.
    for (let x = 0; x < b.w; x++) {
      const k = this.corner({ x, y: b.h });
      this.put(s.add.image(k.x, k.y, `slab-${L}`).setOrigin(0), b.h, 0);
    }
    this.root.sort('depth');
  }

  private buildVault(center: Vec, row: number): void {
    const s = this.scene;
    const base = s.add.image(center.x, center.y, 'glow').setScale(0.9, 0.5).setTint(0xffd27a).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0.6);
    this.put(base, row, Z.mark);
    for (let i = 0; i < 6; i++) {
      const petal = s.add.image(center.x, center.y + 4, 'petal').setOrigin(0.5, 1).setScale(0.62);
      petal.setAngle((i - 2.5) * 9);
      this.vaultPetals.push(this.put(petal, row, Z.actor - 2 + (i % 2)));
    }
    this.vaultCore = this.put(s.add.image(center.x, center.y - 14, 'orb').setScale(0.5).setAlpha(0.6), row, Z.actor - 3);
  }

  /** Keep doors, hidden walls and the lantern reveal in sync with the rules. */
  sync(state: LayerState, time: number): void {
    const L = this.layer;
    const warn = tideAboutToTurn(state);
    for (const d of this.doors) {
      const open = doorOpen(state, d.group);
      if (open !== d.open) {
        d.open = open;
        d.img.setTexture(open ? `door-open-${L}` : `door-closed-${L}`);
      }
      d.img.setAlpha(warn && !settings.reducedMotion ? 0.55 + 0.45 * Math.sin(time * 0.04) : 1);
    }
    const lit = lanternLit(state);
    for (const h of this.hidden) {
      const revealed = isRevealed(state, h.p);
      if (revealed && !h.shown) {
        h.shown = true;
        h.img.setTexture(`door-open-${L}`);
        this.flash(h.p);
      }
      if (!revealed) h.img.setAlpha(lit ? 0.6 : 1);
    }
  }

  /** Brief bright pulse on a tile (door revealed, ability used). */
  flash(p: Vec): void {
    const c = this.tileCenter(p);
    const g = this.scene.add.image(c.x, c.y - 10, 'glow').setBlendMode(Phaser.BlendModes.ADD).setTint(PALETTES[this.layer]?.glowHex ?? 0xffffff).setScale(0.4);
    this.put(g, p.y, Z.actor + 5);
    this.scene.tweens.add({ targets: g, scale: 1.4, alpha: 0, duration: 600, onComplete: () => g.destroy() });
  }

  /** A ring that spreads from the Diver's feet. */
  ripple(p: Vec): void {
    if (settings.reducedMotion) return;
    const c = this.tileCenter(p);
    const r = this.scene.add.image(c.x, c.y + 6, 'ripple').setScale(0.3).setAlpha(0.5).setTint(PALETTES[this.layer]?.glowHex ?? 0xffffff);
    this.put(r, p.y, Z.mark + 2);
    this.scene.tweens.add({ targets: r, scale: 0.9, alpha: 0, duration: 520, ease: 'Quad.easeOut', onComplete: () => r.destroy() });
  }

  addActor(obj: GameObjects.GameObject & GameObjects.Components.Depth, row: number, z: number = Z.actor): void {
    this.put(obj, row, z);
  }

  setActorRow(obj: GameObjects.GameObject & GameObjects.Components.Depth, row: number, z: number = Z.actor): void {
    obj.setDepth(row * ROW + z);
    obj.setData('row', row);
    this.root.sort('depth');
  }

  /** Blocks in the row in front of the Diver turn see-through so the Diver is never lost behind them. */
  setXray(positions: readonly Vec[]): void {
    const want = new Set<GameObjects.Image>();
    for (const p of positions) {
      for (const dx of [-1, 0, 1]) {
        const img = this.blocks.get(keyOf({ x: p.x + dx, y: p.y + 1 }));
        if (img) want.add(img);
      }
    }
    for (const img of this.xray) if (!want.has(img)) img.setAlpha(1);
    want.forEach((img) => img.setAlpha(0.45));
    this.xray = [...want];
  }

  hasHiddenAt(p: Vec): boolean {
    return this.hidden.some((h) => keyOf(h.p) === keyOf(p));
  }

  /**
   * Paper fold: the back half of the room folds down over the front half along the middle row.
   * `progress` 0 = flat, 1 = fully folded. Returns the fold container for the caller to animate.
   */
  makeFold(): { top: GameObjects.Container; back: GameObjects.Rectangle; foldY: number; restore: () => void } {
    const half = Math.floor(this.board.h / 2);
    const foldY = half * TILE_D - this.pixelH / 2;
    const top = this.scene.add.container(0, foldY);
    const moved: GameObjects.GameObject[] = [];
    for (const child of [...this.root.list]) {
      const row = Number(child.getData('row'));
      if (row >= -1 && row < half) moved.push(child);
    }
    for (const child of moved) {
      this.root.remove(child);
      if ('y' in child && typeof child.y === 'number') child.y -= foldY;
      top.add(child);
    }
    const backH = foldY + this.pixelH / 2 + WALL_H + 16;
    const back = this.scene.add
      .rectangle(0, -backH / 2, this.pixelW, backH, Phaser.Display.Color.HexStringToColor(PALETTES[this.layer]?.wallFront ?? '#444444').color)
      .setAlpha(0)
      .setStrokeStyle(2, Phaser.Display.Color.HexStringToColor(PALETTES[this.layer]?.edge ?? '#ffffff').color, 0.7);
    top.add(back);
    this.root.add(top);
    top.setDepth(half * ROW - 1 + 10_000);
    this.root.sort('depth');
    const restore = () => {
      back.destroy();
      for (const child of [...top.list]) {
        top.remove(child);
        if ('y' in child && typeof child.y === 'number') child.y += foldY;
        this.root.add(child);
      }
      top.destroy();
      this.root.sort('depth');
    };
    return { top, back, foldY, restore };
  }

  destroy(): void {
    this.root.destroy();
  }
}
