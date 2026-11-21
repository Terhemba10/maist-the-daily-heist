/** 2D art drawn in code (Canvas 2D). Used by the DOM UI and as three.js textures. */
import { SERIF } from './palette.ts';

type Ctx = CanvasRenderingContext2D;

export function canvas(w: number, h: number, draw: (c: Ctx, w: number, h: number) => void, scale = 1): HTMLCanvasElement {
  const el = document.createElement('canvas');
  el.width = Math.round(w * scale);
  el.height = Math.round(h * scale);
  const c = el.getContext('2d');
  if (c) {
    c.scale(scale, scale);
    draw(c, w, h);
  }
  return el;
}

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

/** The approved logo: thin serif "maist", the i's dot is a paper moth lit by a lantern. */
export function drawLogo(c: Ctx, w: number, h: number): void {
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
}

/** Story card illustration for Night 1 (approved). */
export function drawLighthouseCard(c: Ctx, w: number, h: number): void {
  const sky = c.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#0d1424');
  sky.addColorStop(0.6, '#24304e');
  sky.addColorStop(1, '#0b1020');
  c.fillStyle = sky;
  c.fillRect(0, 0, w, h);
  c.fillStyle = 'rgba(8,10,22,0.75)';
  for (const [x, y, rx, ry] of [
    [40, 30, 60, 18],
    [130, 22, 80, 20],
    [230, 36, 70, 18],
  ] as const) {
    c.beginPath();
    c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    c.fill();
  }
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
  c.fillStyle = '#070b16';
  c.fillRect(0, 128, w, h - 128);
  c.strokeStyle = 'rgba(160,190,255,0.25)';
  for (let y = 134; y < h; y += 8) {
    c.beginPath();
    for (let x = 0; x <= w; x += 10) c.lineTo(x, y + Math.sin((x + y) * 0.15) * 2);
    c.stroke();
  }
  c.shadowColor = '#ffd27a';
  c.shadowBlur = 6;
  c.fillStyle = '#ffd27a';
  [40, 78, 118, 150].forEach((x, i) => c.fillRect(x, 126 - (i % 2), 2, 2));
  c.shadowBlur = 0;
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
  c.fillRect(203, 60, 2, 6);
}

export type IconKind = 'still' | 'blink' | 'lantern';

export function drawIcon(kind: IconKind, c: Ctx): void {
  c.lineCap = 'round';
  if (kind === 'still') {
    c.strokeStyle = '#e8f6ff';
    c.lineWidth = 3;
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
  } else if (kind === 'blink') {
    c.fillStyle = 'rgba(232,246,255,0.35)';
    c.fillRect(28, 10, 8, 44);
    c.strokeStyle = '#e8f6ff';
    c.lineWidth = 3;
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
  } else {
    c.strokeStyle = '#ffe2a6';
    c.lineWidth = 2.5;
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
  }
}

export function iconCanvas(kind: IconKind, px = 64): HTMLCanvasElement {
  return canvas(64, 64, (c) => drawIcon(kind, c), px / 64);
}

/** Soft white radial blob for additive sprites (glows, light pools, particles). */
export function glowCanvas(size = 128, hard = 0.25): HTMLCanvasElement {
  return canvas(size, size, (c, w, h) => {
    const g = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(hard, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}

/** Rippling caustic web for the drowned layer's floor (tiles seamlessly). */
export function causticCanvas(size = 256): HTMLCanvasElement {
  return canvas(size, size, (c, w, h) => {
    const r = rng(17);
    c.strokeStyle = 'rgba(255,255,255,0.55)';
    c.lineWidth = 2;
    c.lineCap = 'round';
    for (let i = 0; i < 46; i++) {
      const x = r() * w;
      const y = r() * h;
      const len = 20 + r() * 50;
      const a = r() * Math.PI * 2;
      for (const [ox, oy] of [
        [0, 0],
        [w, 0],
        [-w, 0],
        [0, h],
        [0, -h],
      ] as const) {
        c.beginPath();
        c.moveTo(x + ox, y + oy);
        c.quadraticCurveTo(x + ox + Math.cos(a + 1) * len * 0.6, y + oy + Math.sin(a + 1) * len * 0.6, x + ox + Math.cos(a) * len, y + oy + Math.sin(a) * len);
        c.stroke();
      }
    }
  });
}

/** Lengthwise fade for the lighthouse beam and light shafts. */
export function beamCanvas(): HTMLCanvasElement {
  return canvas(16, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,255,255,0)');
    g.addColorStop(0.15, 'rgba(255,255,255,0.15)');
    g.addColorStop(1, 'rgba(255,255,255,0.75)');
    c.fillStyle = g;
    c.fillRect(0, 0, w, h);
  });
}
