import { context, requestExpandedMode } from '@devvit/web/client';
import type { HeistInit } from '../shared/heist/api.ts';
import { ART, isArtName } from './art/index.ts';
import './prefs.ts'; // applies the saved or system light/dark theme
import { currentNight, msUntilNextDream } from '../shared/logic/season.ts';

const $ = (id: string) => document.getElementById(id);
const go = $('go');
const who = $('who');
const night = $('night');
const status = $('status');
const countdown = $('countdown');
const crews = $('crews');

// The hero scene: crew sneaking past a sleeping bot to the vault (inline SVG, no requests).
for (const el of document.querySelectorAll<HTMLElement>('[data-art]')) {
  const name = el.dataset.art;
  if (isArtName(name)) el.innerHTML = ART[name];
}

// Expanded mode can only open from a real user gesture, so this is the one tap target in the feed.
go?.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

function postNight(): number {
  try {
    const n = Number(context?.postData?.night ?? 0);
    return n >= 1 ? n : currentNight();
  } catch {
    return currentNight();
  }
}

if (night) night.textContent = `MAIST · NIGHT ${postNight()}`;

let nextAt = Date.now() + msUntilNextDream();
function tick(): void {
  const s = Math.max(0, Math.floor((nextAt - Date.now()) / 1000));
  const p = (v: number) => String(v).padStart(2, '0');
  if (countdown) countdown.textContent = `New maps in ${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}
tick();
window.setInterval(tick, 1000);

void (async () => {
  try {
    const res = await fetch('/api/init');
    if (!res.ok) return;
    const data: HeistInit = await res.json();
    nextAt = Date.now() + data.nextMs;
    if (crews && data.crews > 0) crews.textContent = `🔥 ${data.crews} crew${data.crews === 1 ? '' : 's'} played tonight`;
    if (who && data.username) who.textContent = `u/${data.username}${data.streak.count ? ` · 🔥 ${data.streak.count}` : ''}`;
    if (status) {
      if (data.postNight !== data.today) status.textContent = 'An older night: practice only';
      else if (data.scored) status.textContent = `Your heist: ${data.scored.score} pts${data.scored.rank ? ` · rank #${data.scored.rank}` : ''}`;
      else status.textContent = 'Tonight’s vaults are waiting';
    }
    if (go && data.scored) go.textContent = 'Practice or see the leaderboard';
  } catch {
    /* outside Reddit there is no server */
  }
})();
