import type { DreamResponse, GhostResponse, InitResponse, LeaderboardResponse, PlayerSettings, RunRequest, RunResponse, ShareResponse } from '../../shared/api.ts';

/**
 * Thin client for our Devvit server. Outside Reddit (local preview) every call fails quietly and the
 * game runs in practice mode.
 */
async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const res = await fetch(`/api/${path}`, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('json')) return null;
    const data: T = await res.json();
    return data;
  } catch {
    return null;
  }
}

const post = <T>(path: string, body: unknown) => call<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const api = {
  init: () => call<InitResponse>('init'),
  dream: (night: number) => call<DreamResponse>(`dream?night=${night}`),
  run: (req: RunRequest) => post<RunResponse>('run', req),
  leaderboard: (night: number, board: string) => call<LeaderboardResponse>(`leaderboard?night=${night}&board=${board}`),
  share: () => post<ShareResponse>('share', {}),
  vote: (option: string) => post<{ ok: boolean; counts: Record<string, string> }>('vote', { option }),
  settings: (settings: PlayerSettings) => post<{ ok: boolean }>('settings', { settings }),
  ghost: (q: string) => call<GhostResponse>(`ghost?${q}`),
};
