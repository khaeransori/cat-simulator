// Weekly drop "Pesta & Paket": Mas Bayu the courier walks his route and leaves a parcel on the teras,
// talk to him, scratch the parcel open (mischief), hide inside (grown-ups can't see / lose a chased cat),
// 3 hiding days -> sticker Raja Kardus + Topi kardus, party decor (bunting, balloons, cake) in Rumah Kucing,
// night = he stays home, new day resets, old saves load.
import { start, check } from './lib.mjs';
const h = await start();
try { await h.play(); } catch (e) { await h.dialogs(); await h.page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 }); }
await h.ev(() => { window.__cat.timeScale = 3; window.__cat.day.timeLeft = 1e6; });
const gw = async (sec) => {
  const t0 = await h.ev(() => window.__cat.time);
  for (let i = 0; i < 600; i++) { await h.wait(150); if ((await h.ev(() => window.__cat.time)) - t0 >= sec) return; }
};
const rate = await h.ev(async () => { const t0 = window.__cat.time, w0 = performance.now(); await new Promise((r) => setTimeout(r, 1000)); return (window.__cat.time - t0) / ((performance.now() - w0) / 1000); });
console.log('game-s per wall-s', rate.toFixed(2));
for (let i = 0; i < 6; i++) { await h.dialogs(10); await h.wait(300); if (!(await h.ev(() => window.__cat.dialogOpen))) break; }

const info = await h.ev(() => { const C = window.__cat; const b = C.npcs.find((n) => n.name === 'bayu'); return { has: !!b, state: C.courier.state, save: JSON.stringify(C.save.kurir), x: b.body.x, z: b.body.z, inHands: C.courier.parcel.parent !== C.scene }; });
check('Mas Bayu is in the world with a parcel in his arms', info.has && info.state === 'hand' && info.inHands, JSON.stringify(info));
check('save has kurir key', info.save.includes('"hid"'), info.save);

// close-up of him carrying the parcel
const cam = async (name, pos, look, wait = 900) => {
  await h.ev(([p, l]) => { const c = window.__cat; const V = c.camera.position.constructor; c.camRig.override = { pos: new V(...p), look: new V(...l) }; c.camera.position.set(...p); }, [pos, look]);
  await h.wait(wait);
  await h.shot(name);
  await h.ev(() => (window.__cat.camRig.override = null));
};
const shotNear = async (name, dx, dz, pitch = 0.2) => {
  await h.ev(([dx, dz, pitch]) => {
    const C = window.__cat, d = C.npcs.find((n) => n.name === 'bayu');
    d.state = 'wait'; d.stateT = 0; d.waitT = 999; d.body.vx = d.body.vz = 0;
    const b = C.cat.body; b.x = d.body.x + dx; b.z = d.body.z + dz; b.y = d.body.y; b.vx = b.vz = 0;
    C.cat.yaw = Math.atan2(-dx, -dz); C.cat.setState('free'); C.camRig.yaw = C.cat.yaw; C.camRig.pitch = pitch; C.camRig.dist = 4.2; C.camRig.snap(C.cat);
    d.yaw = Math.atan2(dx, dz);
  }, [dx, dz, pitch]);
  await h.wait(900);
  await h.shot(name);
};
await shotNear('courier-bayu', 0.4, 2.6, 0.12);
{
  const b = await h.ev(() => { const d = window.__cat.npcs.find((n) => n.name === 'bayu'); return [d.body.x, d.body.z]; });
  await cam('courier-bayu-close', [b[0] + 1.6, 1.5, b[1] + 2.6], [b[0], 1.0, b[1]]);
}
await h.ev(() => { const C = window.__cat; C.npcs.find((n) => n.name === 'bayu').pose = 'carry'; });
await shotNear('courier-talk', 0.2, 1.3, 0.15);
const near = await h.ev(() => window.__cat.interact.current?.id);
check('talk to Mas Bayu offered', near === 'bayu', String(near));
await h.key('KeyE', 600);
const dlg = await h.ev(() => document.getElementById('dlgWho').textContent + ' | ' + document.getElementById('dlgTxt').textContent);
await h.dialogs(6);
check('dialog with Mas Bayu', dlg.includes('Mas Bayu'), dlg);
check('met', await h.ev(() => window.__cat.save.kurir.met && window.__cat.courier.talked));

