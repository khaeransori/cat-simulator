// Weekly drop "Tukang Balon Keliling": Mas Dodi walks his route, talk → find the stuck balloon →
// bring it back (reward: Balon di punggung + sticker), pop-a-balloon mischief makes him shoo the cat,
// dropping the balloon floats it back, night = he stays home, new day resets, old saves load.
import { start, check } from './lib.mjs';
const h = await start();
try { await h.play(); } catch (e) { await h.dialogs(); await h.page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 }); }
await h.ev(() => (window.__cat.timeScale = 3));
const gw = async (sec) => {
  const t0 = await h.ev(() => window.__cat.time);
  for (let i = 0; i < 400; i++) { await h.wait(150); if ((await h.ev(() => window.__cat.time)) - t0 >= sec) return; }
};
const rate = await h.ev(async () => { const t0 = window.__cat.time, w0 = performance.now(); await new Promise((r) => setTimeout(r, 1000)); return (window.__cat.time - t0) / ((performance.now() - w0) / 1000); });
console.log('game-s per wall-s', rate.toFixed(2));

const info = await h.ev(() => { const C = window.__cat; const d = C.npcs.find((n) => n.name === 'dodi'); return { has: !!d, def: JSON.stringify(C.save.balon), n: C.balloons.balloons.length, x: d.body.x, z: d.body.z }; });
check('Mas Dodi is in the world', info.has && info.n === 5, JSON.stringify(info));
check('save has balon key', info.def.includes('"got":false') || info.def.includes('"got":true'), info.def);

// he walks his route
const p0 = await h.ev(() => { const d = window.__cat.npcs.find((n) => n.name === 'dodi'); return [d.body.x, d.body.z]; });
await h.tp(-25, 0, 35, 0, 100); // park the cat out of the way
await gw(12);
const p1 = await h.ev(() => { const d = window.__cat.npcs.find((n) => n.name === 'dodi'); return [d.body.x, d.body.z, d.pathI, d.state]; });
check('Mas Dodi walks his route', Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 3, JSON.stringify([p0, p1]));

// close any first-day intro dialog still open
for (let i = 0; i < 6; i++) { await h.dialogs(10); await h.wait(400); if (!(await h.ev(() => window.__cat.dialogOpen))) break; }
// screenshot of him with his balloons
const shotNear = async (name, dx, dz, pitch = 0.2) => {
  await h.ev(([dx, dz, pitch]) => {
    const C = window.__cat, d = C.npcs.find((n) => n.name === 'dodi');
    d.state = 'wait'; d.stateT = 0; d.waitT = 999; d.body.vx = d.body.vz = 0;
    const b = C.cat.body; b.x = d.body.x + dx; b.z = d.body.z + dz; b.y = d.body.y; b.vx = b.vz = 0;
    C.cat.yaw = Math.atan2(-dx, -dz); C.cat.setState('free'); C.camRig.yaw = C.cat.yaw; C.camRig.pitch = pitch; C.camRig.dist = 4.2; C.camRig.snap(C.cat);
    d.yaw = Math.atan2(dx, dz);
  }, [dx, dz, pitch]);
  await h.wait(900);
  await h.shot(name);
};
await shotNear('balloons-dodi', 0.3, 2.6, 0.12);

// talk: he asks for the stuck balloon
await h.ev(() => { const C = window.__cat; C.forceBalloonSpot = 0; C.balloons.reset(); });
await shotNear('balloons-talk', 0.2, 1.4, 0.15);
const near = await h.ev(() => window.__cat.interact.current?.id);
check('talk to Mas Dodi offered', near === 'dodi', String(near));
await h.key('KeyE', 600);
const dlg = await h.ev(() => document.getElementById('dlgWho').textContent + ' | ' + document.getElementById('dlgTxt').textContent);
await h.dialogs(6);
check('dialog with Mas Dodi', dlg.includes('Mas Dodi'), dlg);
const talked = await h.ev(() => window.__cat.balloons.talked && window.__cat.save.balon.met);
check('met + talked', talked);

// the stuck balloon on top of the slide
const sp = await h.ev(() => { const p = window.__cat.balloons.stuckPos(); return [p.x, p.y, p.z]; });
await h.tp(sp[0], sp[1], sp[2] - 0.6, 0, 400);
await h.ev(() => { const c = window.__cat; c.camRig.pitch = 0.3; c.camRig.dist = 3.5; c.camRig.snap(c.cat); });
await h.wait(500);
await h.shot('balloons-stuck');
const near2 = await h.tp(sp[0], sp[1], sp[2] - 0.5, 0, 500);
check('take balloon offered at the slide', near2 === 'balon_ambil', String(near2));
await h.key('KeyE', 600);
check('cat carries the balloon', await h.ev(() => window.__cat.cat.carrying?.id === 'balon'));
// drop: it floats back to its spot
await h.key('KeyE', 600);
const back = await h.ev(() => { const C = window.__cat; return !C.cat.carrying && C.balloons.stuck.parent === C.scene; });
check('dropped balloon floats back', back);
await h.tp(sp[0], sp[1], sp[2] - 0.5, 0, 500);
await h.key('KeyE', 600);
await shotNear('balloons-carry', 0.6, 1.6, 0.25);
const near3 = await h.ev(() => window.__cat.interact.current?.id + ':' + window.__cat.interact.current?.label());
check('give balloon offered', near3 === 'dodi:a_give', near3);
const c0 = await h.ev(() => window.__cat.save.coins);
await h.key('KeyE', 600);
await h.dialogs(6);
await h.wait(600);
const rew = await h.ev(() => { const C = window.__cat; return { owned: !!C.save.owned['back:balon'], n: C.save.balon.n, got: C.save.balon.got, coins: C.save.coins, ret: C.balloons.returned, vis: C.balloons.stuck.parent === C.scene }; });
check('reward: Balon di punggung + coins', rew.owned && rew.got && rew.n === 1 && rew.coins >= c0 + 15 && rew.ret && !rew.vis, JSON.stringify(rew));
const lineAfter = await h.ev(() => window.__cat.interact.current?.id || '');
check('no second talk prompt today', lineAfter !== 'dodi', lineAfter);

