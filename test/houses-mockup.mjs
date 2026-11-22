// Indonesian houses (approved mockup) in the game.
//  (a) the mockup's street rebuilt with the GAME's house code at the mockup cameras -> test/shots/housesmock-*.png
//  (b) in-game shots of every replaced area at the cat's street-level camera     -> test/shots/houses-game-*.png
//  (c) a night shot (glowing windows)                                             -> test/shots/houses-game-malam.png
// Checks: no page errors, every mockup view rendered, houses mesh present, house colliders exist and none of them
// sits on the street / sidewalk / west cross road, the cat can stand on a flat dak, and perf numbers are printed.
//   npm run test:houses
import { start, OUT } from './lib.mjs';
import fs from 'fs';

const h = await start({ viewport: { width: 1280, height: 600 } });
const { page } = h;
let bad = 0;
const ok = (label, cond, extra = '') => { console.log(`${cond ? 'OK  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); if (!cond) bad++; };

// ---- (a) mockup views with the game's house code ----
const VIEWS = [['street', 1920, 600], ['over', 1280, 600], ['game', 1280, 600], ['jalan', 1280, 600],
  ['c:tipe36:c', 900, 600], ['c:tipe45:l', 900, 600], ['c:minimalis:r', 900, 600], ['c:lama:c', 900, 600],
  ['c:terbengkalai:c', 900, 600], ['c:mewah:c', 900, 600], ['c:ruko:l', 900, 600], ['c:musholla:c', 900, 600]];
for (const [v, w, ht] of VIEWS) {
  const r = await page.evaluate(([v, w, ht]) => window.__houses.mockShot(v, w, ht), [v, w, ht]);
  const f = OUT + 'housesmock-' + v.replace(/:/g, '_') + '.png';
  fs.writeFileSync(f, Buffer.from(r.url.split(',')[1], 'base64'));
  ok(`mockup view ${v}`, r.url.length > 20000, `${f} tris ${r.tris} calls ${r.calls}`);
}

// ---- (b) in-game ----
await h.play();
const info = await page.evaluate(() => {
  const c = window.__cat, H = window.__houses;
  const grp = c.scene.getObjectByName('houses');
  const cols = H.colList; // only the house colliders (the street lamps etc. are older and unchanged)
  // colliders on the drivable/walkable street band (main street z -5..5 between x -88 and 66, cross road x -101.6..-92.6)
  const onStreet = cols.filter((a) => a.maxY > 0.2 && a.minY < 2 && a.tag !== 'tiang' && (
    (a.minX < 66 && a.maxX > -88 && a.maxZ > -4.95 && a.minZ < 4.95) ||
    (a.minX < -94.4 && a.maxX > -101.6 && a.maxZ > -82 && a.minZ < 82)));
  return { meshes: grp ? grp.children.length : 0, tris: H.tris, cols: H.cols, wins: H.wins, onStreet: onStreet.length, ex: onStreet.slice(0, 3).map((a) => [a.minX, a.minZ, a.maxX, a.maxZ, a.maxY]) };
});
ok('houses mesh in the scene (few draw calls)', info.meshes > 0 && info.meshes <= 10, `meshes ${info.meshes}, tris ${info.tris}, colliders ${info.cols}, glow windows ${info.wins}`);
ok('no house collider on the street / sidewalk / cross road', info.onStreet === 0, JSON.stringify(info.ex));

// cat can stand on the tipe 45 dak (lot D, local x 1.45..4.4 -> world ~-32.6..-29.6) after a drop
const dak = await page.evaluate(async () => {
  const c = window.__cat, b = c.cat.body;
  b.x = -29.4; b.y = 6; b.z = -12.4; b.vx = b.vz = b.vy = 0; c.cat.setState('free');
  const t0 = c.time; while (c.time - t0 < 1.2) await new Promise((r) => setTimeout(r, 50));
  return b.y;
});
ok('cat stands on a flat dak (tipe 45, lot D)', dak > 3.4 && dak < 3.5, 'y ' + dak.toFixed(2));
// the cat can't walk through a house wall (walk north into the mewah facade on lot E)
const wall = await page.evaluate(async () => {
  const c = window.__cat, b = c.cat.body;
  b.x = 45.5; b.y = 0.2; b.z = -7.5; b.vx = b.vz = b.vy = 0; c.cat.setState('free');
  const t0 = c.time; while (c.time - t0 < 2.0) { b.vz = -4; b.vx = 0; await new Promise((r) => setTimeout(r, 30)); }
  return b.z;
});
ok('house walls block the cat (mewah facade)', wall > -10.4, 'z ' + wall.toFixed(2));

// street-level cameras (like the cat's follow camera, ~2.5 m up, from the street / opposite sidewalk)
const SHOTS = [
  // [name, cat x, z, cam pos, look]
  ['D', -36, 1.5, [-30, 2.6, 4.4], [-38, 2.2, -10]],
  ['D2', -30, -4.3, [-24, 2.0, -1.0], [-36, 2.2, -11]],
  ['E', 52, 1.5, [46, 2.8, 4.4], [54, 2.6, -10]],
  ['E2', 46, 1.5, [58, 2.6, 4.4], [46, 3.0, -10]],
  ['W', -76, 1.5, [-70, 2.6, 4.4], [-80, 2.2, -10]],
  ['backdrop', -92, 1.5, [-91, 2.6, 3.0], [-106, 2.5, -6]],
  ['backdrop2', -92, 1.5, [-91, 2.6, -2.0], [-106, 2.5, 16]],
  ['jalan', -20, 1.5, [-12, 2.4, 2.5], [-40, 1.8, -4]],
  ['abc', 10, 1.5, [12, 2.8, 4.4], [8, 2.0, -14]],
  // close-ups of the facade details on the gameplay houses (visual only)
  ['A', -14, -8, [-11.5, 2.2, -6.5], [-15, 1.8, -13]],
  ['B', 8, -8, [11, 2.2, -7], [7, 1.8, -14]],
  ['C', 30, -8, [34, 2.4, -8], [30, 1.8, -15]],
];
const perf = {};
for (const [n, x, z, cp, lk] of SHOTS) {
  await page.evaluate(([x, z, cp, lk]) => {
    const c = window.__cat, bd = c.cat.body; bd.x = x; bd.y = 0.3; bd.z = z; bd.vx = bd.vz = bd.vy = 0; c.cat.setState('free');
    const V = c.camera.position.constructor;
    c.camRig.override = { pos: new V(...cp), look: new V(...lk) };
    c.camera.position.set(...cp);
  }, [x, z, cp, lk]);
  await h.wait(900);
  perf[n] = await page.evaluate(() => { const r = window.__cat.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
  await h.shot('houses-game-' + n);
}
console.log('perf', JSON.stringify(perf));
ok('draw calls well under 600 at street views', Object.values(perf).every((p) => p.calls < 600), JSON.stringify(Object.fromEntries(Object.entries(perf).map(([k, v]) => [k, v.calls]))));

// ---- (c) night ----
await page.evaluate(() => { const c = window.__cat; c.forceWeather = 'malam'; if (c.day.running) c.day.running = false; c.ui.showScreen(null); c.startDay(); });
for (let i = 0; i < 40; i++) {
  if (await page.evaluate(() => window.__cat.mode === 'play')) break;
  const sk = await page.$('#skipBtn:not([hidden])');
  if (sk) await sk.click().catch(() => {});
  await h.dialogs(2);
  await h.wait(300);
}
ok('night day started', await page.evaluate(() => window.__cat.weather === 'malam'));
await page.evaluate(([cp, lk]) => { const c = window.__cat, V = c.camera.position.constructor; c.cat.body.x = 50; c.cat.body.z = 4.3; c.camRig.override = { pos: new V(...cp), look: new V(...lk) }; c.camera.position.set(...cp); }, [[40, 2.8, 4.4], [52, 2.6, -10]]);
await h.wait(1200);
await h.shot('houses-game-malam');
await page.evaluate(([cp, lk]) => { const c = window.__cat, V = c.camera.position.constructor; c.cat.body.x = -76; c.camRig.override = { pos: new V(...cp), look: new V(...lk) }; c.camera.position.set(...cp); }, [[-66, 2.8, 4.4], [-80, 2.4, -10]]);
await h.wait(900);
await h.shot('houses-game-malam2');

ok('no page errors', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
await page.close();
process.exit(bad ? 1 : 0);
