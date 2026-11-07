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
check('bonus quest is opt-in via talking', q.idx === 6 && q.stage === 'active' && !!q.gen);
// Walk 40 generated quests through the real progress hooks
const kinds = [];
const fails = [];
for (let r = 0; r < 40; r++) {
  await h.ev(() => (window.__cat.day.timeLeft = window.__cat.day.len));
  if (r > 0) { q = await talk(); }
  q = await h.ev(() => window.__cat.save.quest);
  const g = q.gen; if (!g) { console.log("no gen at", r, JSON.stringify(q), await h.ev(() => [window.__cat.cat.state, window.__cat.interact.current?.id, !!window.__cat.cat.carrying, window.__cat.mode])); break; } kinds.push(g.kind);
  await h.ev((g) => {
    const C = window.__cat, Q = C.quests, s = C.save;
    const any = ['gelas', 'tisu', 'laptop', 'gorden', 'koran', 'gali', 'bola', 'ember', 'tomat'];
    if (g.type === 'fish') for (let i = 0; i < g.goal; i++) Q.onFish(g.fish || 'mas');
    else if (g.type === 'gold') Q.onFish('emas');
    else if (g.type === 'set') (g.set || any).slice(0, g.goal).forEach((m) => Q.onMischief(m));
    else if (g.type === 'combo' || g.type === 'sneaky') for (let i = 0; i < g.goal; i++) Q.onMischief(any[i]);
    else if (g.type === 'event') {
      if (g.ev === 'coins') Q.onEvent('coins', g.goal);
      else if (g.ev === 'meow') ['siti', 'ujang', 'tini', 'dimas', 'putri'].slice(0, g.goal).forEach((w) => Q.onEvent('meow', 1, w));
      else for (let i = 0; i < g.goal; i++) Q.onEvent(g.ev);
    } else if (g.type === 'visit') {
      for (const p of g.spots) { const pt = C.world.pts[p]; const b = C.cat.body; b.x = pt.x; b.y = pt.y; b.z = pt.z; Q.tick(); }
    } else { s.quest.stage = 'ready'; s.quest.prog = { n: g.goal }; } // bring / perfect: chain test above covers the real path
  }, g);
  const st = await h.ev(() => window.__cat.save.quest.stage);
  if (st !== 'ready') fails.push(g.kind + ' ' + JSON.stringify(await h.ev(() => window.__cat.save.quest.prog)));
  await h.ev(() => { window.__cat.cat.setState('free'); window.__cat.day.timeLeft = window.__cat.day.len; });
  q = await talk();
  if (q.stage !== 'offer' || q.gen) fails.push(g.kind + ' not rewarded');
}
console.log('kinds:', kinds.join(', '));
check('every generated quest completable + rewarded', fails.length === 0, fails.join(' | '));
check('no kind repeats within 5 in a row', kinds.every((k, i) => !kinds.slice(Math.max(0, i - 4), i).includes(k)));
check('at least 13 different kinds seen', new Set(kinds).size >= 13, String(new Set(kinds).size));
check('sneaky resets on shoo', await h.ev(() => {
  const Q = window.__cat.quests, s = window.__cat.save;
  s.quest.gen = { id: 'gen_sneaky', kind: 'sneaky', type: 'sneaky', goal: 4, title: { id: 'x', en: 'x' }, intro: [], remind: { id: '', en: '' }, done: [], coins: 1, items: [] };
  s.quest.stage = 'active'; s.quest.prog = {};
  Q.onMischief('gelas'); Q.onMischief('tisu'); Q.onEvent('shoo'); return Q.progress().n === 0;
}));
check('meow counts each person once', await h.ev(() => {
  const Q = window.__cat.quests, s = window.__cat.save;
  s.quest.gen = { id: 'gen_meow', kind: 'meow', type: 'event', ev: 'meow', distinct: true, goal: 3, title: { id: 'x', en: 'x' }, intro: [], remind: { id: '', en: '' }, done: [], coins: 1, items: [] };
  s.quest.stage = 'active'; s.quest.prog = {};
  Q.onEvent('meow', 1, 'siti'); Q.onEvent('meow', 1, 'siti'); Q.onEvent('meow', 1, ''); return Q.progress().n === 1;
}));
check('boot does not count for normal fish quest', await h.ev(() => {
  const Q = window.__cat.quests, s = window.__cat.save;
  s.quest.gen = { id: 'gen_t', kind: 'fishAny', type: 'fish', goal: 2, title: { id: 'x', en: 'x' }, intro: [], remind: { id: '', en: '' }, done: [], coins: 1, items: [] };
  s.quest.stage = 'active'; s.quest.prog = {};
  Q.onFish('sepatu'); return Q.progress().n === 0;
}));
await h.shot('quests-alldone');
await h.shot('quests-summary');
await h.close();
