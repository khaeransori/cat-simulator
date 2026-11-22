// Draw calls + triangles at a few fixed views (phone budget check).
//   node test/perf-views.mjs [--html dist/cat-simulator.html]
import { chromium } from 'playwright';
import path from 'path';
const args = process.argv.slice(2);
const i = args.indexOf('--html');
const html = path.resolve(i >= 0 ? args[i + 1] : 'dist/cat-simulator.html');
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await b.newPage({ viewport: { width: 844, height: 390 }, locale: 'id-ID' });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
const W = (t) => page.waitForTimeout(t);
await page.goto('file://' + html);
await page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
await page.click('#mPlay'); await W(400);
const sd = await page.$('#styleDone'); if (sd) { await sd.click(); await W(400); }
const sk = await page.$('#skipBtn:not([hidden])'); if (sk) await sk.click();
await W(700);
for (let k = 0; k < 10; k++) { const d = await page.$('#dialog:not([hidden])'); if (!d) break; await d.click(); await W(250); }
await page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 });
const info = () => page.evaluate(() => { const r = window.__cat.renderer.info.render; return { calls: r.calls, tris: r.triangles }; });
await W(1200);
const res = { start: await info() };
const VIEWS = [
  ['jalan', 6, 4.2, [0, 4.5, 14], [8, 1, -4]],
  ['pasar', 40, 20, [30, 7, 37], [42, 0.5, 18]],
  ['barat', -70, 4.3, [-55, 9, 22], [-75, 1, -2]],
  ['overview', -2, 4.3, [55, 48, 62], [-5, 0, 2]],
  // street level (cat camera height) along the street with the Indonesian houses
  ['st_D', -36, 1.5, [-30, 2.6, 4.4], [-38, 2.2, -10]],
  ['st_west', -20, 1.5, [-12, 2.4, 2.5], [-40, 1.8, -4]],
  ['st_east', 46, 1.5, [58, 2.6, 4.4], [46, 3.0, -10]],
  ['st_E', 52, 1.5, [46, 2.8, 4.4], [54, 2.6, -10]],
  ['st_W', -76, 1.5, [-70, 2.6, 4.4], [-80, 2.2, -10]],
  ['st_cross', -92, 1.5, [-91, 2.6, 3.0], [-106, 2.5, -6]],
];
for (const [n, x, z, cp, lk] of VIEWS) {
  await page.evaluate(([x, z, cp, lk]) => {
    const c = window.__cat, bd = c.cat.body; bd.x = x; bd.y = 0.3; bd.z = z; bd.vx = bd.vz = bd.vy = 0; c.cat.setState('free');
    const V = c.camera.position.constructor;
    c.camRig.override = { pos: new V(...cp), look: new V(...lk) };
    c.camera.position.set(...cp);
  }, [x, z, cp, lk]);
  await W(1500);
  res[n] = await info();
}
const tri = await page.evaluate(() => { const g = window.__cat.world.mesh.geometry; return (g.index ? g.index.count : g.attributes.position.count) / 3; });
console.log(JSON.stringify({ html: path.basename(path.dirname(path.dirname(html))), worldMeshTris: tri, ...res }));
if (errs.length) console.log('errs', errs.slice(0, 3));
await b.close();
