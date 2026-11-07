// Progression: daily challenges + streak, rank, ⭐ special quests, the other cat friends.
import { start, check } from './lib.mjs';

// Complete one quest-like entry {q, stage, prog} through the real progress hooks.
const COMPLETE = (g) => {
  const C = window.__cat, Q = C.quests;
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
    const b = C.cat.body, keep = [b.x, b.y, b.z];
    for (const p of g.spots) { const pt = C.world.pts[p]; b.x = pt.x; b.y = pt.y; b.z = pt.z; Q.tick(); }
    [b.x, b.y, b.z] = keep;
  }
};

const h = await start();
await h.play();
await h.wait(600);

// ---------- daily challenges ----------
const daily = await h.ev(() => {
  const C = window.__cat;
  const titles = (d) => C.progressApi.dailyFor(d).map((q) => q.kind + ':' + q.goal + ':' + q.title.id);
  const a = titles('2026-11-07'), b = titles('2026-11-07'), c = titles('2026-11-08');
  return { a, b, c };
});
check('daily: 3 per day', daily.a.length === 3);
check('daily: same date = same challenges', JSON.stringify(daily.a) === JSON.stringify(daily.b), daily.a.join(' | '));
check('daily: another date = different', JSON.stringify(daily.a) !== JSON.stringify(daily.c), daily.c.join(' | '));
check('daily: 3 different kinds', new Set(daily.a.map((t) => t.split(':')[0])).size === 3);
{
  // many dates: every daily challenge is completable through the hooks
  const r = await h.ev((COMPLETE) => {
    const C = window.__cat, D = C.save.daily, fails = [];
    const complete = eval('(' + COMPLETE + ')');
    for (let d = 1; d <= 20; d++) {
      C.dateOverride = '2027-01-' + String(d).padStart(2, '0');
      C.progress.ensureDay(true);
      for (const e of D.list) complete(e.q);
      C.day.timeLeft = C.day.len;
      if (!D.list.every((e) => e.stage === 'done')) fails.push(C.dateOverride + ' ' + D.list.filter((e) => e.stage !== 'done').map((e) => e.q.kind + JSON.stringify(e.prog)).join(','));
    }
    return { fails, streak: D.streak, best: D.best, total: D.total };
  }, COMPLETE.toString());
  check('daily: 60 challenges completable', r.fails.length === 0, r.fails.join(' | '));
  check('streak counts consecutive full days', r.streak === 20 && r.best === 20, JSON.stringify(r));
}
// reset to a clean state for the streak rules
await h.ev(() => {
  const C = window.__cat, D = C.save.daily;
  Object.assign(D, { date: '', list: [], streak: 0, best: 0, lastFull: '', total: 0 });
  delete C.save.owned['neck:syalApi'];
  C.save.rank = { n: 0, lv: 0 };
  C.ui.rank();
});
const streakDay = async (date, finish = 3) =>
  h.ev(([date, finish, COMPLETE]) => {
    const C = window.__cat, D = C.save.daily;
    const complete = eval('(' + COMPLETE + ')');
    C.dateOverride = date;
    C.progress.ensureDay(true);
    D.list.slice(0, finish).forEach((e) => complete(e.q));
    C.day.timeLeft = C.day.len;
    return { streak: D.streak, shown: C.progress.streak(), done: C.progress.dailyDone(), coins: C.save.coins };
  }, [date, finish, COMPLETE.toString()]);
let s = await streakDay('2026-11-01');
check('day 1 all done -> streak 1', s.streak === 1 && s.done === 3, JSON.stringify(s));
s = await streakDay('2026-11-02', 2);
check('only 2 of 3 -> streak stays 1', s.streak === 1 && s.done === 2, JSON.stringify(s));
s = await streakDay('2026-11-03', 0);
check('missed a day -> streak shown as 0', s.shown === 0, JSON.stringify(s));
s = await streakDay('2026-11-04');
check('after a missed day the streak starts again at 1', s.streak === 1, JSON.stringify(s));
for (const d of ['05', '06', '07', '08', '09']) s = await streakDay('2026-11-' + d);
check('6 days -> no flame scarf yet', s.streak === 6 && !(await h.ev(() => window.__cat.save.owned['neck:syalApi'])), JSON.stringify(s));
s = await streakDay('2026-11-10');
await h.wait(1800);
check('7-day streak grants the flame scarf', s.streak === 7 && (await h.ev(() => !!window.__cat.save.owned['neck:syalApi'])));
check('daily completions count toward rank', (await h.ev(() => window.__cat.save.rank.n)) >= 20);
check('crossing month boundary keeps streak', await h.ev(() => window.__cat.progressApi.dayBefore('2026-12-01') === '2026-11-30' && window.__cat.progressApi.dayBefore('2027-01-01') === '2026-12-31'));