// he walks his route on his own and leaves the parcel on the teras
await h.ev(() => { const C = window.__cat, d = C.npcs.find((n) => n.name === 'bayu'); d.reset(); d.state = 'patrol'; d.pathI = 0; });
await h.tp(-25, 0, 35, 0, 100); // park the cat far away
const p0 = await h.ev(() => { const d = window.__cat.npcs.find((n) => n.name === 'bayu'); return [d.body.x, d.body.z]; });
let st = null;
for (let i = 0; i < 12; i++) {
  await gw(6);
  st = await h.ev(() => { const C = window.__cat, d = C.npcs.find((n) => n.name === 'bayu'); return { s: C.courier.state, x: d.body.x, z: d.body.z, i: d.pathI, st: d.state, pose: d.pose }; });
  if (st.s === 'teras') break;
}
check('Mas Bayu walks his route', Math.hypot(st.x - p0[0], st.z - p0[1]) > 3, JSON.stringify([p0, st]));
check('parcel delivered on the teras', st.s === 'teras', JSON.stringify(st));
const onTeras = await h.ev(() => { const C = window.__cat, p = C.courier.parcel; return p.parent === C.scene && Math.hypot(p.position.x + 11.6, p.position.z + 10.6) < 0.01 && p.visible; });
check('parcel sits at the teras spot', onTeras);
await gw(10);
const after = await h.ev(() => { const d = window.__cat.npcs.find((n) => n.name === 'bayu'); return { i: d.pathI, x: d.body.x, z: d.body.z, pose: d.pose }; });
check('he walks on (no carry pose without the parcel)', after.pose !== 'carry', JSON.stringify(after));

// the parcel on the teras
await h.tp(-12.9, 0.2, -9.9, Math.PI / 2, 300);
await cam('courier-parcel-teras', [-9.6, 1.9, -7.6], [-11.9, 0.4, -10.3]);
const near2 = await h.tp(-11.6, 0.2, -9.85, Math.PI, 500);
check('unbox offered', near2 === 'kardus_paket', String(near2));
await h.key('KeyE', 200);
await h.page.waitForFunction(() => window.__cat.courier.state === 'open', null, { timeout: 60000 }).catch(() => {});
const ub = await h.ev(() => ({ s: window.__cat.courier.state, done: window.__cat.day.doneToday.has('kardus_paket'), cols: window.__cat.courier.cols.every((c) => !c.off) }));
check('unbox: box opens + mischief counted + walls on', ub.s === 'open' && ub.done && ub.cols, JSON.stringify(ub));
await h.wait(800);
await h.tp(-12.9, 0.2, -9.9, Math.PI / 2, 200);
await cam('courier-box-open', [-10.0, 1.6, -8.2], [-11.7, 0.4, -10.5]);

