import * as Phaser from 'phaser';
import { settings } from './core/settings.ts';
import { Boot } from './scenes/Boot.ts';
import { Dream } from './scenes/Dream.ts';
import { Pick } from './scenes/Pick.ts';
import { Title } from './scenes/Title.ts';
import { Wake } from './scenes/Wake.ts';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  backgroundColor: '#120d24',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  render: {
    antialias: true,
    powerPreference: 'low-power',
    preserveDrawingBuffer: true, // needed for the wake-up shatter snapshot
  },
  input: { gamepad: true },
  fps: { target: 60, limit: settings.quality === 'low' ? 45 : 0 },
  scene: [Boot, Title, Pick, Dream, Wake],
};

document.addEventListener('DOMContentLoaded', () => {
  const game = new Phaser.Game(config);
  // Review/screenshot builds (?demo=…) expose the game for scripted checks.
  if (new URLSearchParams(window.location.search).has('demo')) Object.assign(window, { __maistGame: game });
});