// screenshot the daily panel (today's real date)
await h.ev(() => { window.__cat.dateOverride = null; window.__cat.ui.resume(); });
await h.ev(() => window.__cat.progress.ensureDay(true));
await h.ev(() => { const D = window.__cat.save.daily; const e = D.list[0]; if (e.q.type === 'fish') window.__cat.quests.onFish(e.q.fish || 'mas'); });
await h.page.click('#btnDaily');
await h.wait(500);
check('daily panel opens with 3 challenges', (await h.ev(() => document.querySelectorAll('.dch').length)) === 3);
check('panel shows rank + streak', await h.ev(() => !!document.querySelector('.rk') && !!document.querySelector('.streak')));
await h.shot('progress-daily-landscape');
await h.page.click('#dBack');
await h.wait(300);

// ---------- rank ----------
const rk = await h.ev(() => {
  const C = window.__cat;
  C.save.rank = { n: 3, lv: 0 };
  C.ui.rank();
  const before = document.getElementById('rankChip').textContent;
  C.progress.addDone(1);
  const mid = C.save.rank.lv;
  C.progress.addDone(1);
  return { before, mid, lv: C.save.rank.lv, chip: document.getElementById('rankChip').textContent, banner: document.getElementById('banner').textContent };
});
check('rank starts as Kucing Kampung', rk.before.includes('Kucing Kampung'), rk.before);
check('rank up after 5 completions', rk.mid === 0 && rk.lv === 1 && rk.chip.includes('Kucing Gang'), JSON.stringify(rk));
check('rank up banner', rk.banner.includes('Naik peringkat'), rk.banner);
check('later ranks need more', await h.ev(() => { const R = window.__cat.progressApi.RANKS; return R.length === 6 && R[5].name.id === 'Legenda Kompleks' && R[5].at - R[4].at > R[1].at - R[0].at; }));
await h.wait(300);
await h.shot('progress-rank-hud');

// ---------- cat friends: hidden before unlocks ----------
const hidden = await h.ev(() => {
  const C = window.__cat;
  return C.progress.givers.map((g) => ({ id: g.id, vis: g.npc.model.root.visible, mark: g.mark(), en: g.open() }));
});
check('friends hidden before unlocks', hidden.every((g) => !g.vis && !g.en && g.mark === ''), JSON.stringify(hidden));
const atBelang = await h.tp(1.8 + 1.2, 3.6, -15.2, -Math.PI / 2, 400);
check('Si Belang not talkable before roof unlock', atBelang !== 'belang', String(atBelang));

// walk Lisa's main chain via the save, then unlock both areas
await h.ev(() => {
  const C = window.__cat;
  C.save.quest = { idx: 6, stage: 'offer', prog: {}, gen: null, recent: [] };
  C.save.metLisa = true;
  C.save.unlocked.pasar = true;
  C.save.unlocked.atap = true;
  C.quests.applyUnlocks(false);
  C.ui.quest();
});
await h.wait(500);
const shown = await h.ev(() => window.__cat.progress.givers.map((g) => ({ id: g.id, vis: g.npc.model.root.visible, mark: g.mark() })));
check('friends appear with ! after unlocks', shown.every((g) => g.vis && g.mark === '!'), JSON.stringify(shown));

// Lisa: accept a bonus quest first so we can check friends don't disturb it
const talkLisa = async () => {
  await h.tp(-11.9, 0, 22.5, -Math.PI / 2, 300);
  await h.key('KeyE', 500);
  for (let k = 0; k < 4; k++) { await h.dialogs(); await h.wait(300); }
  return h.ev(() => window.__cat.save.quest);
};
let lq = await talkLisa();
check('Lisa bonus quest active', lq.stage === 'active' && !!lq.gen);
const lisaBefore = JSON.stringify(lq.gen);

