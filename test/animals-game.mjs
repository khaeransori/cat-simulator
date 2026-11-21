// In-game look of the blocky animals at the real play camera: player cat next to a person,
// Lisa, Bleki, ducks, pigeons, plus the fishing rod / carry / sit / photo framing.
// Look at test/shots/animals-game-*.png.
import { start, check } from './lib.mjs';
const h = await start();
await h.play();
const gw = async (sec) => {
  const t0 = await h.ev(() => window.__cat.time);
  await h.page.waitForFunction(([t0, s]) => window.__cat.time > t0 + s, [t0, sec], { timeout: 120000 });
};
const errs0 = h.errs.length;
const look = (x, z, yaw, dist = 3.2) => h.ev(([x, z, yaw, dist]) => {
  const c = window.__cat, b = c.cat.body;
  b.x = x; b.z = z; b.y = 0; b.vx = b.vz = 0; c.cat.yaw = yaw; c.cat.setState('free');
  c.camRig.yaw = yaw + Math.PI; c.camRig.pitch = 0.25; if ('dist' in c.camRig) c.camRig.dist = dist; c.camRig.snap(c.cat);
}, [x, z, yaw, dist]);
const P = await h.ev(() => {
  const p = window.__cat.world.pts;
  const v = (k) => p[k] && [p[k].x, p[k].y, p[k].z];
  return { lisa: v('lisa'), dog: v('dogBed'), ducks: v('ducks'), pigeons: v('pigeonPark') };
});
console.log('points', JSON.stringify(P));

// 1. player cat next to the nearest person
const near = await h.ev(() => {
  const c = window.__cat, hs = (c.humans || c.npcs || []).filter((x) => x.model?.root?.visible);
  return hs.length ? [hs[0].body.x, hs[0].body.z] : null;
});
if (near) await look(near[0] + 1.2, near[1] + 0.2, -Math.PI / 2);
await gw(0.6);
await h.shot('animals-game-1-person');
// 2. Lisa
await look(P.lisa[0] + 1.6, P.lisa[2], -Math.PI / 2);
await gw(0.6);
await h.shot('animals-game-2-lisa');
// 3. Bleki asleep in its bed (seen from outside the fence is fine)
await look(P.dog[0] - 2.2, P.dog[2] + 0.5, Math.PI / 2, 4);
await gw(0.6);
await h.shot('animals-game-3-dog');
// 4. ducks + pigeons
await look(P.ducks[0] - 2.4, P.ducks[2], Math.PI / 2, 3.5);
await gw(0.6);
await h.shot('animals-game-4-ducks');
await look(P.pigeons[0], P.pigeons[2] - 2.4, 0, 3.5);
await gw(0.6);
await h.shot('animals-game-5-pigeons');
// 5. meow bubble height over the bigger cat
await h.key('KeyQ', 300).catch(() => {});
await h.ev(() => window.__cat.cat.meow?.());
await gw(0.2);
await h.shot('animals-game-6-meow');
// 6. chickens: peck in the west neighbour's yard, scatter when the cat runs through, then calm down
const ay = await h.ev(() => window.__cat.world.pts.ayam && [window.__cat.world.pts.ayam.x, window.__cat.world.pts.ayam.z]);
check('chicken flock exists', !!ay);
await look(ay[0] - 3, ay[1] + 1.5, Math.PI / 2, 3.2);
await gw(0.6);
await h.shot('animals-game-7-ayam');
const before = await h.ev(() => window.__cat.flocks[3].state);
await h.ev(() => { const c = window.__cat; c.flocks[3].scare() && c.onFlockScared?.(c.flocks[3]); });
await gw(0.5);
await h.shot('animals-game-8-ayam-kabur');
const mid = await h.ev(() => { const f = window.__cat.flocks[3], y = f.yard; return { st: f.state, inYard: f.birds.every((b) => b.x >= y.x0 - 0.01 && b.x <= y.x1 + 0.01 && b.z >= y.z0 - 0.01 && b.z <= y.z1 + 0.01), maxY: Math.max(...f.birds.map((b) => b.y)) }; });
await gw(4);
const after = await h.ev(() => ({ st: window.__cat.flocks[3].state, vis: window.__cat.flocks[3].birds.every((b) => b.m.root.visible), done: window.__cat.day.doneToday.has('ayam') }));
check('chickens scatter, stay in their yard, then calm down', before === 'ground' && mid.st === 'fly' && mid.inYard && mid.maxY < 1.2 && after.st === 'ground' && after.vis, JSON.stringify({ before, mid, after }));
check('spooking the chickens counts as mischief', after.done);
// 7. Bleki fits his bigger doghouse (door taller than the dog)
await h.ev(() => { const d = window.__cat.dog; d.reset?.(); d.state = 'sleep'; d.x = d.bed.x; d.z = d.bed.z; d._upd = d.update; d.update = function () { this.model.root.position.set(this.x, 0, this.z); this.model.update(0.016, { run: 0, sleep: true, bark: false }); }; });
await look(33.2, -9.0, Math.PI / 2, 3.6);
await h.ev(() => { const c = window.__cat; c.camRig._u = c.camRig.update; c.camRig.update = () => {}; c.camera.position.set(33.0, 2.0, -6.0); c.camera.lookAt(35.6, 0.7, -11.6); });
await gw(0.4);
await h.shot('animals-game-9-doghouse');
await h.ev(() => { const c = window.__cat, d = c.dog; d.update = d._upd; c.camRig.update = c.camRig._u; });
// 8. camera distance follows the bigger cat
const cam = await h.ev(() => { const c = window.__cat; return { dist: c.camRig.dist, h: c.cat.model.height }; });
check('follow camera pulled back for the bigger cat', cam.dist >= 2.8, JSON.stringify(cam));
const calls = await h.ev(() => window.__cat.renderer.info.render.calls);
check('draw calls reasonable', calls < 600, String(calls));
check('no page errors', h.errs.length === errs0, h.errs.slice(errs0).join(' | '));
await h.close();
