/** Per-viewer preferences. Storage can be blocked, so every access is guarded. */

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: keep the in-memory value */
  }
}

export type Quality = 'high' | 'low';

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

function detectQuality(): Quality {
  const nav: NavigatorWithMemory = navigator;
  const cores = nav.hardwareConcurrency || 4;
  const memory = nav.deviceMemory ?? 8;
  const params = new URLSearchParams(window.location.search);
  const forced = params.get('quality');
  if (forced === 'low' || forced === 'high') return forced;
  return cores <= 4 || memory <= 4 ? 'low' : 'high';
}

function storedQuality(): Quality | null {
  const s = read('maist.quality');
  return s === 'low' || s === 'high' ? s : null;
}

export const settings = {
  quality: storedQuality() ?? detectQuality(),
  muted: read('maist.muted') === '1',
  reducedMotion: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  onboarded: read('maist.onboarded') === '1',

  setQuality(q: Quality) {
    this.quality = q;
    write('maist.quality', q);
  },
  setMuted(m: boolean) {
    this.muted = m;
    write('maist.muted', m ? '1' : '0');
  },
  setOnboarded() {
    this.onboarded = true;
    write('maist.onboarded', '1');
  },
  get particleCap(): number {
    if (this.reducedMotion) return 8;
    return this.quality === 'low' ? 16 : 60;
  },
};

/** Light haptic tick on phones that support it. */
export function buzz(ms = 12): void {
  if (settings.reducedMotion) return;
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* not supported */
  }
}
