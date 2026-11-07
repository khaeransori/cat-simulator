// Collection album + fishing spots: every spot is reachable and fishable, locked spots stay
// closed, catches fill the album (best size), stickers unlock with a toast/banner, set
// rewards are paid once, quests use reachable fish, old saves load, album tabs render.
import { start, check } from './lib.mjs';

const SEATS = {
  kolam: [-17.9, 0.3, 25, -Math.PI / 2, 'fishing'],
  got: [-4, 0.15, 4.6, Math.PI, 'fishing_got'],
  bak: [26, 0, 30.2, 0, 'fishing_bak'],
  tong: [25.5, 3.6, -22.6, Math.PI, 'fishing_tong'],
};
const h = await start();
await h.play();

const stopFishing = async () => {
  await h.ev(() => (window.__cat.fishing.exitReq = true));
  await h.wait(400);
};
// play the real minigame at a spot: wait -> bite -> reel -> stop the marker in the green zone
const fishAt = async (id) => {
  const [x, y, z, yaw, iid] = SEATS[id];
  await h.dialogs();
  let near = await h.tp(x, y, z, yaw, 500);
  if (near !== iid) {
    console.log('  (retry tp)', await h.ev(() => [window.__cat.cat.state, window.__cat.dialogOpen, window.__cat.mode, window.__cat.paused, window.__cat.cat.body.x.toFixed(2), window.__cat.cat.body.y.toFixed(2)]));
    await h.dialogs();
    near = await h.tp(x, y, z, yaw, 600);
  }
  check(`${id}: interact id`, near === iid, String(near));
  await h.dialogs();
  await h.key('KeyE', 400);
  if (!(await h.ev(() => window.__cat.fishing.active))) {
    console.log('  (retry E)', await h.ev(() => [window.__cat.cat.state, window.__cat.interact.current?.id, window.__cat.dialogOpen, window.__cat.mode, window.__cat.paused]));
    await h.tp(x, y, z, yaw, 400);
    await h.key('KeyE', 400);
  }
  const st = await h.ev(() => ({ a: window.__cat.fishing.active, s: window.__cat.fishing.spot.id, st: window.__cat.cat.state }));
  check(`${id}: fishing starts`, st.a && st.s === id && st.st === 'fish', JSON.stringify(st));
  await h.ev(() => { const f = window.__cat.fishing; f.t = 0; f.waitFor = 0.05; });
  await h.page.waitForFunction(() => window.__cat.fishing.phase === 'bite', null, { timeout: 8000 });
  const hooked = await h.ev(() => window.__cat.fishing.hooked.id);
  await h.ev(() => (window.__cat.fishing.t = -30)); // headless frames are slow: keep the bite open
  await h.key('KeyE', 100);
  await h.page.waitForFunction(() => window.__cat.fishing.phase === 'reel', null, { timeout: 8000 });
  await h.ev(() => { const f = window.__cat.fishing; f.speed = 0; f.marker = f.zoneC; });
  await h.wait(100);
  const before = await h.ev((k) => window.__cat.save.fish[k] || 0, hooked);
  await h.key('KeyE', 500);
  const after = await h.ev((k) => window.__cat.save.fish[k] || 0, hooked);
  const spotOk = await h.ev((k) => window.__catDev.FBY[k].spot, hooked);
  check(`${id}: caught ${hooked} from this spot's table`, after === before + 1 && spotOk === id, `${before}->${after} spot=${spotOk}`);
  await h.shot('album_spot_' + id);
  await stopFishing();
  return hooked;
};

