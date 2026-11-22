// The visual restyle must not move anything the game plays with: every collider,
// water area, night glow window/lamp, named point, prop home, gate and
// interaction point is dumped from the running game and compared to a baseline
// captured from the base commit (integrate/blocky 98e9a1e).
// Allowed differences (Indonesian houses from the approved mockup, src/world/houses/):
//  - colliders inside the decorative lots D, E, W (west of the warung) and the backdrop row x < -102
//    (listed as info),
//  - thin camera-transparent colliders of the new tiang listrik on the north sidewalk (tag 'tiang', listed as info),
//  - new glow windows of the decorative houses (inside those rectangles); A/B/C glow windows stay identical.
// Everything else must be identical.
//   node test/world-colliders.mjs            compare with test/fixtures/world-colliders.json
//   node test/world-colliders.mjs --write    (re)write the baseline (only on the base build!)
//   node test/world-colliders.mjs --html <file> --out <json>   dump any build to a file
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const html = path.resolve(opt('--html', 'dist/cat-simulator.html'));
const FIX = 'test/fixtures/world-colliders.json';
const outFile = opt('--out', args.includes('--write') ? FIX : null);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 844, height: 390 }, locale: 'id-ID' });
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto('file://' + html);
await page.waitForFunction(() => !!window.__cat?.ui && !!window.__cat?.interact, null, { timeout: 60000 });
const dump = await page.evaluate(() => {
  const c = window.__cat, W = c.world;
  const r = (n) => Math.round(n * 1000) / 1000;
  const v = (p) => [r(p.x), r(p.y), r(p.z)];
  const aabb = (a) => [r(a.minX), r(a.minY), r(a.minZ), r(a.maxX), r(a.maxY), r(a.maxZ), a.cam ? 1 : 0, a.off ? 1 : 0, a.tag || ''];
  const pts = {};
  for (const k of Object.keys(W.pts).sort()) pts[k] = v(W.pts[k]);
  const props = {};
  for (const k of Object.keys(W.props).sort()) {
    const p = W.props[k];
    props[k] = { home: v(p.home), rot: [r(p.homeRot.x), r(p.homeRot.y), r(p.homeRot.z)], surface: r(p.surface) };
  }
  const gates = {};
  for (const k of Object.keys(W.gates).sort()) gates[k] = W.gates[k].cols.map(aabb);
  return {
    decorRects: window.__houses?.rects || null,
    colliders: W.phys.list.map(aabb),
    water: W.water.map((w) => [r(w.x0), r(w.z0), r(w.x1), r(w.z1)]),
    glowWindows: W.glow.windows.map((w) => [w.x0, w.y0, w.z0, w.x1, w.y1, w.z1, w.px, w.pz].map(r)),
    glowLamps: W.glow.lamps.map(v),
    glowIndoor: W.glow.indoor.map((w) => [r(w.x0), r(w.z0), r(w.x1), r(w.z1)]),
    zones: W.zones.map((z) => [z.id, r(z.x0), r(z.z0), r(z.x1), r(z.z1), z.ymin ?? null]),
    dogYard: W.dogYard,
    pts,
    props,
    gates,
    interact: c.interact.list.map((i) => [i.id, ...v(i.pos), r(i.r), i.yTol ?? null]),
  };
});
await browser.close();
if (errs.length) { console.log('PAGE ERRORS', errs); process.exitCode = 1; }

