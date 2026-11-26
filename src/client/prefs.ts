/**
 * Display preferences for the Daily Heist, shared by the game and the feed card.
 * Saved per player in browser storage (every access guarded: storage can be blocked).
 */
export type ThemePref = 'system' | 'light' | 'dark';
export type SmoothPref = 'auto' | 'on' | 'off';
export type Prefs = { theme: ThemePref; ghost: boolean; bigText: boolean; smooth: SmoothPref };

const KEY = 'heist.prefs';
/** The game is white (light) unless the player picks Dark or System in Settings. */
const DEFAULT_THEME: ThemePref = 'light';

function read(): Prefs {
  const base: Prefs = { theme: DEFAULT_THEME, ghost: true, bigText: false, smooth: 'auto' };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return base;
    const v: unknown = JSON.parse(raw);
    if (typeof v !== 'object' || v === null) return base;
    const theme = 'theme' in v ? v.theme : undefined;
    return {
      theme: theme === 'light' || theme === 'dark' || theme === 'system' ? theme : DEFAULT_THEME,
      ghost: 'ghost' in v && typeof v.ghost === 'boolean' ? v.ghost : base.ghost,
      bigText: 'bigText' in v && typeof v.bigText === 'boolean' ? v.bigText : base.bigText,
      smooth: 'smooth' in v && (v.smooth === 'on' || v.smooth === 'off') ? v.smooth : 'auto',
    };
  } catch {
    return base;
  }
}

export const prefs: Prefs = read();

export function savePrefs(patch: Partial<Prefs>): void {
  Object.assign(prefs, patch);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(prefs));
  } catch {
    /* keep the in-memory value */
  }
  applyPrefs();
}

const media = (() => {
  try {
    return window.matchMedia('(prefers-color-scheme: light)');
  } catch {
    return null;
  }
})();

/** The theme actually shown: the saved choice, or the system setting. */
export function activeTheme(): 'light' | 'dark' {
  if (prefs.theme !== 'system') return prefs.theme;
  return media?.matches ? 'light' : 'dark';
}

/** Low-end phone: 4 GB of memory or less, or 4 CPU cores or fewer. */
export function lowEndDevice(): boolean {
  try {
    const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
    const cores = navigator.hardwareConcurrency;
    return (typeof mem === 'number' && mem > 0 && mem <= 4) || (typeof cores === 'number' && cores > 0 && cores <= 4);
  } catch {
    return false;
  }
}

/**
 * Smooth mode: no light rays or dust, no idle animations, smaller images, simpler shadows.
 * On automatically on low-end phones; the player can force it on or off in Settings.
 */
export function smoothActive(): boolean {
  return prefs.smooth === 'auto' ? lowEndDevice() : prefs.smooth === 'on';
}

export function applyPrefs(): void {
  const root = document.documentElement;
  root.dataset.theme = activeTheme();
  root.classList.toggle('big-text', prefs.bigText);
  root.classList.toggle('smooth', smoothActive());
}

// Follow the system theme live while the player hasn't picked one.
media?.addEventListener?.('change', () => {
  if (prefs.theme === 'system') applyPrefs();
});

applyPrefs();
