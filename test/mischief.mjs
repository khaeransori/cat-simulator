// Runs every mischief once by teleporting next to it and pressing E.
import { start, check } from './lib.mjs';
const h = await start();
await h.play();
await h.ev(() => { const c = window.__cat; c.save.unlocked.pasar = c.save.unlocked.atap = true; c.quests.applyUnlocks(false); });
const spots = [
  ['gelas', -9.8, 0.86, -22.4, Math.PI / 2, 1500],
  ['pot_rumah', -6.9, 0.9, -14.6, 0, 1500],
  ['tisu', -19.0, 0, -15.5, Math.PI, 900],
  ['gorden', -20.9, 0, -16, -Math.PI / 2, 1600],
  ['laptop', -15.7, 0.85, -25.6, Math.PI, 2200],
  ['ikan_dapur', -10.0, 1.0, -26.3, -Math.PI / 2, 400, true],
  ['koran', 10.2, 0.2, -12.7, Math.PI, 1600],
  ['sandal', 7.5, 0.2, -12.2, Math.PI, 400, true],
  ['pot_tetangga', 4.0, 0.2, -12.3, 0, 1500],
  ['motor', 14.6, 0, -7.2, Math.PI, 2600],
  ['anjing', 30, 0.15, -4.4, Math.PI, 1200],
  ['gali', -3.5, 0.22, 10.5, 0, 1600],
  ['merpati_taman', -4.5, 0, 19.0, 0, 1000],
  ['pot_taman', -8.8, 1.0, 6.1, Math.PI, 1500],
  ['jemuran', 7, 3.6, -20.4, Math.PI, 1600],
  ['ikan_asin', 30, 3.6, -21.0, Math.PI, 400, true],
  ['merpati_atap', 33.5, 3.6, -17.2, Math.PI, 1000],
  ['ember', 35.6, 0, 19.6, 0, 1000],
  ['tomat', 46.8, 1.0, 14.0, 0, 1600],
  ['ikan_pasar', 31.0, 1.0, 12.7, Math.PI / 2, 400, true],
];
for (const [id, x, y, z, yaw, w, drop] of spots) {
  const cur = await h.tp(x, y, z, yaw, 400);
  await h.key('KeyE', w);
  const ok = (await h.done()).includes(id);
  check(id, ok, `nearest=${cur}`);
  if (drop) await h.key('KeyE', 1400); // eat / drop what we carry
}
await h.shot('mischief-end');
await h.close();
