import type { Scene } from 'phaser';
import { PALETTES, SERIF, SLAB_H, TILE_D, TILE_W, WALL_H, type LayerPalette } from './palette.ts';

type Ctx = CanvasRenderingContext2D;

function bake(scene: Scene, key: string, w: number, h: number, draw: (c: Ctx, w: number, h: number) => void): void {
  if (scene.textures.exists(key)) return;
  const tex = scene.textures.createCanvas(key, w, h);
  if (!tex) return;
  const ctx = tex.getContext();
  draw(ctx, w, h);
  tex.refresh();
}

/** Deterministic noise so the paper grain looks the same every run. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function grain(c: Ctx, w: number, h: number, seed: number, alpha = 0.07): void {
  const r = rng(seed);
  for (let i = 0; i < (w * h) / 18; i++) {
    c.fillStyle = r() > 0.5 ? `rgba(255,255,255,${alpha})` : `rgba(0,0,0,${alpha})`;
    c.fillRect(r() * w, r() * h, 1, 1);
  }
  // A few paper fibres.
  c.strokeStyle = `rgba(255,255,255,${alpha * 0.8})`;
  c.lineWidth = 0.6;
  for (let i = 0; i < 4; i++) {
    c.beginPath();
    const x = r() * w;
    const y = r() * h;
    c.moveTo(x, y);
    c.quadraticCurveTo(x + r() * 10, y + r() * 6 - 3, x + 8 + r() * 10, y + r() * 4 - 2);
    c.stroke();
  }
}

function roundRect(c: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.arcTo(x + w, y + h, x, y + h, r);
  c.arcTo(x, y + h, x, y, r);
  c.arcTo(x, y, x + w, y, r);
  c.closePath();
}

function radial(c: Ctx, w: number, h: number, stops: [number, string][]): void {
  const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) / 2);
  stops.forEach(([o, col]) => g.addColorStop(o, col));
  c.fillStyle = g;
  c.fillRect(0, 0, w, h);
}

function layerTextures(scene: Scene, p: LayerPalette, i: number): void {
  bake(scene, `sky-${i}`, 4, 512, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, p.skyTop);
    g.addColorStop(0.65, p.skyBottom);
    g.addColorStop(1, p.skyTop);
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  // Floor tile: the top face of the paper slab, with a faint lit seam.
  for (const alt of [0, 1]) {
    bake(scene, `floor-${i}-${alt}`, TILE_W, TILE_D, (c, w, h) => {
      c.fillStyle = alt ? p.floorAlt : p.floor;
      c.fillRect(0, 0, w, h);
      grain(c, w, h, 11 + i * 7 + alt, 0.06);
      c.strokeStyle = 'rgba(255,255,255,0.10)';
      c.lineWidth = 1;
      c.strokeRect(0.5, 0.5, w - 1, h - 1);
      c.fillStyle = 'rgba(0,0,0,0.10)';
      c.fillRect(0, h - 2, w, 2);
    });
  }

  // Wall block: lit top face, front face, glowing top edge.
  bake(scene, `wall-${i}`, TILE_W, TILE_D + WALL_H, (c, w, h) => {
    const top = TILE_D;
    c.fillStyle = p.wallFront;
    c.fillRect(0, top, w, h - top);
    const fg = c.createLinearGradient(0, top, 0, h);
    fg.addColorStop(0, 'rgba(255,255,255,0.10)');
    fg.addColorStop(1, 'rgba(0,0,0,0.25)');
    c.fillStyle = fg;
    c.fillRect(0, top, w, h - top);
    grain(c, w, h - top, 31 + i, 0.05);
    c.fillStyle = p.wallTop;
    c.fillRect(0, 0, w, top);
    grain(c, w, top, 41 + i, 0.06);
    // Moonlight from the upper left.
    const tg = c.createLinearGradient(0, 0, w, top);
    tg.addColorStop(0, 'rgba(255,255,255,0.22)');
    tg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = tg;
    c.fillRect(0, 0, w, top);
    c.shadowColor = p.edge;
    c.shadowBlur = 6;
    c.strokeStyle = p.edge;
    c.globalAlpha = 0.75;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(1, top - 0.5);
    c.lineTo(w - 1, top - 0.5);
    c.stroke();
    c.globalAlpha = 1;
    c.shadowBlur = 0;
  });

  // Closed door: a paper panel with an arch window. Open door: just the glowing arch frame.
  for (const state of ['closed', 'open'] as const) {
    bake(scene, `door-${state}-${i}`, TILE_W, TILE_D + WALL_H, (c, w, h) => {
      const archW = w - 14;
      const x0 = 7;
      const y0 = 6;
      const yb = h - 4;
      c.beginPath();
      c.moveTo(x0, yb);
      c.lineTo(x0, y0 + archW / 2);
      c.arc(x0 + archW / 2, y0 + archW / 2, archW / 2, Math.PI, 0);
      c.lineTo(x0 + archW, yb);
      if (state === 'closed') {
        c.closePath();
        c.fillStyle = p.wallFront;
        c.fill();
        c.fillStyle = 'rgba(255,255,255,0.14)';
        c.fill();
      }
      c.shadowColor = p.glow;
      c.shadowBlur = 8;
      c.strokeStyle = p.edge;
      c.lineWidth = 2;
      c.stroke();
      c.shadowBlur = 0;
      if (state === 'closed') {
        c.fillStyle = 'rgba(255,255,255,0.25)';
        c.fillRect(w / 2 - 1, y0 + 12, 2, yb - y0 - 16);
      }
    });
  }

  // The Drop: a glowing well that falls through the paper.
  bake(scene, `drop-${i}`, TILE_W, TILE_D, (c, w, h) => {
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(1, h / w);
    const g = c.createRadialGradient(0, 0, 2, 0, 0, w / 2 - 3);
    g.addColorStop(0, '#000000');
    g.addColorStop(0.55, p.ink);
    g.addColorStop(0.85, p.glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, w / 2 - 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });

  // Cut-away back wall with arched windows onto the night.
  bake(scene, `backwall-${i}`, TILE_W, WALL_H + 16, (c, w, h) => {
    c.fillStyle = p.wallFront;
    c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.08)');
    g.addColorStop(1, 'rgba(0,0,0,0.35)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    grain(c, w, h, 91 + i, 0.05);
    c.fillStyle = p.skyTop;
    c.beginPath();
    c.moveTo(w / 2 - 7, h - 8);
    c.lineTo(w / 2 - 7, 12);
    c.arc(w / 2, 12, 7, Math.PI, 0);
    c.lineTo(w / 2 + 7, h - 8);
    c.closePath();
    c.fill();
    c.strokeStyle = p.edge;
    c.globalAlpha = 0.5;
    c.lineWidth = 1;
    c.stroke();
    c.globalAlpha = 0.8;
    c.fillStyle = p.edge;
    c.fillRect(0, 0, w, 1.5);
    c.globalAlpha = 1;
  });

  // Soft contact shadows: below a wall (south) and to its right (moonlight from the upper left).
  bake(scene, 'ao-s', TILE_W, TILE_D, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h * 0.7);
    g.addColorStop(0, 'rgba(0,0,0,0.55)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
  bake(scene, 'ao-e', TILE_W, TILE_D, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w * 0.55, 0);
    g.addColorStop(0, 'rgba(0,0,0,0.4)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  // Floor slab front edge: one strip per tile so any board width works.
  bake(scene, `slab-${i}`, TILE_W, SLAB_H, (c, w, h) => {
    c.fillStyle = p.wallFront;
    c.fillRect(0, 0, w, h);
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0.12)');
    g.addColorStop(1, 'rgba(0,0,0,0.45)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
    grain(c, w, h, 71 + i, 0.05);
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.fillRect(0, 0, w, 1);
  });
}

export function bakeTextures(scene: Scene): void {
  PALETTES.forEach((p, i) => layerTextures(scene, p, i));

  bake(scene, 'stars', 512, 512, (c, w, h) => {
    const r = rng(7);
    for (let i = 0; i < 140; i++) {
      const s = r() < 0.12 ? 1.6 : 0.8;
      c.fillStyle = `rgba(255,248,235,${0.25 + r() * 0.6})`;
      c.beginPath();
      c.arc(r() * w, r() * h, s, 0, Math.PI * 2);
      c.fill();
    }
  });

  bake(scene, 'dust', 16, 16, (c, w, h) =>
    radial(c, w, h, [
      [0, 'rgba(255,255,255,1)'],
      [0.4, 'rgba(255,255,255,0.45)'],
      [1, 'rgba(255,255,255,0)'],
    ])
  );

  bake(scene, 'glow', 128, 128, (c, w, h) =>
    radial(c, w, h, [
      [0, 'rgba(255,255,255,0.9)'],
      [0.25, 'rgba(255,255,255,0.35)'],
      [1, 'rgba(255,255,255,0)'],
    ])
  );

  bake(scene, 'shadow', 48, 16, (c, w, h) => {
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(1, h / w);
    const g = c.createRadialGradient(0, 0, 0, 0, 0, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,0.45)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = g;
    c.beginPath();
    c.arc(0, 0, w / 2, 0, Math.PI * 2);
    c.fill();
    c.restore();
  });

  bake(scene, 'vignette', 256, 256, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, w * 0.25, w / 2, h / 2, w * 0.72);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, 'rgba(0,0,0,1)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });

  bake(scene, 'ripple', 64, 32, (c, w, h) => {
    c.save();
    c.translate(w / 2, h / 2);
    c.scale(1, h / w);
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    c.beginPath();
    c.arc(0, 0, w / 2 - 3, 0, Math.PI * 2);
    c.stroke();
    c.restore();
  });

  // The Diver: hooded, faceless, holding a lantern.
  bake(scene, 'diver', 44, 60, (c) => {
    c.fillStyle = '#1d1830';
    c.beginPath();
    c.moveTo(20, 16);
    c.bezierCurveTo(10, 24, 7, 40, 5, 54);
    c.quadraticCurveTo(13, 58, 20, 56);
    c.quadraticCurveTo(28, 58, 35, 54);
    c.bezierCurveTo(33, 40, 30, 24, 20, 16);
    c.fill();
    c.beginPath();
    c.arc(20, 15, 10, 0, Math.PI * 2);
    c.fill();
    // Moonlit rim on the left.
    c.strokeStyle = 'rgba(214,204,255,0.75)';
    c.lineWidth = 1.4;
    c.beginPath();
    c.arc(20, 15, 10, Math.PI * 0.85, Math.PI * 1.55);
    c.stroke();
    c.beginPath();
    c.moveTo(11, 25);
    c.bezierCurveTo(8, 36, 6, 46, 5.5, 53);
    c.stroke();
    // Faint glint where a face would be.
    c.fillStyle = 'rgba(255,240,220,0.55)';
    c.beginPath();
    c.ellipse(23, 16, 3, 2, 0, 0, Math.PI * 2);
    c.fill();
    // Arm and lantern.
    c.strokeStyle = '#2b2442';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(27, 30);
    c.lineTo(34, 35);
    c.stroke();
    c.shadowColor = '#ffd27a';
    c.shadowBlur = 8;
    c.fillStyle = '#ffd27a';
    roundRect(c, 32, 35, 8, 10, 2.5);
    c.fill();
    c.shadowBlur = 0;
    c.fillStyle = '#fff6dc';
    c.fillRect(35, 38, 2, 4);
  });

  bake(scene, 'orb', 32, 32, (c, w, h) => {
    radial(c, w, h, [
      [0, 'rgba(255,255,255,1)'],
      [0.3, 'rgba(255,236,190,0.95)'],
      [0.6, 'rgba(255,200,120,0.35)'],
      [1, 'rgba(255,200,120,0)'],
    ]);
  });

  bake(scene, 'note', 30, 24, (c) => {
    c.fillStyle = '#efe6d2';
    c.beginPath();
    c.moveTo(3, 6);
    c.lineTo(22, 2);
    c.lineTo(27, 17);
    c.lineTo(8, 21);
    c.closePath();
    c.fill();
    c.strokeStyle = 'rgba(60,40,30,0.35)';
    c.lineWidth = 1;
    c.beginPath();
    c.moveTo(12.5, 4);
    c.lineTo(17.5, 19);
    c.stroke();
    c.fillStyle = 'rgba(120,110,130,0.7)';
    c.beginPath();
    c.ellipse(11, 12, 3, 1.6, -0.5, 0, Math.PI * 2);
    c.ellipse(18, 10.5, 3, 1.6, 0.4, 0, Math.PI * 2);
    c.fill();
  });

  bake(scene, 'petal', 30, 54, (c, w, h) => {
    const g = c.createLinearGradient(0, h, 0, 0);
    g.addColorStop(0, '#9a5a22');
    g.addColorStop(0.6, '#f2c27a');
    g.addColorStop(1, '#fff1c9');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(w / 2, h);
    c.bezierCurveTo(-4, h * 0.6, 4, 6, w / 2, 0);
    c.bezierCurveTo(w - 4, 6, w + 4, h * 0.6, w / 2, h);
    c.fill();
    c.strokeStyle = 'rgba(255,250,230,0.8)';
    c.lineWidth = 1;
    c.stroke();
    c.strokeStyle = 'rgba(120,60,20,0.35)';
    c.beginPath();
    c.moveTo(w / 2, h - 3);
    c.lineTo(w / 2, 8);
    c.stroke();
  });

  bake(scene, 'lighthouse', 120, 300, (c) => {
    c.fillStyle = 'rgba(12,8,24,0.92)';
    // Rock.
    c.beginPath();
    c.moveTo(0, 300);
    c.quadraticCurveTo(20, 252, 60, 250);
    c.quadraticCurveTo(102, 254, 120, 300);
    c.fill();
    // Tower (tapered).
    c.beginPath();
    c.moveTo(40, 256);
    c.lineTo(48, 92);
    c.lineTo(72, 92);
    c.lineTo(80, 256);
    c.closePath();
    c.fill();
    // Gallery and lamp room.
    c.fillRect(40, 84, 40, 8);
    c.fillRect(48, 56, 24, 28);
    c.beginPath();
    c.moveTo(44, 56);
    c.lineTo(60, 40);
    c.lineTo(76, 56);
    c.fill();
    c.shadowColor = '#ffd27a';
    c.shadowBlur = 18;
    c.fillStyle = '#ffe2a6';
    c.fillRect(52, 61, 16, 18);
    c.shadowBlur = 0;
    // A few lit windows.
    c.fillStyle = 'rgba(255,214,140,0.7)';
    c.fillRect(58, 140, 4, 7);
    c.fillRect(57, 200, 5, 8);
  });

  bake(scene, 'beam', 360, 90, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,236,190,0.55)');
    g.addColorStop(1, 'rgba(255,236,190,0)');
    c.fillStyle = g;
    c.beginPath();
    c.moveTo(0, h / 2 - 4);
    c.lineTo(w, 0);
    c.lineTo(w, h);
    c.lineTo(0, h / 2 + 4);
    c.closePath();
    c.fill();
  });

  bake(scene, 'logo', 560, 180, (c, w, h) => {
    const letters = ['m', 'a', 'ı', 's', 't'];
    c.font = `300 128px ${SERIF}`;
    c.textBaseline = 'alphabetic';
    const spacing = 18;
    const widths = letters.map((l) => c.measureText(l).width);
    const total = widths.reduce((a, b) => a + b, 0) + spacing * (letters.length - 1);
    let x = (w - total) / 2;
    const base = h * 0.72;
    const g = c.createLinearGradient(0, base - 90, 0, base);
    g.addColorStop(0, '#fbf5ff');
    g.addColorStop(1, '#b9a8e6');
    c.shadowColor = 'rgba(243,217,255,0.55)';
    c.shadowBlur = 16;
    c.fillStyle = g;
    let iX = 0;
    letters.forEach((l, i) => {
      if (l === 'ı') iX = x + (widths[i] ?? 0) / 2;
      c.fillText(l, x, base);
      x += (widths[i] ?? 0) + spacing;
    });
    // The dot of the i is a small paper moth, lit by a lantern.
    const my = base - 92;
    c.shadowColor = '#ffd27a';
    c.shadowBlur = 20;
    c.fillStyle = '#ffe7b3';
    c.beginPath();
    c.ellipse(iX - 8, my, 9, 5, -0.5, 0, Math.PI * 2);
    c.ellipse(iX + 8, my, 9, 5, 0.5, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#fff8e6';
    c.beginPath();
    c.ellipse(iX, my + 1, 2, 6, 0, 0, Math.PI * 2);
    c.fill();
    c.shadowBlur = 0;
  });

  bake(scene, 'card-art', 280, 180, (c, w, h) => {
    const sky = c.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0d1424');
    sky.addColorStop(0.6, '#24304e');
    sky.addColorStop(1, '#0b1020');
    c.fillStyle = sky;
    c.fillRect(0, 0, w, h);
    // Storm clouds.
    c.fillStyle = 'rgba(8,10,22,0.75)';
    [
      [40, 30, 60, 18],
      [130, 22, 80, 20],
      [230, 36, 70, 18],
    ].forEach(([x, y, rx, ry]) => {
      c.beginPath();
      c.ellipse(x ?? 0, y ?? 0, rx ?? 0, ry ?? 0, 0, 0, Math.PI * 2);
      c.fill();
    });
    // Rain.
    const r = rng(3);
    c.strokeStyle = 'rgba(180,200,255,0.18)';
    c.lineWidth = 1;
    for (let i = 0; i < 60; i++) {
      const x = r() * w;
      const y = r() * h * 0.8;
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x - 4, y + 10);
      c.stroke();
    }
    // Beam.
    const bg = c.createLinearGradient(196, 70, w, 40);
    bg.addColorStop(0, 'rgba(255,230,170,0.7)');
    bg.addColorStop(1, 'rgba(255,230,170,0)');
    c.fillStyle = bg;
    c.beginPath();
    c.moveTo(196, 70);
    c.lineTo(w, 30);
    c.lineTo(w, 92);
    c.closePath();
    c.fill();
    // Sea.
    c.fillStyle = '#070b16';
    c.fillRect(0, 128, w, h - 128);
    c.strokeStyle = 'rgba(160,190,255,0.25)';
    for (let y = 134; y < h; y += 8) {
      c.beginPath();
      for (let x = 0; x <= w; x += 10) c.lineTo(x, y + Math.sin((x + y) * 0.15) * 2);
      c.stroke();
    }
    // Four boats coming home.
    c.shadowColor = '#ffd27a';
    c.shadowBlur = 6;
    c.fillStyle = '#ffd27a';
    [40, 78, 118, 150].forEach((x, i) => c.fillRect(x, 126 - (i % 2), 2, 2));
    c.shadowBlur = 0;
    // Rock and tower.
    c.fillStyle = '#05070f';
    c.beginPath();
    c.moveTo(160, 140);
    c.quadraticCurveTo(190, 112, 230, 140);
    c.fill();
    c.beginPath();
    c.moveTo(186, 128);
    c.lineTo(190, 72);
    c.lineTo(202, 72);
    c.lineTo(206, 128);
    c.fill();
    c.fillRect(186, 66, 20, 6);
    c.shadowColor = '#ffd27a';
    c.shadowBlur = 14;
    c.fillStyle = '#ffe6ad';
    c.fillRect(191, 56, 10, 10);
    c.shadowBlur = 0;
    c.fillStyle = '#05070f';
    c.beginPath();
    c.moveTo(188, 56);
    c.lineTo(196, 48);
    c.lineTo(204, 56);
    c.fill();
    // Ines, a tiny figure on the gallery.
    c.fillRect(203, 60, 2, 6);
  });

  // Ability icons.
  bake(scene, 'icon-still', 64, 64, (c) => {
    c.strokeStyle = '#e8f6ff';
    c.lineWidth = 3;
    c.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3;
      c.beginPath();
      c.moveTo(32 + Math.cos(a) * 6, 32 + Math.sin(a) * 6);
      c.lineTo(32 + Math.cos(a) * 22, 32 + Math.sin(a) * 22);
      c.stroke();
      c.beginPath();
      c.moveTo(32 + Math.cos(a) * 15, 32 + Math.sin(a) * 15);
      c.lineTo(32 + Math.cos(a + 0.35) * 20, 32 + Math.sin(a + 0.35) * 20);
      c.stroke();
    }
  });
  bake(scene, 'icon-blink', 64, 64, (c) => {
    c.fillStyle = 'rgba(232,246,255,0.35)';
    c.fillRect(28, 10, 8, 44);
    c.strokeStyle = '#e8f6ff';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.setLineDash([5, 5]);
    c.beginPath();
    c.moveTo(8, 32);
    c.lineTo(50, 32);
    c.stroke();
    c.setLineDash([]);
    c.beginPath();
    c.moveTo(44, 24);
    c.lineTo(54, 32);
    c.lineTo(44, 40);
    c.stroke();
  });
  bake(scene, 'icon-lantern', 64, 64, (c) => {
    c.strokeStyle = '#ffe2a6';
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      c.beginPath();
      c.moveTo(32 + Math.cos(a) * 18, 34 + Math.sin(a) * 18);
      c.lineTo(32 + Math.cos(a) * 26, 34 + Math.sin(a) * 26);
      c.stroke();
    }
    c.shadowColor = '#ffd27a';
    c.shadowBlur = 10;
    c.fillStyle = '#ffd27a';
    roundRect(c, 24, 24, 16, 20, 4);
    c.fill();
    c.shadowBlur = 0;
    c.strokeStyle = '#ffe2a6';
    c.beginPath();
    c.arc(32, 22, 5, Math.PI, 0);
    c.stroke();
  });

  bake(scene, 'arrow', 64, 64, (c) => {
    c.fillStyle = 'rgba(255,255,255,0.10)';
    c.beginPath();
    c.arc(32, 32, 30, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 1.5;
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.85)';
    c.beginPath();
    c.moveTo(32, 18);
    c.lineTo(44, 36);
    c.lineTo(20, 36);
    c.closePath();
    c.fill();
  });

  bake(scene, 'paper-card', 300, 440, (c, w, h) => {
    c.fillStyle = '#efe6d6';
    roundRect(c, 0, 0, w, h, 10);
    c.fill();
    grain(c, w, h, 99, 0.05);
    c.strokeStyle = 'rgba(80,60,40,0.25)';
    c.lineWidth = 1;
    roundRect(c, 8, 8, w - 16, h - 16, 6);
    c.stroke();
  });

  bake(scene, 'button', 220, 56, (c, w, h) => {
    c.fillStyle = 'rgba(255,240,220,0.12)';
    roundRect(c, 1, 1, w - 2, h - 2, h / 2);
    c.fill();
    c.strokeStyle = 'rgba(255,226,166,0.85)';
    c.lineWidth = 1.5;
    c.stroke();
  });
}
