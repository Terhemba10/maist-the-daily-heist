import * as THREE from 'three';
import type { Difficulty } from '../../shared/logic/difficulty.ts';
import { applyDifficulty, MOVE_SLACK } from '../../shared/logic/difficulty.ts';
import { mirrorRows } from '../../shared/logic/board.ts';
import {
  createLayer,
  echoPositions,
  LANTERN_MS,
  move,
  pullFraction,
  stillActive,
  tick,
  timeLeftMs,
  useAbility,
  type LayerState,
  type MoveEvent,
} from '../../shared/logic/layer.ts';
import { playStyle, type LayerResult } from '../../shared/logic/score.ts';
import type { AbilityId, Dir, DreamDef } from '../../shared/logic/types.ts';
import { audio } from '../core/audio.ts';
import { theme, type LayerLook } from '../core/palette.ts';
import { buzz, reducedMotion, settings } from '../core/settings.ts';
import { hasKey, t, type StringKey } from '../i18n/index.ts';
import { Diver, Echo } from '../three/diver.ts';
import { glowSprite, glowTexture, RoomView } from '../three/room3d.ts';
import type { World } from '../three/world.ts';
import { toast } from '../ui/dom.ts';
import type { Hud } from '../ui/hud.ts';

type Anim = { t: number; dur: number; step: (k: number) => void; done?: () => void };

export type DreamEvents = {
  onCard: (results: LayerResult[], quoteKey: StringKey) => void;
  onResults: (results: LayerResult[]) => void;
};

const FALL_DEPTH = 11;
const ease = (k: number) => (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2);
const k_ = (key: string): StringKey => (hasKey(key) ? key : 'app.name');

/** Runs one dream: rules, 3D room, Diver, echoes, transitions. UI lives in the HUD and screens. */
export class DreamRun {
  readonly dream: DreamDef;
  private layerIndex = 0;
  state!: LayerState;
  private room!: RoomView;
  private diver = new Diver();
  private echoes: Echo[] = [];
  private results: LayerResult[] = [];
  private anims: Anim[] = [];
  busy = false;
  paused = false;
  private lastBeat = 0;
  private off: () => void;
  private time = 0;

  constructor(
    base: DreamDef,
    private ability: AbilityId,
    readonly difficulty: Difficulty,
    private world: World,
    private hud: Hud,
    private events: DreamEvents,
    startLayer = 0
  ) {
    this.dream = applyDifficulty(base, difficulty);
    this.off = world.onFrame((dt, time) => this.frame(dt, time));
    this.startLayer(startLayer, null);
  }

  private look(i: number): LayerLook {
    const th = theme(settings.theme);
    return th.layers[i] ?? th.layers[0];
  }

  private def(i: number) {
    const d = this.dream.layers[i];
    if (!d) throw new Error(`layer ${i}`);
    return d;
  }

  private startLayer(i: number, prebuilt: RoomView | null): void {
    this.layerIndex = i;
    const def = this.def(i);
    this.state = createLayer(def, this.ability);
    const room = prebuilt ?? this.makeRoom(i);
    this.setRoom(room);
    this.world.setLook(this.look(i), this.look(i), 1);
    audio.playMusic(i);
    this.hud.setLayer(t(k_(`layer.name.${i + 1}`)));
    this.hud.setKey(false);
    this.hud.setCharge(this.state.charges);
    const announce = () => toast(t(k_(`twist.${def.twist}`)), 92, 2600);
    if (def.twist === 'mirror') {
      this.busy = true;
      this.pageTurn(() => {
        this.busy = false;
        announce();
      });
    } else {
      announce();
    }
  }

  private makeRoom(i: number): RoomView {
    const def = this.def(i);
    // The mirror layer arrives as the un-mirrored page, then turns.
    const rows = def.twist === 'mirror' ? mirrorRows(def.rows) : def.rows;
    return new RoomView(rows, i, this.look(i));
  }

  private setRoom(room: RoomView): void {
    this.room = room;
    if (!room.root.parent) this.world.scene.add(room.root);
    room.root.add(this.diver.root);
    this.diver.root.position.copy(room.tile(this.state.pos));
    this.diver.root.scale.setScalar(1);
    this.diver.root.visible = true;
    this.echoes.forEach((e) => e.dispose());
    const glow = this.look(this.layerIndex).edge;
    this.echoes = (this.state.def.echoDelaysMs ?? []).map(() => new Echo(glow, room.root));
  }