// ---- locked spots before unlock ----
for (const id of ['bak', 'tong']) {
  const [x, y, z, yaw, iid] = SEATS[id];
  const en = await h.ev((k) => window.__catDev.SPOTS.find((s) => s.id === k).unlocked(), id);
  // teleport straight there (the gates would block walking in)
  const near = await h.tp(x, y, z, yaw, 400);
  check(`${id}: locked before unlock`, !en && near !== iid, `unlocked=${en} near=${near}`);
}
const avail0 = await h.ev(() => window.__catDev.fishAvailable().map((f) => f.spot));
check('quest fish only from open spots', avail0.length > 0 && avail0.every((s) => s === 'kolam' || s === 'got'), [...new Set(avail0)].join(','));
for (let i = 0; i < 12; i++) {
  const q = await h.ev(() => window.__catDev.genKind('fishKind'));
  const sp = await h.ev((k) => window.__catDev.FBY[k].spot, q.fish);
  if (!['kolam', 'got'].includes(sp) || q.fish === 'emas' || !q.target) { check('fishKind picks reachable fish', false, q.fish + ' ' + q.target); break; }
  if (i === 11) check('fishKind picks reachable fish + spot target', true);
}

// ---- reachable spots, real minigame ----
await fishAt('kolam');
await fishAt('got');
await h.ev(() => { const C = window.__cat; C.save.unlocked.pasar = true; C.save.unlocked.atap = true; C.quests.applyUnlocks(false); });
await fishAt('bak');
await fishAt('tong');
const avail1 = await h.ev(() => [...new Set(window.__catDev.fishAvailable().map((f) => f.spot))].sort().join(','));
check('quest fish include unlocked spots', avail1 === 'bak,got,kolam,tong', avail1);

// ---- quest target arrow points to the right spot ----
const tgt = await h.ev(() => {
  const C = window.__cat, D = window.__catDev;
  const keep = JSON.stringify(C.save.quest);
  const out = {};
  for (const k of ['cupang', 'nila', 'koi', 'mas']) {
    let q;
    for (let i = 0; i < 80 && (!q || q.fish !== k); i++) q = D.genKind('fishKind');
    C.save.quest = { idx: 99, stage: 'active', prog: {}, gen: q, recent: [] };
    C.cat.body.y = 0;
    const p = C.quests.targetPoint();
    C.quests.onFish(k);
    out[k] = { t: q.target, x: Math.round(p.x), z: Math.round(p.z), n: C.save.quest.prog.n || 0, st: C.save.quest.stage };
  }
  C.save.quest = JSON.parse(keep);
  return out;
});
check('quest arrow: got', tgt.cupang.t === 'spot_got' && tgt.cupang.x === -4 && tgt.cupang.z === 4, JSON.stringify(tgt.cupang));
check('quest arrow: bak', tgt.nila.t === 'spot_bak' && tgt.nila.x === 26 && tgt.nila.z === 31, JSON.stringify(tgt.nila));
check('quest arrow: tong via crates', tgt.koi.t === 'spot_tong' && tgt.koi.x === -2 && tgt.koi.z === -14, JSON.stringify(tgt.koi));
check('quest arrow: pond', tgt.mas.t === 'dock' && tgt.mas.x === -18, JSON.stringify(tgt.mas));
check('quest onFish counts new fish', ['cupang', 'nila', 'koi', 'mas'].every((k) => tgt[k].n >= 1 || tgt[k].st === 'ready'), JSON.stringify(Object.values(tgt).map((v) => v.n)));

// ---- forced catches: album + best size + badges ----
await h.ev(() => { const C = window.__cat; C.save.album.news = []; C.ui.albumDot(); document.getElementById('toasts').innerHTML = ''; });
const dot0 = await h.ev(() => document.getElementById('btnAlbum').classList.contains('dot'));
const r1 = await h.ev(() => {
  const C = window.__cat, F = window.__catDev.FBY, s = C.save;
  delete s.fish.cupangRaja; delete s.album.badges.firstRare; delete s.album.badges.set_got;
  C.fishing.caught(F.cupangRaja, 8.2);
  const toasts = [...document.querySelectorAll('#toasts .toast')].map((t) => t.textContent);
  return { n: s.fish.cupangRaja, best: s.fishBest.cupangRaja, news: [...s.album.news], toasts, rare: !!s.album.badges.firstRare, dot: document.getElementById('btnAlbum').classList.contains('dot'), banner: document.getElementById('banner').textContent + ' ' + C.ui.bannerQueue.map((b) => b.title + ' ' + b.sub).join(' ') };
});
check('rare catch counted + best size', r1.n === 1 && r1.best === 8.2, JSON.stringify(r1));
check('album toast for new entry', r1.toasts.some((t) => t.includes('album') && t.includes('Cupang Raja')), r1.toasts.join(' | '));
check('red dot on album button', !dot0 && r1.dot);
check('rare banner shown', r1.banner.includes('langka'), r1.banner);
check('sticker "first rare" unlocked', r1.rare && r1.news.includes('b:firstRare'));
const r2 = await h.ev(() => {
  const C = window.__cat, F = window.__catDev.FBY, s = C.save;
  C.fishing.caught(F.cupangRaja, 7.1);
  const a = s.fishBest.cupangRaja;
  C.fishing.caught(F.cupangRaja, 10.4);
  return [a, s.fishBest.cupangRaja, s.fish.cupangRaja];
});
check('best size only grows', r2[0] === 8.2 && r2[1] === 10.4 && r2[2] === 3, JSON.stringify(r2));
await h.shot('album_rare_banner');

