import * as Phaser from 'phaser';
import type { GameObjects, Scene } from 'phaser';
import { PALETTES } from './palette.ts';
import { settings } from './settings.ts';

/**
 * The night sky behind every scene: gradient, stars, drifting dust and the dreamer's silhouette
 * (for Night 1, the lighthouse and its sweeping beam).
 */
export class Backdrop {
  private skies: GameObjects.Image[] = [];
  private stars: GameObjects.TileSprite;
  private dust: GameObjects.Particles.ParticleEmitter;
  private tower: GameObjects.Image;
  private beam: GameObjects.Image;
  private layer = 0;

  constructor(private scene: Scene, layer = 0, withTower = true) {
    this.layer = layer;
    PALETTES.forEach((_, i) => {
      this.skies.push(scene.add.image(0, 0, `sky-${i}`).setOrigin(0).setDepth(-100).setAlpha(i === layer ? 1 : 0));
    });
    this.stars = scene.add.tileSprite(0, 0, 10, 10, 'stars').setOrigin(0).setDepth(-99).setAlpha(0.8);
    this.tower = scene.add.image(0, 0, 'lighthouse').setOrigin(0.5, 1).setDepth(-95).setAlpha(withTower ? 0.85 : 0);
    this.beam = scene.add
      .image(0, 0, 'beam')
      .setOrigin(0, 0.5)
      .setDepth(-96)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(withTower ? 0.6 : 0);

    const cap = settings.particleCap;
    this.dust = scene.add.particles(0, 0, 'dust', {
      x: { min: 0, max: 10 },
      y: { min: 0, max: 10 },
      lifespan: { min: 6000, max: 11000 },
      speedY: { min: -14, max: -4 },
      speedX: { min: -6, max: 6 },
      scale: { min: 0.15, max: 0.55 },
      alpha: { onEmit: () => 0, onUpdate: (_p, _k, life: number) => Math.sin(life * Math.PI) * 0.7 },
      frequency: 9000 / cap,
      maxAliveParticles: cap,
      blendMode: Phaser.BlendModes.ADD,
      tint: PALETTES[layer]?.glowHex ?? 0xffffff,
    });
    this.dust.setDepth(-90);
    this.layout();
    scene.scale.on('resize', this.layout, this);
    scene.events.once('shutdown', () => scene.scale.off('resize', this.layout, this));
  }

  layout(): void {
    const { width, height } = this.scene.scale;
    this.skies.forEach((s) => s.setDisplaySize(width, height));
    this.stars.setSize(width, height);
    this.tower.setPosition(width * 0.86, height * 0.78).setScale(Math.min(1.1, height / 620));
    this.beam.setPosition(this.tower.x, this.tower.y - this.tower.displayHeight * 0.76).setScale(this.tower.scale);
    this.dust.setPosition(0, 0);
    this.dust.updateConfig({ x: { min: 0, max: width }, y: { min: height * 0.2, max: height } });
  }

  update(time: number): void {
    this.stars.tilePositionX = time * 0.002;
    if (!settings.reducedMotion) this.beam.rotation = Math.sin(time * 0.00045) * 0.9 + Math.PI * 0.95;
    else this.beam.rotation = Math.PI;
  }

  setLayer(layer: number, ms = 900): void {
    if (layer === this.layer) return;
    const prev = this.skies[this.layer];
    const next = this.skies[layer];
    this.layer = layer;
    if (prev) this.scene.tweens.add({ targets: prev, alpha: 0, duration: ms });
    if (next) this.scene.tweens.add({ targets: next, alpha: 1, duration: ms });
    this.dust.setParticleTint(PALETTES[layer]?.glowHex ?? 0xffffff);
    // Deeper layers push the lighthouse further into the dark.
    this.scene.tweens.add({ targets: this.tower, alpha: layer === 0 ? 0.85 : layer === 1 ? 0.55 : 0.4, duration: ms });
  }

  /** A short upward rush of dust when falling to the next layer. */
  rush(): void {
    if (settings.reducedMotion) return;
    const { width, height } = this.scene.scale;
    const n = Math.min(40, settings.particleCap);
    const burst = this.scene.add.particles(0, 0, 'dust', {
      x: { min: 0, max: width },
      y: { min: height * 0.6, max: height * 1.1 },
      speedY: { min: -900, max: -500 },
      lifespan: 900,
      scaleX: 0.25,
      scaleY: { min: 1.5, max: 3 },
      alpha: { start: 0.8, end: 0 },
      blendMode: Phaser.BlendModes.ADD,
      emitting: false,
    });
    burst.setDepth(4000);
    burst.explode(n);
    this.scene.time.delayedCall(1200, () => burst.destroy());
  }
}