const FRIEND = {
  belang: { at: [1.8 + 1.1, 3.6, -15.2, -Math.PI / 2] },
  mpus: { at: [35.2, 0, 12.9 + 1.3, Math.PI] },
};
const talkFriend = async (id) => {
  const [x, y, z, yaw] = FRIEND[id].at;
  const before = await h.ev((id) => window.__cat.save.givers[id].stage, id);
  let near;
  for (let a = 0; a < 3; a++) {
    // the cat may be busy (hug, carry) under a slow headless GPU: retry the talk
    await h.ev(() => { const C = window.__cat; if (C.cat.carrying && C.cat.carrying.id !== 'ikan_pasar') C.cat.carrying = null; C.cat.setState('free'); });
    near = await h.tp(x, y, z, yaw, 900);
    await h.key('KeyE', 500);
    for (let k = 0; k < 4; k++) { await h.dialogs(); await h.wait(300); }
    if ((await h.ev((id) => window.__cat.save.givers[id].stage, id)) !== before) break;
  }
  return { near, st: await h.ev((id) => window.__cat.save.givers[id], id) };
};
for (const id of ['belang', 'mpus']) {
  // the '!' screenshot (before the first talk)
  {
    const [x, y, z] = id === 'belang' ? [5.2, 3.6, -16.0] : [36.5, 0, 9.5];
    const pt = await h.ev((id) => window.__cat.world.pts[id], id);
    await h.tp(x, y, z, Math.atan2(pt.x - x, pt.z - z), 1500);
    await h.shot('progress-friend-' + id);
  }
  const fails = [];
  const kinds = [];
  for (let r = 0; r < 8; r++) {
    await h.ev(() => { window.__cat.day.timeLeft = window.__cat.day.len; window.__cat.cat.setState('free'); });
    let t = await talkFriend(id);
    if (r === 0) check(id + ': interact target is the friend', t.near === id, String(t.near));
    if (t.st.stage !== 'active' || !t.st.gen) { fails.push(r + ' not accepted ' + JSON.stringify(t.st).slice(0, 200)); break; }
    kinds.push(t.st.gen.kind);
    if (r === 0) {
      check(id + ': card face = friend', (await h.ev(() => document.getElementById('questFace').dataset.face)) === id);
      await h.shot('progress-card-' + id);
    }
    const g = t.st.gen;
    if (g.type === 'bring') {
      // real path: steal the market fish and give it (Pak Ujang may shoo us under a slow GPU: retry)
      for (let a = 0; a < 4; a++) {
        await h.ev(() => { const u = window.__cat.npcs.find((n) => n.name === 'ujang'); u.reset(); u.body.x = 58; u.body.z = 34; u.state = 'script'; u.sync(); });
        await h.tp(31.0, 1.0, 12.7, Math.PI / 2, 300);
        await h.key('KeyE', 300);
        if (await h.ev(() => window.__cat.cat.carrying?.id === 'ikan_pasar')) break;
      }
    } else if (g.type === 'perfect') {
      await h.ev(() => { const s = window.__cat.save.givers; for (const k in s) if (s[k].stage === 'active' && s[k].gen.type === 'perfect') s[k].stage = 'ready'; });
    } else await h.ev(COMPLETE, g);
    const st = await h.ev((id) => window.__cat.save.givers[id].stage, id);
    if (st !== 'ready' && g.type !== 'bring') fails.push(g.kind + ' not ready ' + JSON.stringify(await h.ev((id) => window.__cat.save.givers[id].prog, id)));
    t = await talkFriend(id);
    if (g.type === 'bring') await h.ev(() => window.__cat.npcs.find((n) => n.name === 'ujang').reset());
    if (t.st.stage !== 'offer' || t.st.gen) fails.push(g.kind + ' not rewarded ' + t.st.stage + ' carrying=' + (await h.ev(() => window.__cat.cat.carrying?.id)));
  }
  console.log(id + ' kinds:', kinds.join(', '));
  check(id + ': 8 quests accepted + completed', fails.length === 0 && kinds.length === 8, fails.join(' | '));
  check(id + ': quest count saved', (await h.ev((id) => window.__cat.save.givers[id].n, id)) === 8);
}
const flavour = await h.ev(() => window.__cat.progressApi.GIVERS.map((g) => g.id + ':' + g.opts.kinds.join(',')));
console.log('flavours:', flavour.join(' / '));
lq = await h.ev(() => window.__cat.save.quest);
check("friends don't disturb Lisa's quest", lq.stage === 'active' || lq.stage === 'ready', lq.stage);
check("Lisa's quest object unchanged", JSON.stringify(lq.gen) === lisaBefore);
check('genQuest kinds filter respected', await h.ev(() => {
  const api = window.__cat.progressApi;
  for (let i = 0; i < 60; i++) { const q = api.genQuest([], 0, { kinds: ['eat', 'hug'] }); if (!['eat', 'hug'].includes(q.kind)) return false; }
  return true;
}));

