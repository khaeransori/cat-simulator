// Foto Mode + Rumah Kucing: photo mode pause/HUD/shutter, decor shop buying,
// decor persists after reload, interactive decor, and the house stays walkable.
import { start, check } from './lib.mjs';
import fs from 'fs';

// the box may be busy: wait for game frames, not wall-clock time
async function frames(h, n = 6) {
  const f0 = await h.ev(() => (window.__f = window.__f ?? 0));
  await h.ev(() => { if (!window.__fr) { window.__fr = true; const tick = () => { window.__f++; requestAnimationFrame(tick); }; requestAnimationFrame(tick); } });
  await h.page.waitForFunction((t) => window.__f >= t, f0 + n, { timeout: 60000 });
}
async function tp(h, x, y, z, yaw) {
  await h.tp(x, y, z, yaw, 50);
  await frames(h, 6);
  return h.ev(() => window.__cat.interact.current?.id);
}
const ALL = ['bola', 'tikus', 'mangkuk', 'tanaman', 'karpet', 'poster', 'kardus', 'lampu', 'tiang', 'kasur', 'rak', 'akuarium'];

// ---------- Part 1: photo mode (landscape) ----------
let h = await start();
await h.play();
await h.tp(-16, 0, -15.8, Math.PI * 0.85, 600);
await h.page.click('#btnPhoto');
await h.wait(400);
const t0 = await h.ev(() => window.__cat.day.timeLeft);
let st = await h.ev(() => ({ paused: window.__cat.paused, photo: window.__cat.photoMode, hud: document.getElementById('hud').hidden, ui: !document.getElementById('photoUI').hidden }));
check('photo mode: paused + HUD hidden + photo UI shown', st.paused && st.photo && st.hud && st.ui, JSON.stringify(st));
// time and NPCs frozen
const npc0 = await h.ev(() => window.__cat.npcs.map((n) => n.body.x + n.body.z).join(','));
await h.wait(1200);
const t1 = await h.ev(() => window.__cat.day.timeLeft);
const npc1 = await h.ev(() => window.__cat.npcs.map((n) => n.body.x + n.body.z).join(','));
check('photo mode: day timer frozen', Math.abs(t1 - t0) < 0.01 || t1 === t0, `${t0.toFixed(2)} -> ${t1.toFixed(2)}`);
check('photo mode: NPCs frozen', npc0 === npc1);
// orbit with a drag, zoom with the wheel
const yaw0 = await h.ev(() => window.__cat.photo.yaw);
await h.page.mouse.move(500, 200);
await h.page.mouse.down();
await h.page.mouse.move(380, 170, { steps: 6 });
await h.page.mouse.up();
const d0 = await h.ev(() => window.__cat.photo.dist);
await h.page.mouse.move(500, 200);
await h.page.mouse.wheel(0, -300);
await h.wait(300);
const yaw1 = await h.ev(() => window.__cat.photo.yaw);
const d1 = await h.ev(() => window.__cat.photo.dist);
check('photo mode: drag orbits the camera', Math.abs(yaw1 - yaw0) > 0.3, `${yaw0.toFixed(2)} -> ${yaw1.toFixed(2)}`);
check('photo mode: wheel zooms', d1 < d0 - 0.1, `${d0.toFixed(2)} -> ${d1.toFixed(2)}`);
// pose
await h.page.click('[data-id="pose:meong"]');
await frames(h, 30);
check('photo mode: meow pose shows bubble + sits', await h.ev(() => window.__cat.photo.meowBubble.visible && window.__cat.photo.anim.sit > 0.5));
// frame + sticker
await h.page.click('[data-id="tab:frame"]');
await h.wait(150);
await h.page.click('[data-id="frame:polaroid"]');
await h.page.click('[data-id="tab:sticker"]');
await h.wait(150);
await h.page.click('[data-id="stk:🐟"]');
await h.page.click('[data-id="stk:👑"]');
await h.wait(200);
const nSt = await h.ev(() => window.__cat.photo.stickers.length);
check('photo mode: stickers placed', nSt === 2, String(nSt));
// fixed spots so they never overlap in the test
await h.ev(() => { const p = window.__cat.photo; p.stickers[0].x = 0.62; p.stickers[0].y = 0.3; p.stickers[1].x = 0.2; p.stickers[1].y = 0.25; p.layoutStickers(); });
// drag a sticker
const sb = await h.page.$eval('.psticker', (e) => { const r = e.getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
await h.page.mouse.move(sb.x, sb.y);
await h.page.mouse.down();
await h.page.mouse.move(sb.x - 150, sb.y - 40, { steps: 5 });
await h.page.mouse.up();
const sx = await h.ev(() => window.__cat.photo.stickers[0].x);
check('photo mode: sticker drags', Math.abs(sx * 844 - (sb.x - 150)) < 12, (sx * 844).toFixed(0));
await h.wait(300);
await h.shot('photo-1-ui');
// shutter -> composited PNG
const png = await h.ev(() => {
  const c = window.__cat.photo.capture();
  const url = c.toDataURL('image/png');
  // count non-black pixels in the middle row to be sure WebGL content got in
  const g = c.getContext('2d');
  const d = g.getImageData(0, Math.floor(c.height / 2), c.width, 1).data;
  let lit = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 30) lit++;
  return { len: url.length, head: url.slice(0, 22), lit, w: c.width, url };
});
check('shutter: non-empty PNG data URL', png.head === 'data:image/png;base64,' && png.len > 20000, `${png.len} chars ${png.w}px`);
check('shutter: 3D scene is in the photo (not blank)', png.lit > png.w * 0.5, `${png.lit}/${png.w} lit`);
fs.writeFileSync('test/shots/photo-2-capture.png', Buffer.from(png.url.split(',')[1], 'base64'));
await h.page.click('#photoShutter');
await h.wait(900);
check('shutter: result panel shows', await h.ev(() => !document.getElementById('photoResult').hidden && !!document.getElementById('photoImg').src));
await h.shot('photo-3-result');
const dl = h.page.waitForEvent('download', { timeout: 8000 }).catch(() => null);
await h.page.click('#phSave');
const d = await dl;
check('save: browser download', !!d && /\.png$/.test(d.suggestedFilename()), d ? d.suggestedFilename() : 'none');
check('gallery: photo stored', (await h.ev(() => JSON.parse(localStorage.getItem('cat-sim-photos-v1') || '[]').length)) >= 1);
await h.page.click('#phAgain');
await h.wait(200);
await h.page.click('#photoAlbumBtn');
await h.wait(300);
check('gallery: opens with a photo', (await h.page.$$('.gal-item')).length >= 1);
await h.shot('photo-4-gallery');
await h.page.click('#galBack');
await h.page.click('#photoExit');
await h.wait(500);
st = await h.ev(() => ({ paused: window.__cat.paused, photo: window.__cat.photoMode, hud: document.getElementById('hud').hidden, ui: document.getElementById('photoUI').hidden, mode: window.__cat.mode, stk: document.querySelectorAll('.psticker').length }));
check('exit: back to play, HUD back, stickers gone', !st.paused && !st.photo && !st.hud && st.ui && st.mode === 'play' && st.stk === 0, JSON.stringify(st));
const t2 = await h.ev(() => window.__cat.day.timeLeft);
await frames(h, 10);
check('exit: day timer runs again', (await h.ev(() => window.__cat.day.timeLeft)) < t2);
// still controllable
const z0 = await h.ev(() => window.__cat.cat.body.x);
await h.page.keyboard.down('KeyW');
await frames(h, 20);
await h.page.keyboard.up('KeyW');
check('exit: cat moves again', Math.abs((await h.ev(() => window.__cat.cat.body.x)) - z0) > 0.3);
// pause menu entry
await h.key('Escape', 400);
await h.page.click('#pPhoto');
await h.wait(300);
check('pause menu: 📸 enters photo mode', await h.ev(() => window.__cat.photoMode && document.getElementById('screen').hidden));
await h.key('Escape', 300);
check('Esc exits photo mode', await h.ev(() => !window.__cat.photoMode && !window.__cat.paused));
await h.close();

// ---------- Part 2: Rumah Kucing ----------
h = await start();
await h.ev(() => { const c = window.__cat; c.save.coins = 500; c.save.firstRun = false; });
await h.page.click('#mStyle');
await h.wait(300);
await h.page.click('#tabDecor');
await h.wait(500);
await h.shot('decor-1-shop');
await h.page.click('.dtile[data-d="kasur"]');
await h.wait(900);
check('shop: preview shows unbought item', await h.ev(() => window.__cat.decor.previewId === 'kasur' && window.__cat.decor.parts.kasur.cols.every((c) => c.off)));
const c0 = await h.ev(() => window.__cat.save.coins);
await h.page.click('#decAct');
await h.wait(300);
const c1 = await h.ev(() => window.__cat.save.coins);
check('shop: buying deducts coins', c0 - c1 === 45, `${c0} -> ${c1}`);
await h.shot('decor-2-bought');
// buy everything else through the system (UI path covered above)
await h.ev((all) => { for (const id of all) window.__cat.decor.buy(id); }, ALL);
check('shop: all owned', await h.ev((all) => all.every((id) => window.__cat.save.decor[id]), ALL));
// put one away and back
await h.page.click('.dtile[data-d="poster"]');
await h.wait(300);
await h.page.click('#decAct');
check('shop: put away toggles off', await h.ev(() => !!window.__cat.save.decorOff.poster));
await h.page.click('#decAct');
check('shop: put out toggles on', await h.ev(() => !window.__cat.save.decorOff.poster));
await h.close();

// reload: same localStorage? each start() is a fresh context, so seed it
h = await start();
check('old saves load (no decor key -> empty)', await h.ev(() => JSON.stringify(window.__cat.save.decor) === '{}' && JSON.stringify(window.__cat.save.decorOff) === '{}'));
await h.ev((all) => {
  const k = 'cat-sim-sebelum-mama-pulang-v1';
  const s = JSON.parse(localStorage.getItem(k) || '{}');
  s.coins = 7; s.firstRun = false; s.day = 2; s.decor = Object.fromEntries(all.map((i) => [i, true])); s.decorOff = { lampu: true };
  localStorage.setItem(k, JSON.stringify(s));
}, ALL);
await h.page.reload();
await h.page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
const rel = await h.ev(() => {
  const c = window.__cat;
  return { kasur: c.save.decor.kasur, lampuOff: c.save.decorOff.lampu, mesh: !!c.decor.mesh && c.decor.mesh.parent === c.scene, tris: c.decor.mesh ? c.decor.mesh.geometry.index.count / 3 : 0, ball: c.decor.ball.visible, glow: c.decor.parts.lampu.objs[0].visible, col: !c.decor.parts.kasur.cols[0].off };
});
check('reload: owned decor appears in the scene', rel.kasur && rel.mesh && rel.ball && rel.col, JSON.stringify(rel));
check('reload: put-away decor stays hidden', rel.lampuOff && !rel.glow);
await h.play();
await h.ev(() => (window.__cat.day.timeLeft = 9999));
// house shot with everything (lamp too)
await h.ev(() => { window.__cat.decor.toggle('lampu'); });
await h.tp(-13.5, 0, -14.2, -Math.PI * 0.75, 300);
await h.ev(() => { const c = window.__cat; c.camRig.override = { pos: new c.cat.pos.constructor(-14.6, 2.6, -13.7), look: new c.cat.pos.constructor(-9.5, 0.4, -16.8) }; });
await h.wait(1500);
await h.shot('decor-3-house');
await h.ev(() => { const c = window.__cat; c.camRig.override = { pos: new c.cat.pos.constructor(-10.5, 2.4, -14.0), look: new c.cat.pos.constructor(-17.5, 0.4, -17.8) }; });
await h.wait(1500);
await h.shot('decor-4-house2');
await h.ev(() => { window.__cat.camRig.override = null; });
const calls = await h.ev(() => window.__cat.renderer.info.render.calls);
check('draw calls still reasonable with all decor', calls < 600, String(calls));

// HUD 🏠 button visible inside, hidden outside
check('HUD 🏠 shown inside the house', await h.ev(() => !document.getElementById('btnHome').hidden));
await tp(h, -14, 0, -8, 0);
check('HUD 🏠 hidden outside', await h.ev(() => document.getElementById('btnHome').hidden));

// interactive decor
let id = await tp(h, -7.0, 0, -16.35, 0);
check('tiang cakar: interact id', id === 'decor_tiang', String(id));
await h.page.keyboard.press('KeyE');
await frames(h, 3);
check('tiang cakar: scratch anim', await h.ev(() => window.__cat.cat.actKind === 'scratch'));
await h.page.waitForFunction(() => window.__cat.cat.state === 'free', null, { timeout: 30000 });
id = await tp(h, -10.3, 0, -15.95, 0);
check('bola benang: interact id', id === 'decor_bola', String(id));
const b0 = await h.ev(() => window.__cat.decor.ball.position.z);
await h.page.keyboard.press('KeyE');
await frames(h, 20);
const b1 = await h.ev(() => window.__cat.decor.ball.position.z);
check('bola benang: rolls when pawed', b1 - b0 > 0.4, `${b0.toFixed(2)} -> ${b1.toFixed(2)}`);
id = await tp(h, -8.3, 0, -15.05, Math.PI);
check('kasur: interact id', id === 'decor_kasur', String(id));
await h.page.keyboard.press('KeyE');
await frames(h, 4);
check('kasur: cat naps in the bed', await h.ev(() => window.__cat.cat.state === 'sleep' && window.__cat.decor.sleepingInBed()));
id = await tp(h, -15.5, 0, -17.6, Math.PI);
check('mangkuk: interact id', id === 'decor_mangkuk', String(id));
id = await tp(h, -8.0, 0, -17.4, Math.PI);
check('akuarium: interact id', id === 'decor_akuarium', String(id));
// shelf reachable from the scratching post
await tp(h, -7.0, 1.18, -15.6, Math.PI);
check('scratching post top is standable', await h.ev(() => window.__cat.cat.body.y > 1.1));

// paths: grid flood fill on the floor with the cat's radius
const reach = await h.ev(() => {
  const c = window.__cat, P = c.world.phys;
  const blocked = (x, z, r, maxStep) => P.query(x - r, z - r, x + r, z + r).some((a) => !(x + r <= a.minX || x - r >= a.maxX || z + r <= a.minZ || z - r >= a.maxZ) && a.maxY > maxStep && a.minY < 0.5);
  const S = 0.1, x0 = -22, z0 = -27, nx = 160, nz = 160;
  const key = (i, j) => i * nz + j;
  const seen = new Uint8Array(nx * nz);
  const si = Math.round((-14.2 - x0) / S), sj = Math.round((-12.2 - z0) / S);
  const q = [[si, sj]];
  seen[key(si, sj)] = 1;
  while (q.length) {
    const [i, j] = q.pop();
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = j + dj;
      if (a < 0 || b < 0 || a >= nx || b >= nz || seen[key(a, b)]) continue;
      if (blocked(x0 + a * S, z0 + b * S, 0.22, 0.26)) continue;
      seen[key(a, b)] = 1;
      q.push([a, b]);
    }
  }
  const ok = (x, z) => !!seen[key(Math.round((x - x0) / S), Math.round((z - z0) / S))];
  // Mama's cutscene waypoints, walked with her (bigger) radius, must not touch any decor collider
  const dcols = Object.values(c.decor.parts).flatMap((p) => p.cols);
  const hitDecor = (x, z, r) => dcols.some((a) => !(x + r <= a.minX || x - r >= a.maxX || z + r <= a.minZ || z - r >= a.maxZ));
  const way = [[-10.5, -24.8], [-10.25, -20.3], [-10.25, -17.6], [-14.4, -15.6], [-14.2, -12.6], [-14.2, -14.4], [-16.2, -15.6]];
  let mamaClear = true, bad = '';
  for (let k = 0; k < way.length - 1; k++) {
    const [ax, az] = way[k], [bx, bz] = way[k + 1];
    for (let t = 0; t <= 1; t += 0.05) {
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (hitDecor(x, z, 0.45)) { mamaClear = false; bad = `${x.toFixed(1)},${z.toFixed(1)}`; }
    }
  }
  return { sofa: ok(-19.5, -15.2), door: ok(-14.2, -14.2), kitchen: ok(-10.25, -20.3), mamaClear, bad };
});
check('path: door -> sofa front reachable with all decor', reach.sofa && reach.door, JSON.stringify(reach));
check('path: kitchen still reachable', reach.kitchen);
check("path: Mama's cutscene route clear", reach.mamaClear, reach.bad);
id = await tp(h, -19.5, 0, -15.0, Math.PI);
check('sofa still interactable', id === 'sofa', String(id));
// walk out the front door for real
await h.tp(-14.2, 0, -15.6, 0, 300);
await h.page.keyboard.down('KeyW');
await h.page.waitForFunction(() => window.__cat.cat.body.z > -11.5, null, { timeout: 30000 }).catch(() => {});
await h.page.keyboard.up('KeyW');
check('cat walks out of the front door', (await h.ev(() => window.__cat.cat.body.z)) > -12, (await h.ev(() => window.__cat.cat.body.z)).toFixed(1));
// day end counts the cat bed as sleeping at home
await tp(h, -8.3, 0, -15.05, Math.PI);
await h.page.keyboard.press('KeyE');
await frames(h, 4);
await h.ev(() => (window.__cat.day.timeLeft = 0.05));
await h.page.waitForFunction(() => window.__cat.mode === 'cutscene' || window.__cat.mode === 'summary', null, { timeout: 8000 });
check('nap in cat bed counts as home at day end', await h.ev(() => window.__cat.cat.state === 'sleep'));
await h.close();