  refreshCosmetics(): void {
    this.diver.applyCosmetics();
  }

  /** Rebuild the room in place (theme change). */
  refreshLook(): void {
    if (this.busy) return;
    const old = this.room;
    const rows = this.state.def.rows;
    const room = new RoomView(rows, this.layerIndex, this.look(this.layerIndex));
    this.world.scene.add(room.root);
    old.dispose();
    this.room = room;
    room.root.add(this.diver.root);
    this.diver.root.position.copy(room.tile(this.state.pos));
    this.echoes.forEach((e) => e.dispose());
    this.echoes = (this.state.def.echoDelaysMs ?? []).map(() => new Echo(this.look(this.layerIndex).edge, room.root));
    this.world.setLook(this.look(this.layerIndex), this.look(this.layerIndex), 1);
    this.diver.applyCosmetics();
  }

  // ---------------------------------------------------------------- input

  input(dir: Dir): void {
    if (this.busy || this.paused || this.state.status !== 'playing') return;
    const ev = move(this.state, dir);
    this.react(ev);
  }

  useAbility(): void {
    if (this.busy || this.paused || this.state.status !== 'playing') return;
    const r = useAbility(this.state);
    if (r === 'no-charge') {
      audio.bump();
      toast(t('ability.empty'), '78%', 1200);
      return;
    }
    if (r !== 'used') return;
    audio.ability();
    buzz(15);
    this.hud.setCharge(this.state.charges);
    toast(t('ability.used', { ability: t(k_(`ability.${this.ability}`)) }), '78%', 900);
    if (this.ability === 'lantern') this.diver.flare(LANTERN_MS / 1000);
  }

  private react(ev: MoveEvent): void {
    const s = this.state;
    if (ev === 'blocked' || ev === 'vault-locked') {
      audio.bump();
      buzz(18);
      if (ev === 'vault-locked') toast(t('event.blocked.vault'));
      return;
    }
    if (ev === 'ignored') return;
    audio.step();
    this.diver.step();
    if (ev === 'blink') this.diver.root.visible = false;
    window.setTimeout(() => (this.diver.root.visible = true), ev === 'blink' ? 140 : 0);
    if (ev === 'key') {
      audio.key();
      buzz(20);
      toast(t('event.key'));
      this.hud.setKey(true);
    }
    if (ev === 'note') toast(t(k_(`dreamer.${this.dream.dreamer}.note`)), '24%', 4200);
    if (ev === 'caught') this.onCaught();
    if (ev === 'drop') this.fall();
    if (ev === 'vault') this.openVault();
    void s;
  }

  private onCaught(): void {
    audio.caught();
    buzz(40);
    toast(t('event.caught'), '30%');
  }

  // ---------------------------------------------------------------- frame

  private frame(dt: number, time: number): void {
    this.time = time;
    const current = [...this.anims];
    const finished = new Set<Anim>();
    for (const a of current) {
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.step(k);
      if (k >= 1) finished.add(a);
    }
    // Remove first, then run callbacks, so anims they queue are kept.
    this.anims = this.anims.filter((a) => !finished.has(a));
    finished.forEach((a) => a.done?.());
    const s = this.state;
    if (!this.paused && !this.busy && s.status === 'playing') {
      const ev = tick(s, dt * 1000);
      if (ev === 'caught') this.onCaught();
      if (ev === 'woke') {
        this.recordResult(false);
        this.wake();
      }
    }
    this.room.update(s, dt, time);
    this.world.hemi.intensity = 0.8 * this.room.ambientPulse;

    // Diver glides to its tile.
    if (this.diver.root.parent === this.room.root && !this.busy) {
      const target = this.room.tile(s.pos);
      this.diver.root.position.lerp(target, Math.min(1, dt * (reducedMotion() ? 60 : 16)));
    }
    this.diver.update(dt, time);
    const pos = echoPositions(s);
    const frozen = stillActive(s);
    this.echoes.forEach((e, i) => {
      const p = pos[i];
      e.setFrozen(frozen);
      e.moveTo(p && !this.busy ? this.room.tile(p) : null, dt);
    });

    // Camera leans gently toward the Diver.
    const d = this.diver.root.position;
    this.world.follow.lerp(new THREE.Vector3(d.x * 0.16, 0, d.z * 0.1), Math.min(1, dt * 2));

    const frac = pullFraction(s);
    this.hud.setPull(frac, timeLeftMs(s) / 1000, time);
    this.hud.setMoves(s.moves);
    if (frac < 0.3 && s.status === 'playing' && !this.paused && !this.busy) {
      const period = 0.38 + 0.9 * (frac / 0.3);
      if (time - this.lastBeat > period) {
        this.lastBeat = time;
        audio.heartbeat();
      }
    }
  }

