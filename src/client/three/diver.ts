import * as THREE from 'three';
import { cloakColor, lanternColor } from '../core/palette.ts';
import { reducedMotion, settings } from '../core/settings.ts';
import { glowSprite } from './room3d.ts';

function figure(cloak: THREE.Material, face: THREE.Material): THREE.Group {
  const g = new THREE.Group();
  const body = new THREE.Mesh(new THREE.ConeGeometry(0.27, 0.62, 7), cloak);
  body.position.y = 0.31;
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.17, 8, 6), cloak);
  hood.position.set(0, 0.66, 0.01);
  hood.scale.set(1, 1.05, 1.05);
  const peak = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.18, 6), cloak);
  peak.position.set(0, 0.8, -0.06);
  peak.rotation.x = -0.6;
  const glint = new THREE.Mesh(new THREE.CircleGeometry(0.06, 8), face);
  glint.position.set(0.02, 0.66, 0.165);
  g.add(body, hood, peak, glint);
  return g;
}

/** The Diver: hooded, faceless, holding a lantern that really lights the tiles around it. */
export class Diver {
  readonly root = new THREE.Group();
  readonly light: THREE.PointLight;
  private body: THREE.Group;
  private lantern: THREE.Group;
  private glow: THREE.Sprite;
  private cloakMat: THREE.MeshLambertMaterial;
  private lanternMat: THREE.MeshBasicMaterial;
  private hop = 0;
  private boost = 0;

  constructor() {
    this.cloakMat = new THREE.MeshLambertMaterial({ color: cloakColor(settings.cloak), flatShading: true });
    const faceMat = new THREE.MeshBasicMaterial({ color: 0xfff0dc, transparent: true, opacity: 0.7 });
    this.body = figure(this.cloakMat, faceMat);
    const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.3, 12), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.012;
    shadow.scale.set(1, 0.8, 1);

    this.lanternMat = new THREE.MeshBasicMaterial({ color: lanternColor(settings.lantern), toneMapped: false });
    this.lantern = new THREE.Group();
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.22), this.cloakMat);
    arm.position.set(0.17, 0.42, 0.1);
    arm.rotation.x = 0.4;
    const cage = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.15, 0.11), new THREE.MeshLambertMaterial({ color: 0x2a2420 }));
    const core = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.11, 0.115), this.lanternMat);
    this.lantern.add(cage, core);
    this.lantern.position.set(0.24, 0.33, 0.22);
    this.glow = glowSprite(lanternColor(settings.lantern), 1.1, 0.75);
    this.glow.position.copy(this.lantern.position);

    this.light = new THREE.PointLight(lanternColor(settings.lantern), settings.quality === 'low' ? 2.4 : 3.2, 3.6, 1.6);
    this.light.position.set(0.24, 0.5, 0.3);

    this.root.add(shadow, this.body, arm, this.lantern, this.glow, this.light);
  }

  applyCosmetics(): void {
    this.cloakMat.color.setHex(cloakColor(settings.cloak));
    const lc = lanternColor(settings.lantern);
    this.lanternMat.color.setHex(lc);
    this.glow.material.color.setHex(lc);
    this.light.color.setHex(lc);
  }

  /** Lantern ability: a big warm flare for a few seconds. */
  flare(seconds: number): void {
    this.boost = seconds;
  }

  step(): void {
    this.hop = 1;
  }

  update(dt: number, t: number): void {
    const still = reducedMotion();
    this.hop = Math.max(0, this.hop - dt * 7);
    this.body.position.y = Math.sin(this.hop * Math.PI) * 0.08;
    this.lantern.rotation.z = still ? 0 : Math.sin(t * 2.2) * 0.12;
    const flick = still ? 1 : 0.93 + 0.07 * Math.sin(t * 13) * Math.sin(t * 7.3);
    this.boost = Math.max(0, this.boost - dt);
    const b = this.boost > 0 ? 1 : 0;
    this.light.intensity = (settings.quality === 'low' ? 2.4 : 3.2) * flick * (1 + b * 1.6);
    this.light.distance = 3.6 + b * 3;
    this.glow.scale.setScalar(1.1 * flick + b * 1.6);
  }
}

/** A light-ghost replaying the Diver's past steps. */
export class Echo {
  readonly root: THREE.Group;
  private mat: THREE.MeshBasicMaterial;
  private trail: { mesh: THREE.Group; life: number }[] = [];
  private last = new THREE.Vector3(Infinity, 0, 0);

  constructor(
    private color: number,
    private parent: THREE.Object3D
  ) {
    this.mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    this.root = figure(this.mat, this.mat);
    this.root.add(glowSprite(color, 1.2, 0.35));
    this.root.visible = false;
    parent.add(this.root);
  }

  setFrozen(frozen: boolean): void {
    this.mat.color.setHex(frozen ? 0x9fd8ff : this.color);
    this.mat.opacity = frozen ? 0.22 : 0.5;
  }

  moveTo(p: THREE.Vector3 | null, dt: number): void {
    if (!p) {
      this.root.visible = false;
      return;
    }
    if (!this.root.visible) {
      this.root.visible = true;
      this.root.position.copy(p);
      this.last.copy(p);
    }
    if (!p.equals(this.last)) {
      // Leave a fading light trail where the echo stood.
      if (settings.quality === 'high' && !reducedMotion()) {
        const ghost = figure(this.mat.clone(), this.mat.clone());
        ghost.position.copy(this.root.position);
        this.parent.add(ghost);
        this.trail.push({ mesh: ghost, life: 0.7 });
      }
      this.last.copy(p);
    }
    this.root.position.lerp(p, Math.min(1, dt * 14));
    this.trail = this.trail.filter((g) => {
      g.life -= dt;
      g.mesh.traverse((o) => {
        if (o instanceof THREE.Mesh && o.material instanceof THREE.MeshBasicMaterial) o.material.opacity = Math.max(0, g.life * 0.35);
      });
      g.mesh.scale.y = 0.7 + g.life * 0.4;
      if (g.life <= 0) g.mesh.removeFromParent();
      return g.life > 0;
    });
  }

  dispose(): void {
    this.root.removeFromParent();
    this.trail.forEach((g) => g.mesh.removeFromParent());
  }
}