// hide inside
const near3 = await h.tp(-11.6, 0.2, -10.0, Math.PI, 500);
check('hide offered', near3 === 'kardus_ngumpet', String(near3));
const hid0 = await h.ev(() => window.__cat.save.kurir.hid);
await h.key('KeyE', 600);
const hs = await h.ev(() => ({ st: window.__cat.cat.state, hidden: window.__cat.catHidden(), hid: window.__cat.save.kurir.hid }));
check('cat hides in the box', hs.st === 'sleep' && hs.hidden && hs.hid === hid0 + 1, JSON.stringify(hs));
await cam('courier-hiding', [-10.4, 1.3, -8.6], [-11.6, 0.45, -10.6]);
// a grown-up standing right there can't see the hidden cat
const see = await h.ev(() => { const C = window.__cat, d = C.npcs.find((n) => n.name === 'bayu'); const b = C.cat.body; d.body.x = b.x; d.body.z = b.z + 2.5; d.yaw = Math.PI; return d.canSee(b.x, b.y, b.z); });
check('hidden cat cannot be seen', see === false);
// a chasing grown-up loses the cat when it hides
const lost = await h.ev(async () => {
  const C = window.__cat, d = C.npcs.find((n) => n.name === 'siti');
  d.body.x = -11.6; d.body.z = -8.2; d.state = 'chase'; d.stateT = 0; d.cooldown = 0;
  const t0 = C.time; while (C.time - t0 < 0.6) await new Promise((r) => setTimeout(r, 50));
  return { st: d.state, lostT: d.lostT, catSt: C.cat.state };
});
check('chasing grown-up gives up on a hidden cat', ['giveup', 'return', 'wait', 'patrol'].includes(lost.st) && lost.catSt === 'sleep', JSON.stringify(lost));
// same day again: no double count
await h.ev(() => window.__cat.cat.setState('free'));
await h.tp(-11.6, 0.2, -10.0, Math.PI, 400);
await h.key('KeyE', 500);
check('one hiding day per day', (await h.ev(() => window.__cat.save.kurir.hid)) === hid0 + 1);
await h.ev(() => window.__cat.cat.setState('free'));

// night: he stays home; new day: parcel back in his arms, box walls off
const night = await h.ev(() => { const C = window.__cat; C.weatherSys.apply('malam'); const a = C.npcs.find((n) => n.name === 'bayu').active; C.weatherSys.apply('cerah'); return a; });
check('night: Mas Bayu not out', night === false);
const nd = await h.ev(() => { const C = window.__cat; C.day.resetWorld(); C.weatherSys.apply('cerah'); const d = C.npcs.find((n) => n.name === 'bayu'); return { s: C.courier.state, talked: C.courier.talked, cols: C.courier.cols.every((c) => c.off), active: d.active, open: C.courier.open.visible }; });
check('new day resets the parcel', nd.s === 'hand' && !nd.talked && nd.cols && nd.active && !nd.open, JSON.stringify(nd));

// 3 hiding days (the Rumah Kucing cardboard house counts too) -> sticker + hat
await h.ev(() => { const C = window.__cat; C.save.coins = 500; C.save.kurir.hid = 2; C.decor.buy('kardus'); });
await h.tp(-12.6, 0, -17.6, Math.PI, 400);
const nk = await h.ev(() => window.__cat.interact.current?.id);
await h.key('KeyE', 900);
const st3 = await h.ev(() => ({ hid: window.__cat.save.kurir.hid, badge: !!window.__cat.save.album.badges.kardus3, hat: !!window.__cat.save.owned['head:topiKardus'] }));
check('3rd hiding day (decor box) -> sticker Raja Kardus + Topi kardus', nk === 'decor_kardus' && st3.hid === 3 && st3.badge && st3.hat, JSON.stringify({ nk, ...st3 }));
await h.ev(() => window.__cat.cat.setState('free'));
// wear the hat
await h.ev(() => { const C = window.__cat; C.save.look.head = 'topiKardus'; C.cat.model.setLook(C.save.look); });
await h.tp(-11.5, 0, 14, Math.PI, 100);
await h.ev(() => { const c = window.__cat; c.camRig.yaw = Math.PI * 0.8; c.camRig.pitch = 0.15; c.camRig.dist = 2.4; c.camRig.snap(c.cat); });
await h.page.waitForFunction(() => document.getElementById('banner')?.hidden !== false || getComputedStyle(document.getElementById('banner')).opacity === '0', null, { timeout: 15000 }).catch(() => {});
await gw(2);
await h.shot('courier-hat');