// ---------- ⭐ special challenge ----------
await h.ev(() => {
  const C = window.__cat, s = C.save.quest;
  s.idx = 6 + 3; s.stage = 'offer'; s.prog = {}; s.gen = null;
  C.save.focus = 'lisa';
});
check('Lisa shows ⭐ before a special challenge', (await h.ev(() => window.__cat.quests.lisaMark())) === '⭐');
const ownedBefore = await h.ev(() => Object.keys(window.__cat.save.owned));
lq = await talkLisa();
check('special challenge accepted', lq.stage === 'active' && lq.gen?.special && lq.gen.title.id.startsWith('⭐'), lq.gen?.title?.id);
const reward = lq.gen.items[0];
check('special reward is an unowned special item', !!reward && !ownedBefore.includes(reward) && (await h.ev((k) => window.__cat.progressApi.SPECIAL_ITEMS().some((i) => i.slot + ':' + i.id === k), reward)), reward);
check('special card shows ⭐', (await h.ev(() => document.getElementById('questText').textContent)).includes('⭐'));
if (lq.gen.type === 'bring') { await h.tp(31.0, 1.0, 12.7, Math.PI / 2, 300); await h.key('KeyE', 300); }
else if (lq.gen.type === 'perfect') await h.ev(() => { window.__cat.save.quest.stage = 'ready'; });
else await h.ev(COMPLETE, lq.gen);
const coins0 = await h.ev(() => window.__cat.save.coins);
lq = await talkLisa();
check('special challenge grants the item', await h.ev((k) => !!window.__cat.save.owned[k], reward));
check('special also gives coins', (await h.ev(() => window.__cat.save.coins)) > coins0);
// all special items owned -> big coins instead
const fb = await h.ev(() => {
  const api = window.__cat.progressApi, C = window.__cat;
  for (const i of api.SPECIAL_ITEMS()) C.save.owned[i.slot + ':' + i.id] = true;
  const q = api.specialQuest([], 5);
  return { items: q.items.length, coins: q.coins };
});
check('all specials owned -> big coins fallback', fb.items === 0 && fb.coins >= 60, JSON.stringify(fb));
check('special items render on the cat', await h.ev(() => {
  const C = window.__cat, m = C.cat.model, look = { ...C.save.look };
  const out = [];
  for (const [slot, id] of [['head', 'topiBintang'], ['head', 'headset'], ['face', 'bintangK'], ['neck', 'pelangi'], ['neck', 'syalApi'], ['back', 'kupu']]) {
    m.setLook({ ...look, [slot]: id });
    const g = { head: m.headAcc, face: m.faceAcc, neck: m.neckAcc, back: m.backAcc }[slot];
    out.push(g.children.length > 0);
  }
  m.setLook(look);
  return out.every(Boolean);
}));

// ---------- old save migration ----------
await h.ev(() => {
  const k = 'cat-sim-sebelum-mama-pulang-v1';
  const old = JSON.parse(localStorage.getItem(k));
  delete old.daily; delete old.rank; delete old.givers; delete old.focus;
  old.quest = { idx: 15, stage: 'offer', prog: {}, gen: null, recent: [] };
  localStorage.setItem(k, JSON.stringify(old));
});
await h.page.reload();
await h.page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
const mig = await h.ev(() => { const s = window.__cat.save; return { d: s.daily.list.length, r: s.rank, g: Object.keys(s.givers), f: s.focus }; });
check('old save loads with defaults', mig.d === 3 && mig.g.length === 2 && mig.f === 'lisa', JSON.stringify(mig));
check('old save: finished bonus quests count toward rank', mig.r.n === 9 && mig.r.lv === 1, JSON.stringify(mig.r));
await h.close();

// ---------- portrait layout ----------
const p = await start({ viewport: { width: 390, height: 844 }, touch: true });
await p.play();
await p.ev(() => {
  const C = window.__cat;
  C.save.unlocked.pasar = true; C.save.unlocked.atap = true; C.quests.applyUnlocks(false);
  C.save.rank = { n: 12, lv: 2 }; C.ui.rank();
});
await p.wait(400);
await p.shot('progress-hud-portrait');
const ov = await p.ev(() => {
  const r = (id) => document.getElementById(id).getBoundingClientRect();
  const a = r('rankChip'), b = r('btnDaily'), c = r('questCard');
  return { rankRight: a.right, dailyLeft: b.left, w: innerWidth, cardRight: c.right, rankVisible: a.width > 0 };
});
check('portrait: rank chip and buttons fit', ov.rankVisible && ov.rankRight <= ov.dailyLeft + 1 && ov.cardRight <= ov.dailyLeft + 1, JSON.stringify(ov));
await p.page.tap('#btnDaily');
await p.wait(500);
await p.shot('progress-daily-portrait');
const fit = await p.ev(() => { const r = document.querySelector('.daily-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; });
check('portrait: daily panel fits the screen', fit);
await p.close();