  private animate(dur: number, step: (k: number) => void, done?: () => void, delay = 0): void {
    if (delay > 0) {
      this.anims.push({ t: 0, dur: delay, step: () => undefined, done: () => this.animate(dur, step, done) });
      return;
    }
    const a: Anim = { t: 0, dur, step };
    if (done) a.done = done;
    this.anims.push(a);
  }

  // ---------------------------------------------------------------- transitions

  private recordResult(cleared: boolean): void {
    const s = this.state;
    this.results.push({ cleared, timeLeftMs: timeLeftMs(s), pullMs: s.def.pullMs, moves: s.moves, par: s.def.par, caught: s.caught });
  }

  /** The floor folds open like paper and the camera drops through to the next layer. */
  private fall(): void {
    this.busy = true;
    this.recordResult(true);
    audio.drop();
    buzz(25);
    const next = this.layerIndex + 1;
    const old = this.room;
    const fromLook = this.look(this.layerIndex);
    const toLook = this.look(next);
    const nextRoom = this.makeRoom(next);
    nextRoom.root.position.y = -FALL_DEPTH;
    this.world.scene.add(nextRoom.root);
    this.echoes.forEach((e) => e.moveTo(null, 0));

    if (reducedMotion()) {
      this.fadeSwap(() => {
        old.dispose();
        nextRoom.root.position.y = 0;
        this.startLayer(next, nextRoom);
        this.busy = this.def(next).twist === 'mirror';
      });
      return;
    }

    const diverStart = this.diver.root.position.clone();
    // 0–0.4 s: the Diver steps down the spiral and is gone.
    this.animate(0.4, (k) => {
      this.diver.root.position.y = diverStart.y - k * 0.8;
      this.diver.root.rotation.y = k * 3;
      this.diver.root.scale.setScalar(1 - k * 0.7);
    });
    // 0.2–0.9 s: the floor halves hinge open.
    this.animate(
      0.7,
      (k) => {
        old.setFold(ease(k));
        old.fadeSea(Math.min(1, k * 2));
      },
      undefined,
      0.2
    );
    this.rush();
    // 0.6–1.7 s: the camera dives through the opening while sky, fog and light shift.
    this.animate(
      1.3,
      (k) => {
        const e = ease(k);
        this.world.target.y = -FALL_DEPTH * e;
        this.world.setLook(fromLook, toLook, e);
      },
      () => {
        old.dispose();
        this.world.target.y = 0;
        nextRoom.root.position.y = 0;
        this.diver.root.rotation.y = 0;
        this.startLayer(next, nextRoom);
        if (this.def(next).twist !== 'mirror') {
          this.diver.root.scale.setScalar(0.3);
          this.animate(0.3, (k) => this.diver.root.scale.setScalar(0.3 + 0.7 * k), () => (this.busy = false));
        }
      },
      0.6
    );
  }