// ---- party decor in Rumah Kucing ----
const dec = await h.ev(() => { const C = window.__cat; const ids = ['bendera', 'balonRumah', 'kue']; for (const id of ids) C.decor.buy(id); return ids.map((id) => C.save.decor[id] && C.decor.isShown(id)); });
check('party decor bought + shown (bendera, balon, kue)', dec.every(Boolean), JSON.stringify(dec));
await h.tp(-13.6, 0, -15.0, Math.PI, 200);
await h.ev(() => { const c = window.__cat; const V = c.camera.position.constructor; c.camRig.override = { pos: new V(-13.4, 1.7, -14.1), look: new V(-13.6, 1.3, -18.6) }; c.camera.position.set(-13.4, 1.7, -14.1); });
await h.wait(900);
await h.shot('party-room');
await h.ev(() => { const c = window.__cat; const V = c.camera.position.constructor; c.camRig.override = { pos: new V(-11.6, 1.2, -15.0), look: new V(-10.4, 0.6, -13.75) }; c.camera.position.set(-11.6, 1.2, -15.0); });
await h.wait(900);
await h.shot('party-cake');
await h.ev(() => { window.__cat.camRig.override = null; });
const nb = await h.tp(-17.0, 0, -17.5, Math.PI, 400);
check('bat the balloons offered', nb === 'decor_balon', String(nb));
await h.key('KeyE', 400);
check('balloons bob', (await h.ev(() => window.__cat.decor.ballBob)) > 0);
await h.ev(() => window.__cat.cat.setState('free'));
const nc = await h.tp(-10.4, 0, -14.4, 0, 400);
check('blow the candles offered', nc === 'decor_kue', String(nc));
await h.key('KeyE', 200);
await h.page.waitForFunction(() => window.__cat.decor.candleOutT > 0, null, { timeout: 30000 }).catch(() => {});
check('candles blown out', await h.ev(() => window.__cat.decor.candleOutT > 0 && window.__cat.decor.flames.every((f) => !f.visible)));
await h.ev(() => (window.__cat.decor.candleOutT = 0.01));
await gw(0.5);
check('candles light again', await h.ev(() => window.__cat.decor.flames.every((f) => f.visible)));
// Mama's cutscene route + the kitchen stay clear of the new decor colliders
const clear = await h.ev(() => {
  const c = window.__cat;
  const dcols = ['bendera', 'balonRumah', 'kue'].flatMap((id) => c.decor.parts[id].cols);
  const hit = (x, z, r) => dcols.some((a) => !(x + r <= a.minX || x - r >= a.maxX || z + r <= a.minZ || z - r >= a.maxZ));
  const way = [[-10.5, -24.8], [-10.25, -20.3], [-10.25, -17.6], [-14.4, -15.6], [-14.2, -12.6], [-14.2, -14.4], [-16.2, -15.6]];
  for (let k = 0; k < way.length - 1; k++) for (let t = 0; t <= 1; t += 0.05) { const x = way[k][0] + (way[k + 1][0] - way[k][0]) * t, z = way[k][1] + (way[k + 1][1] - way[k][1]) * t; if (hit(x, z, 0.45)) return `${x.toFixed(1)},${z.toFixed(1)}`; }
  return '';
});
check("Mama's route clear of party decor", clear === '', clear);

check('default language Indonesian', (await h.ev(() => window.__cat.save.settings.lang)) === 'id');
// an old save without the new 'kurir' key still loads
await h.ev(() => { const k = 'cat-sim-sebelum-mama-pulang-v1'; const s = JSON.parse(localStorage.getItem(k)); delete s.kurir; localStorage.setItem(k, JSON.stringify(s)); });
await h.page.reload();
await h.page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
const old = await h.ev(() => JSON.stringify(window.__cat.save.kurir) + ' decor=' + !!window.__cat.save.decor.kue);
check('old save loads with kurir default', old.startsWith('{"met":false,"hid":0}') && old.endsWith('decor=true'), old);
await h.close();
