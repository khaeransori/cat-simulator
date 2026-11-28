// Blocky people: every human NPC uses the Kenney Blocky rig in Indonesian outfits.
// Lineup + pose sheet + umbrella/mouth checks, sizes measured with Box3. Look at the shots.
import { start, check } from './lib.mjs';
const h = await start({ viewport: { width: 1280, height: 600 } });
await h.play();
await h.ev(() => (window.__cat.timeScale = 1));

const info = await h.ev(() => {
  const c = window.__cat;
  const THREE = c.THREE || null;
  const all = [c.day.mama, ...c.npcs, c.kids.a, c.kids.b];
  return all.map((p) => ({ name: p.name, blocky: !!p.model.n, h: p.model.height, kid: p.model.kid, hasSkin: !!p.model.n?.skin }));
});
console.log(info.map((i) => `${i.name}:${i.h.toFixed(2)}`).join(' '));
check('10 people built (incl. Mas Dodi)', info.length === 10 && info.some((i) => i.name === 'dodi'), String(info.length));
check('every person uses the Blocky rig', info.every((i) => i.blocky && i.hasSkin));
check('adults ~1.7 m, kids ~1.37 m', info.every((i) => Math.abs(i.h - (i.kid ? 1.365 : 1.693)) < 0.01));

// lineup in the park, facing the camera
const POSES = ['idle', 'walk', 'sweep', 'shoo', 'surprised', 'hug', 'wave', 'laugh', 'point', 'carry'];
async function lineup(poseFn, cam) {
  await h.ev(([poses, pf, cam]) => {
    const c = window.__cat;
    const all = [c.day.mama, ...c.npcs, c.kids.a, c.kids.b];
    // kids: stop their ball game but keep them animating
    c.kids.away = true;
    if (!window.__kidTick) {
      window.__kidTick = true;
      let last = performance.now();
      const tick = (now) => { const dt = Math.min(0.05, (now - last) / 1000); last = now; for (const k of [c.kids.a, c.kids.b]) k.update(dt); requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }
    if (pf !== 'keep') all.forEach((p, i) => {
      p.active = true;
      p.state = 'script';
      p.goal = null;
      p.body.x = -8 + i * 1.6;
      p.body.z = 22;
      p.body.y = 0;
      p.body.vx = p.body.vz = 0;
      p.yaw = 0;
      p.pose = pf === 'all' ? poses[i % poses.length] : pf;
    });
    c.kids.a.active = c.kids.b.active = true;
    c.cat.body.x = -12; c.cat.body.z = 26;
    c.camRig.override = { pos: new c.cat.model.root.position.constructor(...cam[0]), look: new c.cat.model.root.position.constructor(...cam[1]) };
  }, [POSES, poseFn, cam]);
  await h.wait(900);
}
const wide = [[-1.6, 1.6, 30.5], [-1.6, 0.9, 22]];
await lineup('idle', wide);
await h.shot('people-1-lineup');
await lineup('all', wide);
await h.shot('people-2-poses');
await lineup('walk', wide);
await h.shot('people-3-walk');

// close-up: mouths + umbrella
await h.ev(() => {
  const c = window.__cat;
  const all = [c.day.mama, ...c.npcs];
  const mouths = ['smile', 'o', 'grin', 'frown', 'smile', 'o', 'grin'];
  all.forEach((p, i) => { p.model.setMouth(mouths[i]); p.model.setUmbrella(i % 2 === 0, 0xe53935); });
});
await lineup('idle', [[-3.2, 1.5, 26], [-3.2, 1.1, 22]]);
await h.shot('people-4-faces-umbrella');
const umb = await h.ev(() => {
  const c = window.__cat;
  const m = c.day.mama.model;
  const v = new c.cat.model.root.position.constructor();
  m.umbrella.children[2].getWorldPosition(v);
  const hnd = new c.cat.model.root.position.constructor();
  m.hand.getWorldPosition(hnd);
  const pole = new c.cat.model.root.position.constructor();
  m.umbrella.getWorldPosition(pole);
  return { canopyY: v.y - c.day.mama.body.y, height: m.height, gap: pole.distanceTo(hnd), upright: Math.abs(v.x - pole.x) + Math.abs(v.z - pole.z) };
});
check('umbrella canopy above the head', umb.canopyY > umb.height + 0.1 && umb.canopyY < umb.height + 1.2, umb.canopyY.toFixed(2));
check('umbrella pole in the hand and upright', umb.gap < 0.05 && umb.upright < 0.05, JSON.stringify(umb));

// kid hug: holdSlot sits in front of the chest at a sensible height
await h.ev(() => { for (const p of [window.__cat.day.mama, ...window.__cat.npcs]) p.model.setUmbrella(false); });
const hold = await h.ev(() => {
  const c = window.__cat;
  const k = c.kids.a;
  k.pose = 'hug';
  k.model.update(0.016, 'hug');
  k.model.root.updateMatrixWorld(true);
  const v = new c.cat.model.root.position.constructor();
  k.model.holdSlot.getWorldPosition(v);
  const fwd = (v.x - k.body.x) * Math.sin(k.yaw) + (v.z - k.body.z) * Math.cos(k.yaw);
  return { y: +(v.y - k.body.y).toFixed(2), fwd: +fwd.toFixed(2) };
});
check('kid hug slot at chest height, in front', hold.y > 0.6 && hold.y < 1.1 && hold.fwd > 0.25 && hold.fwd < 0.7, JSON.stringify(hold));

const broom = await h.ev(() => {
  const c = window.__cat, s = c.npcs[0];
  const V = c.cat.model.root.position.constructor;
  const res = {};
  for (const pose of ['idle', 'sweep', 'walk']) {
    s.model.update(0.016, pose);
    s.model.root.updateMatrixWorld(true);
    let lo = 9;
    s.model.broom.traverse((m) => { if (m.isMesh) { m.geometry.computeBoundingBox(); const b = m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld); lo = Math.min(lo, b.min.y); } });
    res[pose] = +(lo - s.body.y).toFixed(2);
  }
  return res;
});
check('sapu lidi bristles near the ground (not buried)', Object.values(broom).every((y) => y > -0.12 && y < 0.35), JSON.stringify(broom));
await h.ev(() => { const c = window.__cat; c.kids.a.pose = c.kids.b.pose = 'hug'; c.npcs[0].pose = 'sweep'; for (const p of [c.day.mama, ...c.npcs]) p.model.setUmbrella(false); });
await h.ev(() => { const c = window.__cat; for (const p of [c.kids.a, c.kids.b]) p.body.z = 40; });
await lineup('keep', [[-4.6, 1.2, 25.2], [-5.6, 0.7, 22]]);
await h.shot('people-5-closeup-siti');
await h.ev(() => { const c = window.__cat; [c.kids.a, c.kids.b].forEach((k, i) => { k.body.x = -14 + i * 1.4; k.body.z = 18; }); for (const p of [c.day.mama, ...c.npcs]) p.body.z = 40; c.kids.a.yaw = c.kids.b.yaw = 0; });
await lineup('keep', [[-13.3, 1.0, 20.6], [-13.3, 0.6, 18]]);
await h.shot('people-6-closeup-kids-hug');
const calls = await h.ev(() => window.__cat.renderer.info.render.calls);
check('draw calls reasonable', calls < 600, String(calls));
await h.close();