// ---------- Part 3: portrait layouts ----------
h = await start({ viewport: { width: 390, height: 844 }, touch: true });
await h.ev(() => { const c = window.__cat; c.save.coins = 120; c.save.firstRun = false; c.save.decor = { tiang: true, kasur: true }; c.decor.refresh(); });
await h.play();
await h.tp(-12, 0, -15.6, Math.PI / 2, 400);
await h.ev(() => document.getElementById('btnPhoto').click());
await h.wait(300);
await h.ev(() => { const p = window.__cat.photo; p.frame = 'hati'; p.drawFrame(); p.addSticker('🌸', 0.3, 0.3); p.addSticker('⭐', 0.7, 0.45); p.setPose('duduk'); p.panel = 'sticker'; p.renderUI(); });
await h.wait(800);
await h.shot('photo-5-portrait');
await h.ev(() => window.__cat.photo.exit());
await h.wait(200);
await h.ev(() => document.getElementById('btnHome').click());
await h.wait(1200);
await h.shot('decor-5-portrait-shop');
check('portrait shop opens from HUD 🏠', await h.ev(() => !!document.querySelector('.decor-panel') && window.__cat.paused));
await h.page.click('#decDone');
await h.wait(300);
check('portrait shop: resume returns to play', await h.ev(() => !window.__cat.paused && !window.__cat.camRig.override));
await h.close();
