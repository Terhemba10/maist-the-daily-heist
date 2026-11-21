import { context, requestExpandedMode } from '@devvit/web/client';
import type { InitResponse } from '../shared/api.ts';
import { nightInfo } from '../shared/dreams/season1.ts';
import { story } from '../shared/dreams/story.ts';
import { currentNight, msUntilNextDream, SEASON_NIGHTS } from '../shared/logic/season.ts';

const $ = (id: string) => document.getElementById(id);
const dive = $('dive');
const who = $('who');
const night = $('night');
const status = $('status');
const countdown = $('countdown');

// Expanded mode can only open from a real user gesture, so this is the one tap target in the feed.
dive?.addEventListener('click', (e) => {
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

function showNight(n: number): void {
  if (night) night.textContent = `Night ${n} of ${SEASON_NIGHTS} · ${story(nightInfo(n).dreamer).role}`;
}

let nextAt = Date.now() + msUntilNextDream();
function tick(): void {
  const s = Math.max(0, Math.floor((nextAt - Date.now()) / 1000));
  const p = (v: number) => String(v).padStart(2, '0');
  if (countdown) countdown.textContent = `Next dream in ${p(Math.floor(s / 3600))}:${p(Math.floor((s % 3600) / 60))}:${p(s % 60)}`;
}

showNight(postNight());
tick();
window.setInterval(tick, 1000);

void (async () => {
  try {
    const res = await fetch('/api/init');
    if (!res.ok) return;
    const data: InitResponse = await res.json();
    showNight(data.postNight);
    nextAt = Date.now() + data.nextDreamMs;
    if (who && data.username) who.textContent = `Diver u/${data.username}${data.streak.count ? ` · streak ${data.streak.count}` : ''}`;
    if (status) {
      if (data.postNight !== data.today) status.textContent = 'An archived dream: practice only';
      else if (data.scored) status.textContent = `You dived tonight: ${data.scored.score} points${data.scored.rank ? ` · rank #${data.scored.rank}` : ''}`;
      else status.textContent = 'Tonight’s dream is waiting';
    }
    if (dive && data.scored) dive.textContent = 'Practice or see the leaderboard';
  } catch {
    /* outside Reddit (local preview) there is no server */
  }
})();
