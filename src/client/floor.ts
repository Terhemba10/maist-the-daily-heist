/**
 * The office floor, drawn once per layer on a canvas: light wood planks and white tiles, no furniture
 * (the walls are the only obstacles). Seeded, so a layer always gets the same floor.
 */

const SIZE = 10;

function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A canvas holding the floor at `px` pixels square (the board's size on screen times the pixel ratio). */
export function floorCanvas(seed: number, px: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  const size = Math.max(200, Math.min(720, Math.round(px)));
  c.width = size;
  c.height = size;
  const g = c.getContext('2d', { alpha: false });
  if (!g) return c;
  const r = rng(seed);
  const cell = size / SIZE;
  // Wood in two opposite quadrants, white tiles in the other two; the split moves a little per layer.
  const sx = 4 + Math.floor(r() * 3);
  const sy = 4 + Math.floor(r() * 3);
  const flip = r() < 0.5;
  const isWood = (x: number, y: number) => (x < sx) === (y < sy) !== flip;

  // white tiles: one per cell, a soft grout line
  g.fillStyle = '#fbfaf6';
  g.fillRect(0, 0, size, size);
  g.strokeStyle = 'rgba(160, 160, 150, 0.35)';
  g.lineWidth = Math.max(1, cell * 0.03);
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (isWood(x, y)) continue;
      // a faint diagonal sheen so the tiles read as glazed
      const grad = g.createLinearGradient(x * cell, y * cell, (x + 1) * cell, (y + 1) * cell);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(1, '#f1efe8');
      g.fillStyle = grad;
      g.fillRect(x * cell, y * cell, cell, cell);
      g.strokeRect(x * cell + 0.5, y * cell + 0.5, cell - 1, cell - 1);
    }

  // wood planks: three rows per cell, staggered seams, a little colour variation per plank
  const plankH = cell / 3;
  const tones = ['#e9c9a0', '#e3c093', '#eccfaa', '#dfb98a', '#e6c597'];
  for (let row = 0; row < SIZE * 3; row++) {
    const y0 = row * plankH;
    const cy = Math.floor(row / 3);
    let x0 = -r() * cell * 2;
    while (x0 < size) {
      const len = cell * (1.6 + r() * 1.6);
      for (let cx = 0; cx < SIZE; cx++) {
        if (!isWood(cx, cy)) continue;
        // clip each plank to the wood cells it crosses
        const a = Math.max(x0, cx * cell);
        const b = Math.min(x0 + len, (cx + 1) * cell);
        if (b <= a) continue;
        g.fillStyle = tones[Math.floor(r() * tones.length)] ?? '#e6c597';
        g.fillRect(a, y0, b - a, plankH);
      }
      // seam at the plank's end
      const seamCell = Math.floor((x0 + len) / cell);
      if (isWood(Math.min(SIZE - 1, Math.max(0, seamCell)), cy)) {
        g.fillStyle = 'rgba(150, 105, 60, 0.45)';
        g.fillRect(x0 + len - 1, y0, Math.max(1, cell * 0.025), plankH);
      }
      x0 += len;
    }
    // the line between plank rows
    for (let cx = 0; cx < SIZE; cx++) {
      if (!isWood(cx, cy)) continue;
      g.fillStyle = 'rgba(150, 105, 60, 0.35)';
      g.fillRect(cx * cell, y0 + plankH - Math.max(1, cell * 0.02), cell, Math.max(1, cell * 0.02));
    }
  }
  return c;
}