// full set of a spot -> reward once
const set = await h.ev(() => {
  const C = window.__cat, F = window.__catDev.FBY, s = C.save;
  for (const k of ['cupang', 'berudu', 'sandalJepit']) delete s.fish[k];
  delete s.album.badges.set_got;
  const c0 = s.coins;
  C.fishing.caught(F.cupang, 5);
  C.fishing.caught(F.berudu, 3);
  const c1 = s.coins;
  C.fishing.caught(F.sandalJepit, 22);
  const c2 = s.coins;
  C.album.check();
  C.fishing.caught(F.cupang, 5);
  const c3 = s.coins;
  return { c0, c1, c2, c3, got: !!s.album.badges.set_got };
});
// cupang 2 + berudu 2 ... sandal 0 coins + set bonus 30 ; the extra cupang +2 only
check('full spot set rewarded once', set.got && set.c2 - set.c1 >= 30 && set.c3 - set.c2 === 2, JSON.stringify(set));

// big reward: all rare fish -> cosmetic
const big = await h.ev(() => {
  const C = window.__cat, F = window.__catDev.FBY, s = C.save;
  delete s.owned['neck:mutiara'];
  for (const f of Object.values(F)) if (f.rare && !s.fish[f.id]) C.fishing.caught(f, f.cm[0]);
  const own1 = !!s.owned['neck:mutiara'];
  const c = s.coins;
  C.album.check();
  return { own1, badge: !!s.album.badges.allRare, same: s.coins === c };
});
check('all rare fish -> pearl necklace once', big.own1 && big.badge && big.same, JSON.stringify(big));

// mischief area set
const mis = await h.ev(() => {
  const C = window.__cat, s = C.save;
  delete s.album.badges.area_atap;
  for (const k of ['jemuran', 'ikan_asin', 'merpati_atap']) s.mischief[k] = s.mischief[k] || 0;
  s.mischief.jemuran = 1; s.mischief.ikan_asin = 1; s.mischief.merpati_atap = 1;
  const c = s.coins;
  C.album.check();
  return { b: !!s.album.badges.area_atap, d: s.coins - c };
});
check('mischief area set sticker', mis.b && mis.d >= 20, JSON.stringify(mis));
await h.wait(300);

// ---- album screens ----
const shots = async (tag) => {
  for (const [t, btn] of [['m', 'tM'], ['f', 'tF'], ['b', 'tB']]) {
    await h.page.click('#' + btn);
    await h.wait(300);
    const ov = await h.ev(() => {
      const p = document.querySelector('.book-panel').getBoundingClientRect();
      return { w: p.width, h: p.height, ok: p.left >= 0 && p.right <= innerWidth + 1 && p.bottom <= innerHeight + 1, cards: document.querySelectorAll('.book-body .mcard, .book-body .sticker').length };
    });
    check(`album tab ${t} renders (${tag})`, ov.ok && ov.cards > 0, JSON.stringify(ov));
    await h.shot(`album_${tag}_${t}`);
  }
};
await h.page.click('#btnAlbum');
await h.wait(400);
check('album opens from HUD (paused)', await h.ev(() => window.__cat.paused && !!document.querySelector('.book-panel')));
const tabs = await h.ev(() => [...document.querySelectorAll('.book-panel .tab')].map((b) => b.textContent.trim()));
check('three tabs with %', tabs.length === 3 && tabs.every((t) => /%/.test(t)), tabs.join(' | '));
await shots('land');
const newsLeft = await h.ev(() => window.__cat.save.album.news.length);
check('seen tabs clear the red dot', newsLeft === 0, String(newsLeft));
await h.page.click('#bBack');
await h.wait(300);
check('back resumes play', await h.ev(() => !window.__cat.paused && document.getElementById('screen').hidden));
check('dot cleared', !(await h.ev(() => document.getElementById('btnAlbum').classList.contains('dot'))));
const saved = await h.ev(() => localStorage.getItem('cat-sim-sebelum-mama-pulang-v1'));
await h.close();

