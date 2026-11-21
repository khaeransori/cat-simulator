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
const calls = await h.ev(() => window.__cat.renderer.info.render.calls);
check('draw calls reasonable', calls < 600, String(calls));
check('no page errors', h.errs.length === errs0, h.errs.slice(errs0).join(' | '));
await h.close();