// wear it
await h.ev(() => { const C = window.__cat; C.save.look.back = 'balon'; C.cat.model.setLook(C.save.look); });
await h.tp(-11.5, 0, 14, Math.PI, 100);
await h.ev(() => { const c = window.__cat; c.camRig.yaw = Math.PI * 0.5; c.camRig.pitch = 0.15; c.camRig.dist = 3.2; c.camRig.snap(c.cat); });
await h.page.waitForFunction(() => document.getElementById('banner')?.hidden !== false || getComputedStyle(document.getElementById('banner')).opacity === '0', null, { timeout: 15000 }).catch(() => {});
await gw(3);
await h.shot('balloons-cat-wears');
check('cat model has the balloon', await h.ev(() => !!window.__cat.cat.model.balloon));

// pop a balloon: mischief + he shoos
await h.ev(() => { const C = window.__cat; C.npcs.forEach((n) => (n.cooldown = 0)); });
await shotNear('balloons-before-pop', 0.2, 1.3, 0.2);
const near4 = await h.ev(() => window.__cat.interact.current?.id);
check('pop offered', near4 === 'balon_pecah', String(near4));
const vis0 = await h.ev(() => window.__cat.balloons.balloons.filter((b) => b.visible).length);
await h.key('KeyE', 200);
let st = '';
for (let i = 0; i < 20 && !['alert', 'chase', 'giveup'].includes(st); i++) { st = await h.ev(() => window.__cat.npcs.find((n) => n.name === 'dodi').state); if (!['alert', 'chase', 'giveup'].includes(st)) await h.wait(150); }
const popR = await h.ev(() => ({ done: window.__cat.day.doneToday.has('balon_pecah'), vis: window.__cat.balloons.balloons.filter((b) => b.visible).length }));
check('pop: mischief counted + one balloon gone', popR.done && popR.vis === vis0 - 1, JSON.stringify(popR));
check('pop: Mas Dodi reacts (alert/chase)', ['alert', 'chase', 'giveup'].includes(st), st);
await h.shot('balloons-pop');

// night: he stays home; next day the bunch is full again and a new balloon is stuck
const night = await h.ev(() => { const C = window.__cat; C.weatherSys.apply('malam'); const a = C.npcs.find((n) => n.name === 'dodi').active; C.weatherSys.apply('cerah'); return a; });
check('night: Mas Dodi not out', night === false);
const nd = await h.ev(() => { const C = window.__cat; C.forceBalloonSpot = 2; C.day.resetWorld(); const d = C.npcs.find((n) => n.name === 'dodi'); return { vis: C.balloons.balloons.filter((b) => b.visible).length, ret: C.balloons.returned, talked: C.balloons.talked, stuck: C.balloons.stuck.visible && C.balloons.stuck.parent === C.scene, spot: C.balloons.spotI, active: d.active }; });
check('new day resets balloons', nd.vis === 5 && !nd.ret && !nd.talked && nd.stuck && nd.spot === 2 && nd.active, JSON.stringify(nd));
// returning gets coins only (no second item), sticker after 3
await h.ev(() => { const C = window.__cat; C.save.balon.n = 2; });
const sp2 = await h.ev(() => { const p = window.__cat.balloons.stuckPos(); return [p.x, p.y, p.z]; });
const near5 = await h.tp(sp2[0], sp2[1], sp2[2] - 0.5, 0, 500);
check('take balloon at the dock', near5 === 'balon_ambil', String(near5));
await h.key('KeyE', 500);
await h.ev(() => { const C = window.__cat; C.forceBalloonSpot = undefined; });
await shotNear('balloons-give2', 0.4, 1.5, 0.2);
await h.key('KeyE', 600);
await h.dialogs(6);
await h.wait(500);
const st3 = await h.ev(() => ({ n: window.__cat.save.balon.n, badge: !!window.__cat.save.album.badges.balloon3 }));
check('3rd balloon → sticker Penolong Balon', st3.n === 3 && st3.badge, JSON.stringify(st3));

// English strings exist (Indonesian default)
const strs = await h.ev(() => { const C = window.__cat; return { lang: C.save.settings.lang }; });
check('default language Indonesian', strs.lang === 'id', strs.lang);
// an old save without the new 'balon' key still loads (merge fills the default)
await h.ev(() => { const k = 'cat-sim-sebelum-mama-pulang-v1'; const s = JSON.parse(localStorage.getItem(k)); delete s.balon; localStorage.setItem(k, JSON.stringify(s)); });
await h.page.reload();
await h.page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
const old = await h.ev(() => JSON.stringify(window.__cat.save.balon) + ' owned=' + !!window.__cat.save.owned['back:balon']);
check('old save loads with balon default', old.startsWith('{"met":false,"got":false,"n":0}') && old.endsWith('owned=true'), old);
await h.close();
