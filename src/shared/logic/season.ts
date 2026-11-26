/**
 * Season calendar. Night 1 is SEASON_START (UTC); one night unlocks per UTC day.
 * Set SEASON_START to the day the first daily post goes live.
 */
export const SEASON_START = '2026-11-26';
export const SEASON_NIGHTS = 30;

const DAY_MS = 86_400_000;

function utcDay(d: Date): number {
  return Math.floor(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) / DAY_MS);
}

/** Tonight's night number (1..30), 0 before the season starts, 31+ after it ends. */
export function nightFor(date: Date, start = SEASON_START): number {
  return utcDay(date) - utcDay(new Date(`${start}T00:00:00Z`)) + 1;
}

/**
 * The Daily Heist's night number: Night 1 is SEASON_START and every UTC day after it is a new night,
 * with no end (never clamped to SEASON_NIGHTS). Days before the start count as Night 1.
 */
export function nightNumber(date = new Date(), start = SEASON_START): number {
  return Math.max(1, nightFor(date, start));
}

/** Tonight's night, clamped to the 30-night season (the 3D game's Dream Archive). */
export function currentNight(date = new Date(), start = SEASON_START): number {
  return Math.max(1, Math.min(SEASON_NIGHTS, nightFor(date, start)));
}

export type ArchiveStatus = 'tonight' | 'archive' | 'locked';

/** Dream Archive: past nights can be replayed (practice only); future nights are locked. */
export function archiveStatus(night: number, date = new Date(), start = SEASON_START): ArchiveStatus {
  const today = nightFor(date, start);
  if (night === today) return 'tonight';
  return night < today && night >= 1 ? 'archive' : 'locked';
}

/** Archive runs never count for the leaderboard or the streak. */
export function countsForRanking(night: number, date = new Date(), start = SEASON_START): boolean {
  return archiveStatus(night, date, start) === 'tonight';
}

/** Milliseconds until the next dream (next UTC midnight). */
export function msUntilNextDream(date = new Date()): number {
  return (utcDay(date) + 1) * DAY_MS - date.getTime();
}
