import * as THREE from 'three';
import { pixelRatio, reducedMotion, settings } from '../core/settings.ts';
import type { LayerLook } from '../core/palette.ts';

/** Margins (px) the HUD needs around the board. */
export type Frame = { top: number; bottom: number; side: number };

const ELEVATION = THREE.MathUtils.degToRad(54);
const FOV = 32;

/**
 * Renderer, camera, sky and lights. The camera looks at the board from the front at ~54°,
 * so "up" on screen is "up" on the board. Distance is solved so the board fills the free area.
 */
export class World {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 400);
  readonly hemi = new THREE.HemisphereLight(0xffffff, 0x222033, 0.8);
  readonly moon = new THREE.DirectionalLight(0xdfe0ff, 0.85);
  /** Point the camera looks at (board centre); animated during falls. */
  readonly target = new THREE.Vector3();
  /** Extra look offset toward the Diver. */
  readonly follow = new THREE.Vector3();
  private distance = 14;
  private sky: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private stars: THREE.Points;
  private skyTop = new THREE.Color();
  private skyBottom = new THREE.Color();
  private frame: Frame = { top: 70, bottom: 70, side: 12 };
  private fitBox = new THREE.Box3(new THREE.Vector3(-4.2, -0.8, -4.4), new THREE.Vector3(4.2, 1.4, 4.2));
  private callbacks = new Set<(dt: number, t: number) => void>();
  private last = performance.now();
  /** Adaptive resolution: scales the pixel ratio down when frames run long, back up when there's headroom. */
  private resScale = 1;
  private frameAvg = 16.7;
  private resCheck = 0;
  readonly clock = { t: 0 };

  constructor(private host: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({ antialias: settings.quality === 'high', powerPreference: 'high-performance', preserveDrawingBuffer: false });
    this.renderer.setPixelRatio(pixelRatio());
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.renderer.domElement.className = 'gl';

    this.scene.fog = new THREE.Fog(0x231a3d, 18, 60);
    this.moon.position.set(-6, 12, 6);
    this.scene.add(this.hemi, this.moon);

    const skyGeo = new THREE.SphereGeometry(150, 24, 16);
    skyGeo.setAttribute('color', new THREE.BufferAttribute(new Float32Array(skyGeo.getAttribute('position').count * 3), 3));
    this.sky = new THREE.Mesh(skyGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false, toneMapped: false }));
    this.sky.renderOrder = -10;
    this.scene.add(this.sky);

    const n = 700;
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(Math.random() * 0.9);
      pos.set([Math.sin(v) * Math.cos(u) * 120, Math.cos(v) * 120 - 10, Math.sin(v) * Math.sin(u) * 120], i * 3);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xfff6ea, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0.75, fog: false, depthWrite: false }));
    this.scene.add(this.stars);

    window.addEventListener('resize', () => this.resize());
    this.resize();
    this.renderer.setAnimationLoop(() => this.tick());
  }

  onFrame(fn: (dt: number, t: number) => void): () => void {
    this.callbacks.add(fn);
    return () => this.callbacks.delete(fn);
  }

  setFrame(frame: Frame): void {
    this.frame = frame;
    this.resize();
  }

  setFitBox(box: THREE.Box3): void {
    this.fitBox.copy(box);
    this.resize();
  }

  applyQuality(): void {
    this.resScale = 1;
    this.renderer.setPixelRatio(pixelRatio());
    this.resize();
  }

  /** Blend sky, fog and lights toward a layer look (k: 0..1). */
  setLook(from: LayerLook, to: LayerLook, k: number): void {
    const a = new THREE.Color();
    const b = new THREE.Color();
    this.skyTop.copy(a.setHex(from.skyTop)).lerp(b.setHex(to.skyTop), k);
    this.skyBottom.copy(a.setHex(from.skyBottom)).lerp(b.setHex(to.skyBottom), k);
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) fog.color.copy(a.setHex(from.fog)).lerp(b.setHex(to.fog), k);
    this.hemi.color.copy(a.setHex(from.ambient)).lerp(b.setHex(to.ambient), k);
    this.hemi.groundColor.copy(a.setHex(from.skyTop)).lerp(b.setHex(to.skyTop), k);
    const geo = this.sky.geometry;
    const p = geo.attributes.position;
    const c = geo.attributes.color;
    if (!p || !c) return;
    const col = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i) / 150; // -1..1
      // Dusk glow just below the horizon (behind the room), deepening overhead and far below.
      const glow = Math.exp(-Math.pow((y + 0.25) * 1.9, 2));
      col.copy(this.skyTop).lerp(this.skyBottom, 0.35 + glow * 0.65);
      c.setXYZ(i, col.r, col.g, col.b);
    }
    c.needsUpdate = true;
  }

  resize(): void {
    const w = this.host.clientWidth || window.innerWidth;
    const h = this.host.clientHeight || window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Shift the image so the board centres in the area between the HUD margins.
    const dy = (this.frame.bottom - this.frame.top) / 2;
    this.camera.setViewOffset(w, h, 0, dy, w, h);
    this.camera.updateProjectionMatrix();
    this.solveDistance(w, h);
  }

  /** Binary-search the camera distance so the fit box fills the free area. */
  private solveDistance(w: number, h: number): void {
    const availW = Math.max(100, w - this.frame.side * 2) / w;
    const availH = Math.max(100, h - this.frame.top - this.frame.bottom) / h;
    const corners: THREE.Vector3[] = [];
    const { min, max } = this.fitBox;
    for (const x of [min.x, max.x]) for (const y of [min.y, max.y]) for (const z of [min.z, max.z]) corners.push(new THREE.Vector3(x, y, z));
    let lo = 4;
    let hi = 60;
    const cam = this.camera.clone();
    for (let i = 0; i < 18; i++) {
      const d = (lo + hi) / 2;
      cam.position.set(0, Math.sin(ELEVATION) * d, Math.cos(ELEVATION) * d);
      cam.lookAt(0, 0, 0);
      cam.updateMatrixWorld();
      let fits = true;
      for (const c of corners) {
        const v = c.clone().project(cam);
        if (Math.abs(v.x) > availW || Math.abs(v.y) > availH) {
          fits = false;
          break;
        }
      }
      if (fits) hi = d;
      else lo = d;
    }
    this.distance = hi;
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.near = hi * 1.1;
      fog.far = hi * 3.2;
    }
  }

  private adapt(dt: number): void {
    this.frameAvg += (dt * 1000 - this.frameAvg) * 0.05;
    this.resCheck += dt;
    if (this.resCheck < 1.5) return;
    this.resCheck = 0;
    const prev = this.resScale;
    if (this.frameAvg > 18.5 && this.resScale > 0.6) this.resScale = Math.max(0.6, this.resScale - 0.1);
    else if (this.frameAvg < 15 && this.resScale < 1) this.resScale = Math.min(1, this.resScale + 0.05);
    if (prev !== this.resScale) {
      this.renderer.setPixelRatio(pixelRatio() * this.resScale);
      this.resize();
    }
  }

  /** Current render scale (for diagnostics). */
  get renderScale(): number {
    return this.resScale;
  }

  private tick(): void {
    const now = performance.now();
    const dt = Math.min(0.1, (now - this.last) / 1000);
    this.last = now;
    this.clock.t += dt;
    this.adapt(dt);
    const t = this.clock.t;
    for (const fn of this.callbacks) fn(dt, t);

    const sway = reducedMotion() ? 0 : 1;
    const yaw = Math.sin(t * 0.13) * 0.045 * sway;
    const d = this.distance;
    const look = this.target.clone().add(this.follow);
    this.camera.position.set(
      look.x + Math.sin(yaw) * Math.cos(ELEVATION) * d,
      look.y + Math.sin(ELEVATION) * d + Math.sin(t * 0.21) * 0.08 * sway,
      look.z + Math.cos(yaw) * Math.cos(ELEVATION) * d
    );
    this.camera.lookAt(look);
    this.sky.position.copy(this.camera.position);
    this.stars.position.copy(this.camera.position);
    this.stars.rotation.y = t * 0.004;
    this.renderer.render(this.scene, this.camera);
  }
}
