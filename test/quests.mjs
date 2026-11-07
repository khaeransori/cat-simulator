// Walks the whole Lisa quest chain (progress is injected, talking is real).
import { start, check } from './lib.mjs';
const h = await start();
await h.play();
const talk = async () => {
  await h.tp(-11.9, 0, 22.5, -Math.PI / 2, 300);
  await h.key('KeyE', 500);
  for (let k = 0; k < 4; k++) { await h.dialogs(); await h.wait(400); }
  return h.ev(() => window.__cat.save.quest);
};
let q = await talk();
check('q1 accepted', q.idx === 0 && q.stage === 'active');
await h.ev(() => { for (let i = 0; i < 3; i++) window.__cat.quests.onFish('mas'); });
q = await talk();
check('q1 done, pasar open', q.idx === 1 && (await h.ev(() => window.__cat.save.unlocked.pasar)));
await h.ev(() => ['gali', 'bola', 'pot_taman'].forEach((m) => window.__cat.quests.onMischief(m)));
q = await talk();
check('q2 done', q.idx === 2);
await h.tp(31.0, 1.0, 12.7, Math.PI / 2, 300);
await h.key('KeyE', 300);
await h.tp(-11.9, 0, 22.5, -Math.PI / 2, 400);
check('give label', (await h.ev(() => document.getElementById('actLbl').textContent)) === 'Kasih');
await h.key('KeyE', 500);
for (let k = 0; k < 4; k++) { await h.dialogs(); await h.wait(400); }
q = await h.ev(() => window.__cat.save.quest);
check('q3 done, roof open', q.idx === 3 && (await h.ev(() => window.__cat.save.unlocked.atap)));
await h.ev(() => ['jemuran', 'ikan_asin'].forEach((m) => window.__cat.quests.onMischief(m)));
q = await talk();
check('q4 done', q.idx === 4);
await h.ev(() => window.__cat.quests.onFish('emas'));
q = await talk();
check('q5 done', q.idx === 5);
await h.ev(() => { const d = window.__cat.day; 'abcdefgh'.split('').forEach((x) => d.doneToday.add(x)); });
await h.tp(-19.5, 0, -15.0, Math.PI, 400);
await h.key('KeyE', 500);
await h.page.click('#cYes');
for (let k = 0; k < 10; k++) { await h.wait(1200); await h.dialogs(); if (await h.page.$('#sNext')) break; }
q = await h.ev(() => window.__cat.save.quest);
check('q6 ready after a perfect day', q.idx === 5 && q.stage === 'ready');
await h.page.click('#sNext');
await h.wait(700);
{ const sk = await h.page.$('#skipBtn:not([hidden])'); if (sk) await sk.click(); }
await h.wait(700);
await h.dialogs();
await h.page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 });
q = await talk();
check('q6 done, no auto bonus quest', q.idx === 6 && q.stage === 'offer');
const card = await h.ev(() => document.getElementById('questText').textContent);
check('card says all done', card.includes('Semua quest Lisa selesai'));
check('no ! over Lisa', (await h.ev(() => window.__cat.quests.lisaMark())) === '');
check('no arrow to Lisa', (await h.ev(() => window.__cat.quests.targetPoint())) === null);
q = await talk();
check('bonus fish is opt-in via talking', q.idx === 6 && q.stage === 'active');
await h.ev(() => { for (let i = 0; i < 2; i++) window.__cat.quests.onFish('mas'); });
q = await talk();
check('bonus done, back to all-done', q.idx === 7 && q.stage === 'offer');
await h.shot('quests-alldone');
await h.shot('quests-summary');
await h.close();
