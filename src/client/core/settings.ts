/** Per-player preferences, saved in browser storage (moves to Redis per user in step d). */
import type { Difficulty } from '../../shared/logic/difficulty.ts';

export type Quality = 'high' | 'low';
export type MotionPref = 'system' | 'on' | 'off';
export type ThemeId = 'moonlit' | 'rose' | 'ocean' | 'midnight' | 'contrast';

type Saved = {
  quality: Quality;
  music: number;
  sfx: number;
  vibration: boolean;
  motion: MotionPref;
  theme: ThemeId;
  cloak: string;
  lantern: string;
  difficulty: Difficulty;
  onboarded: boolean;
  /** Consecutive nights played (from the server when available). */
  streak: number;
  /** Opt-in: show the streak as user flair in the subreddit. */
  flair: boolean;
};

const KEY = 'maist.settings.v2';

function read(): Partial<Saved> {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

function detectQuality(): Quality {
  const nav: NavigatorWithMemory = navigator;
  const memory = nav.deviceMemory ?? 8;
  const mobile = /Android|iPhone|iPad/i.test(nav.userAgent);
  return mobile && memory <= 4 ? 'low' : 'high';
}

function systemReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const stored = read();
const params = new URLSearchParams(window.location.search);
const forcedQuality = params.get('quality');

export const settings: Saved = {
  quality: forcedQuality === 'low' || forcedQuality === 'high' ? forcedQuality : (stored.quality ?? detectQuality()),
  music: stored.music ?? 0.7,
  sfx: stored.sfx ?? 0.8,
  vibration: stored.vibration ?? true,
  motion: stored.motion ?? 'system',
  theme: stored.theme ?? 'moonlit',
  cloak: stored.cloak ?? 'ink',
  lantern: stored.lantern ?? 'amber',
  difficulty: stored.difficulty ?? 'medium',
  onboarded: stored.onboarded ?? false,
  streak: stored.streak ?? 0,
  flair: stored.flair ?? false,
};

const listeners = new Set<() => void>();

export function saveSettings(patch: Partial<Saved> = {}): void {
  Object.assign(settings, patch);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* storage blocked: settings still apply for this session */
  }
  listeners.forEach((fn) => fn());
}

export function onSettingsChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function reducedMotion(): boolean {
  if (settings.motion === 'on') return true;
  if (settings.motion === 'off') return false;
  return systemReducedMotion();
}

export function particleCap(): number {
  if (reducedMotion()) return 40;
  return settings.quality === 'low' ? 140 : 420;
}

export function pixelRatio(): number {
  const dpr = window.devicePixelRatio || 1;
  return settings.quality === 'low' ? Math.min(dpr, 1.25) : Math.min(dpr, 3);
}

/** Light haptic tick on phones that support it. */
export function buzz(ms = 12): void {
  if (!settings.vibration || reducedMotion()) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