// order-independent comparison of the collider list (multiset of rounded boxes)
const key = (a) => JSON.stringify(a);
if (outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(dump));
  console.log('wrote', outFile, 'colliders', dump.colliders.length, 'interact', dump.interact.length);
} else {
  const base = JSON.parse(fs.readFileSync(FIX, 'utf8'));
  let bad = 0;
  const report = (label, ok, extra = '') => { console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`); if (!ok) bad++; };
  // decorative areas whose colliders may change (same numbers as src/world/houses/index.ts DECOR_RECTS)
  const R = dump.decorRects || {
    D: { x0: -46, z0: -31, x1: -24.2, z1: -5.0 },
    E: { x0: 40.1, z0: -31, x1: 66, z1: -5.0 },
    W: { x0: -88, z0: -20, x1: -64, z1: -5.0 },
    backdrop: { x0: -120, z0: -90, x1: -102, z1: 90 },
  };
  report('decorative rectangles as specified', R.D.x0 === -46 && R.D.x1 === -24.2 && R.E.x0 === 40.1 && R.E.x1 === 66 && R.W.x0 === -88 && R.W.x1 === -64 && R.backdrop.x1 === -102, JSON.stringify(R));
  const EPS = 0.25; // fence corner posts sit centred on the lot line (0.32 m wide)
  const inRect = (r, x0, z0, x1, z1) => x0 >= r.x0 - EPS && x1 <= r.x1 + EPS && z0 >= r.z0 - EPS && z1 <= r.z1 + EPS;
  const area = (a) => { for (const [n, r] of Object.entries(R)) if (inRect(r, a[0], a[2], a[3], a[5])) return n; return null; };
  // colliders as multisets
  const cnt = new Map();
  for (const a of base.colliders) cnt.set(key(a), (cnt.get(key(a)) || 0) + 1);
  for (const a of dump.colliders) cnt.set(key(a), (cnt.get(key(a)) || 0) - 1);
  const diff = [...cnt].filter(([, n]) => n !== 0).map(([k, n]) => ({ a: JSON.parse(k), n }));
  const info = {}, poles = [], bad2 = [];
  for (const d of diff) {
    const ar = area(d.a);
    if (ar) { const i = (info[ar] ||= { removed: 0, added: 0 }); if (d.n > 0) i.removed += d.n; else i.added -= d.n; continue; }
    // new tiang listrik: thin (<= 0.3 m) camera-transparent poles on the north sidewalk, added only
    if (d.n < 0 && d.a[8] === 'tiang' && d.a[6] === 0 && d.a[3] - d.a[0] <= 0.3 && d.a[5] - d.a[2] <= 0.3 && d.a[2] >= -5.1 && d.a[5] <= -3.5) { poles.push(d.a); continue; }
    bad2.push(d);
  }
  console.log('info decorative collider changes', JSON.stringify(info));
  console.log(`info new tiang listrik colliders on the sidewalk: ${poles.length}` + (poles.length ? ' x=' + poles.map((a) => ((a[0] + a[3]) / 2).toFixed(1)).join(',') : ''));
  report('colliders identical outside the decorative lots', bad2.length === 0, `base ${base.colliders.length} now ${dump.colliders.length}` + (bad2.length ? '\n   ' + bad2.slice(0, 12).map(({ a, n }) => (n > 0 ? 'missing ' : 'extra   ') + JSON.stringify(a)).join('\n   ') : ''));
  // glow windows: the base ones (A/B/C, school, ...) identical and in order; new ones only inside the decorative areas
  {
    const bw = base.glowWindows, nw = dump.glowWindows;
    const sb = new Set(nw.map(key));
    const missing = bw.filter((w) => !sb.has(key(w)));
    const removedOk = missing.filter((w) => area([w[0], w[1], w[2], w[3], w[4], w[5]]));
    const missingBad = missing.filter((w) => !area([w[0], w[1], w[2], w[3], w[4], w[5]]));
    const sa = new Set(bw.map(key));
    const added = nw.filter((w) => !sa.has(key(w)));
    const addedBad = added.filter((w) => !area([w[0], w[1], w[2], w[3], w[4], w[5]]));
    console.log(`info glow windows: base ${bw.length}, removed in decorative lots ${removedOk.length}, new in decorative lots ${added.length - addedBad.length}`);
    report('glowWindows identical outside the decorative lots', missingBad.length === 0 && addedBad.length === 0, `missing ${JSON.stringify(missingBad.slice(0, 3))} extra ${JSON.stringify(addedBad.slice(0, 3))}`);
  }
  // the chicken flock (pts.ayam + its interact point) lives in lot D's front yard; the new houses fill most of it,
  // so it may move, but only inside lot D
  {
    const inD = (x, z) => inRect(R.D, x, z, x, z);
    const ok = (a, b) => !a || !b || (inD(a[0], a[2]) && inD(b[0], b[2]));
    const pa = base.pts.ayam, pb = dump.pts.ayam;
    const ia = base.interact.find((r) => r[0] === 'ayam'), ib = dump.interact.find((r) => r[0] === 'ayam');
    report('chicken point stays in lot D', ok(pa, pb) && ok(ia && ia.slice(1), ib && ib.slice(1)), JSON.stringify([pa, pb]));
    if (pa && pb) base.pts.ayam = pb;
    if (ia && ib) base.interact[base.interact.indexOf(ia)] = ib;
  }
  for (const k of ['water', 'glowLamps', 'glowIndoor', 'zones', 'dogYard', 'pts', 'props', 'gates', 'interact']) {
    const a = key(base[k]), b = key(dump[k]);
    let extra = '';
    if (a !== b) {
      if (Array.isArray(base[k])) {
        const sa = new Set(base[k].map(key)), sb = new Set(dump[k].map(key));
        extra = `base ${base[k].length} now ${dump[k].length}; missing ${[...sa].filter((x) => !sb.has(x)).slice(0, 5).join(' ')}; extra ${[...sb].filter((x) => !sa.has(x)).slice(0, 5).join(' ')}`;
      } else {
        const ks = new Set([...Object.keys(base[k]), ...Object.keys(dump[k])]);
        extra = [...ks].filter((x) => key(base[k][x]) !== key(dump[k][x])).slice(0, 8).map((x) => `${x}: ${key(base[k][x])} -> ${key(dump[k][x])}`).join('; ');
      }
    }
    report(`${k} identical`, a === b, extra);
  }
  if (bad) process.exitCode = 1;
}