// ---- portrait + old save migration ----
const p = await start({ viewport: { width: 390, height: 844 }, touch: true });
await p.ev(() => {
  // an old save: fish counts but no fishBest/album keys
  const old = JSON.parse(localStorage.getItem('cat-sim-sebelum-mama-pulang-v1') || 'null');
  void old;
}, null);
await p.ev((raw) => {
  const s = JSON.parse(raw);
  localStorage.setItem('album-test-full', raw);
  const old = { v: 1, name: 'Meong', coins: 40, fish: { kecil: 12, mas: 3, sepatu: 1 }, mischief: { gelas: 2, tisu: 1 }, stats: { perfectDays: 0, caught: 0, onTime: 0, fishTotal: 16 }, firstRun: false, metLisa: true, day: 4 };
  localStorage.setItem('cat-sim-sebelum-mama-pulang-v1', JSON.stringify(old));
  void s;
}, saved);
await p.page.reload();
await p.page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
const mig = await p.ev(() => { const s = window.__cat.save; return { fish: s.fish, best: s.fishBest, b: Object.keys(s.album.badges).sort(), coins: s.coins, dot: document.getElementById('mBook').classList.contains('dot') }; });
check('old save keeps fish counts', mig.fish.kecil === 12 && mig.fish.mas === 3 && mig.fish.sepatu === 1, JSON.stringify(mig.fish));
check('old save gets earned stickers', ['firstFish', 'fish10', 'firstMischief'].every((k) => mig.b.includes(k)) && !mig.b.includes('fish50'), mig.b.join(','));
check('old save: red dot on menu album', mig.dot);
// full save for the portrait screenshots
await p.ev(() => localStorage.setItem('cat-sim-sebelum-mama-pulang-v1', localStorage.getItem('album-test-full')));
await p.page.reload();
await p.page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
await p.page.click('#mBook');
await p.wait(400);
for (const [t, btn] of [['m', 'tM'], ['f', 'tF'], ['b', 'tB']]) {
  await p.page.click('#' + btn);
  await p.wait(300);
  const ov = await p.ev(() => {
    const el = document.querySelector('.book-panel').getBoundingClientRect();
    const sw = document.querySelector('.book-body').scrollWidth <= document.querySelector('.book-body').clientWidth + 1;
    return { ok: el.left >= 0 && el.right <= innerWidth + 1 && el.bottom <= innerHeight + 1 && sw };
  });
  check(`album tab ${t} fits portrait`, ov.ok);
  await p.shot(`album_port_${t}`);
}
// the album-reward cosmetics show up in the style screen
await p.page.click('#bBack');
await p.wait(300);
const own = await p.ev(() => ['neck:mutiara', 'head:topiNelayan', 'face:topengNakal'].map((k) => !!window.__cat.save.owned[k]));
check('reward cosmetic owned (pearl), others still locked', own[0] && !own[1] && !own[2], JSON.stringify(own));
await p.ev(() => { const C = window.__cat; C.save.look.neck = 'mutiara'; C.save.look.head = 'topiNelayan'; C.save.look.face = 'topengNakal'; C.cat.model.setLook(C.save.look); });
await p.page.click('#mStyle');
await p.wait(600);
await p.shot('album_cosmetics');
await p.close();
