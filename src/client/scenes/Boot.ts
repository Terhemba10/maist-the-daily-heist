import { Scene } from 'phaser';
import { bakeTextures } from '../core/textures.ts';
import type { DreamData } from './Dream.ts';

/** Bakes every texture (all art is drawn in code), then routes to the first scene. */
export class Boot extends Scene {
  constructor() {
    super('Boot');
  }

  create(): void {
    bakeTextures(this);
    // ?demo=… jumps straight to a moment of the slice (used for screenshots and reviews).
    const params = new URLSearchParams(window.location.search);
    const demo = params.get('demo') ?? '';
    const layer = Number(params.get('layer') ?? '1') - 1;
    if (demo === 'pick') return void this.scene.start('Pick');
    if (demo === 'wake') return void this.scene.start('Wake', {});
    if (demo === 'dream' || demo === 'vault') {
      const data: DreamData = { ability: 'lantern', startLayer: demo === 'vault' ? 2 : Math.max(0, Math.min(2, layer)), demo };
      return void this.scene.start('Dream', data);
    }
    this.scene.start('Title');
  }
}