  /** Light streaks rushing upward past the camera during a fall. */
  private rush(): void {
    const n = settings.quality === 'low' ? 60 : 160;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) pos.set([(Math.random() - 0.5) * 9, -Math.random() * FALL_DEPTH * 1.3, (Math.random() - 0.5) * 8], i * 3);
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(
      geo,
      new THREE.PointsMaterial({ map: glowTexture(), color: this.look(this.layerIndex + 1).edge, size: 0.16, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })
    );
    this.world.scene.add(pts);
    this.animate(
      1.7,
      (k) => {
        const a = geo.getAttribute('position');
        for (let i = 0; i < a.count; i++) a.setY(i, a.getY(i) + 0.35);
        a.needsUpdate = true;
        pts.material.opacity = Math.sin(k * Math.PI) * 0.9;
      },
      () => {
        pts.removeFromParent();
        geo.dispose();
      },
      0.35
    );
  }

  private fadeSwap(mid: () => void): void {
    const fade = document.querySelector('.fade');
    if (!(fade instanceof HTMLElement)) return mid();
    fade.style.opacity = '1';
    window.setTimeout(() => {
      mid();
      fade.style.opacity = '0';
    }, 320);
  }

  /** Mirror twist: the room turns like a book page and comes back mirrored. */
  private pageTurn(done: () => void): void {
    const swap = () => {
      const old = this.room;
      const room = new RoomView(this.state.def.rows, this.layerIndex, this.look(this.layerIndex));
      this.world.scene.add(room.root);
      old.dispose();
      this.setRoom(room);
      return room;
    };
    if (reducedMotion()) {
      this.fadeSwap(() => {
        swap();
        done();
      });
      return;
    }
    audio.tide();
    const root = this.room.root;
    this.animate(
      0.4,
      (k) => (root.rotation.y = (Math.PI / 2) * ease(k)),
      () => {
        const r = swap();
        r.root.rotation.y = -Math.PI / 2;
        this.animate(0.45, (k) => (r.root.rotation.y = (-Math.PI / 2) * (1 - ease(k))), done);
      },
      0.5
    );
  }

  private openVault(): void {
    this.busy = true;
    this.recordResult(true);
    audio.bloom();
    buzz(30);
    this.room.openVault();
    const quote = k_(`dreamer.${this.dream.dreamer}.${playStyle(this.results, this.dream.layers.length, MOVE_SLACK[this.difficulty])}`);
    const start = this.room.vaultCoreWorld();
    if (!start || reducedMotion()) {
      window.setTimeout(() => this.events.onCard(this.results, quote), 600);
      return;
    }
    // The memory rises out of the flower toward you and blooms into the story card.
    const orb = glowSprite(0xffd27a, 1.2, 1);
    orb.position.copy(start);
    this.world.scene.add(orb);
    this.animate(
      1.4,
      (k) => {
        const cam = this.world.camera.position;
        const e = ease(k);
        orb.position.lerpVectors(start, cam.clone().lerp(start, 0.55), e);
        orb.position.y += Math.sin(k * Math.PI) * 1.2;
        orb.scale.setScalar(1.2 + e * 6);
        orb.material.opacity = 1 - Math.max(0, k - 0.7) / 0.3;
        if (k > 0.2) this.room.hideVaultCore();
      },
      () => {
        orb.removeFromParent();
        this.events.onCard(this.results, quote);
      },
      0.8
    );
  }

  /** The dream breaks into glowing paper fragments that drift upward; then the results. */
  wake(): void {
    this.busy = true;
    audio.shatter();
    buzz(30);
    this.room.shatter();
    const d = this.diver.root;
    this.echoes.forEach((e) => e.moveTo(null, 0));
    this.animate(0.6, (k) => {
      d.scale.setScalar(1 - k);
      d.position.y += 0.02;
    });
    this.animate(2.2, (k) => (this.world.target.y = ease(k) * 1.2));
    // A soft bloom of light where the floor was.
    const bloom = glowSprite(this.look(this.layerIndex).edge, 2, 0);
    bloom.position.set(0, 0.5, 0);
    this.world.scene.add(bloom);
    this.animate(
      2.2,
      (k) => {
        bloom.scale.setScalar(2 + k * 14);
        bloom.material.opacity = Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.55;
      },
      () => bloom.removeFromParent()
    );
    window.setTimeout(() => this.events.onResults(this.results), reducedMotion() ? 600 : 2300);
  }

  /** For screenshots and reviews: jump straight to the vault on the last layer. */
  demoVault(): void {
    const last = this.dream.layers.length - 1;
    if (this.layerIndex !== last) return;
    this.results = [
      { cleared: true, timeLeftMs: 49_000, pullMs: this.def(0).pullMs, moves: 8, par: 8, caught: 0 },
      { cleared: true, timeLeftMs: 38_000, pullMs: this.def(1).pullMs, moves: 9, par: 8, caught: 0 },
    ];
    this.state.hasKey = true;
    this.state.moves = 19;
    this.state.pos = { x: 6, y: 1 };
    this.diver.root.position.copy(this.room.tile(this.state.pos));
    this.input('up');
  }

  get seconds(): number {
    return this.time;
  }

  dispose(): void {
    this.off();
    this.echoes.forEach((e) => e.dispose());
    this.room.dispose();
    this.world.target.set(0, 0, 0);
    this.world.follow.set(0, 0, 0);
  }
}
