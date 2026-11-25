/**
 * Display preferences for the Daily Heist, shared by the game and the feed card.
 * Saved per player in browser storage (every access guarded: storage can be blocked).
 */
export type ThemePref = 'system' | 'light' | 'dark';
export type Prefs = { theme: ThemePref; ghost: boolean; bigText: boolean };

const KEY = 'heist.prefs';
/** The game is white (light) unless the player picks Dark or System in Settings. */
const DEFAULT_THEME: ThemePref = 'light';

function read(): Prefs {
  const base: Prefs = { theme: DEFAULT_THEME, ghost: true, bigText: false };
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

export function applyPrefs(): void {
  const root = document.documentElement;
  root.dataset.theme = activeTheme();
  root.classList.toggle('big-text', prefs.bigText);
}

// Follow the system theme live while the player hasn't picked one.
media?.addEventListener?.('change', () => {
  if (prefs.theme === 'system') applyPrefs();
});

applyPrefs();
