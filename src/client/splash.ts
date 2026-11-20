import { context, requestExpandedMode } from '@devvit/web/client';

const dive = document.getElementById('dive');
const who = document.getElementById('who');

// Expanded mode can only open from a real user gesture, so this is the one tap target in the feed.
dive?.addEventListener('click', (e) => {
  requestExpandedMode(e, 'game');
});

try {
  if (who && context?.username) who.textContent = `Diver u/${context.username}`;
} catch {
  /* outside Reddit (local preview) there is no Devvit context */
}
