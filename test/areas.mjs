// New edge areas (Sekolah, Warung, Sungai): every new mischief by teleport + E,
// the new NPCs shoo, the walk from the house is not blocked, and the day still ends.
import { start, check } from './lib.mjs';
const h = await start();
try { await h.play(); } catch (e) { await h.dialogs(); await h.page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 }); await h.ev(() => (window.__cat.timeScale = 3)); }

// ---- areas + zones ----
const zones = await h.ev(() => window.__cat.world.zones.map((z) => z.id));
for (const a of ['sekolah', 'warung', 'sungai']) check('zone ' + a, zones.includes(a));
check('river fishing point placed', await h.ev(() => !!window.__cat.world.pts.riverFish && !!window.__cat.world.pts.riverFishLook));

// ---- screenshots ----
const views = [
  ['areas-sekolah-gate', -71, 0, 0.5, 0, 0.25],
  ['areas-sekolah-yard', -66, 0, 9, -0.6, 0.35],
  ['areas-sekolah-kelas', -72, 0, 21.5, 0, 0.35],
  ['areas-warung', -56, 0, -2.2, Math.PI, 0.3],
  ['areas-warung-dalam', -53.2, 0, -6.3, Math.PI + 0.6, 0.3],
  ['areas-sungai', 15, 0, 44, 0, 0.35],
  ['areas-sungai-jembatan', 9, 0, 46.5, -0.5, 0.3],
];
for (const [n, x, y, z, yaw, pitch] of views) {
  await h.tp(x, y, z, yaw, 100);
  await h.ev((p) => { const c = window.__cat; c.camRig.pitch = p; c.camRig.dist = 4.5; c.camRig.snap(c.cat); }, pitch);
  await h.wait(900);
  await h.shot(n);
}
await h.ev(() => (window.__cat.camRig.dist = 2.5));

// ---- every new mischief ----
const spots = [
  ['papan', -72, 0, 26.2, 0, 2600],
  ['buku', -71.25, 0.8, 24.75, 0, 1800],
  ['meja_guru', -72.6, 0.8, 24.9, Math.PI, 2400],
  ['bel', -60.75, 0, 15.6, 0, 1400],
  ['kerupuk', -59.3, 1.0, -10.1, 0, 400, true],
  ['permen', -55.75, 1.0, -10.1, 0, 1800],
  ['galon', -51.2, 0, -5.6, Math.PI, 1400],
  ['kulkas', -60.7, 0.9, -6.7, 0, 2400],
  ['perahu', 30, 0.2, 49.4, 0, 1200],
  ['kupu', -3, 0.12, 43.2, 0, 1000],
  ['bebek', 34, 0, 45, 0, 1000],
  ['cebur', 22, 0.25, 53.55, 0, 900],
];
for (const [id, x, y, z, yaw, w, eat] of spots) {
  await h.ev(() => window.__cat.npcs.forEach((n) => (n.cooldown = 99))); // keep NPCs from shooing during the run
  const cur = await h.tp(x, y, z, yaw, 400);
  await h.key('KeyE', 300);
  // poll (headless GL on a busy server can run game time slowly)
  let ok = false;
  for (let t = 0; t < w * 4 && !ok; t += 250) { ok = (await h.done()).includes(id); if (!ok) await h.wait(250); }
  check('mischief ' + id, ok, `nearest=${cur}`);
  if (eat) await h.key('KeyE', 1400);
}
await h.ev(() => window.__cat.npcs.forEach((n) => (n.cooldown = 0)));
await h.tp(-72, 0, 23.5, 0, 200);
await h.ev((p) => { const c = window.__cat; c.camRig.pitch = 0.35; c.camRig.snap(c.cat); });
await h.wait(500);
await h.shot('areas-kelas-after');

// ---- new NPCs exist and shoo ----
for (const [name, x, z] of [['satpam', -66, 12], ['buwarung', -56, -8.2]]) {
  const r = await h.ev(async ([name, x, z]) => {
    const C = window.__cat;
    const n = C.npcs.find((h) => h.name === name);
    if (!n) return 'missing';
    const b = C.cat.body;
    b.x = x; b.y = 0; b.z = z; b.vx = b.vz = b.vy = 0;
    C.cat.setState('free');
    n.cooldown = 0;
    n.body.x = x + 2; n.body.z = z; n.yaw = -Math.PI / 2;
    C.cat.lastMischiefT = C.time; C.cat.lastMischiefPos.copy(C.cat.pos);
    n.alert();
    let shooed = false;
    const prev = C.onShooed;
    C.onShooed = (h) => { if (h === n) shooed = true; prev(h); };
    for (let i = 0; i < 80 && !shooed; i++) await new Promise((r) => setTimeout(r, 100));
    C.onShooed = prev;
    return shooed ? 'shooed' : 'state=' + n.state;
  }, [name, x, z]);
  check('npc ' + name + ' shoos', r === 'shooed', r);
}

// ---- walk from the house to each area (real physics, straight-line legs) ----
// Simulates the cat body running at full speed (4.9 m/s) along waypoints with the game's physics.
const walks = {
  warung: [[-14, -8], [-14, -0.5], [-50, -0.5], [-56, -4.6], [-56, -7.5]],
  sekolah: [[-14, -8], [-14, -0.5], [-71, -0.5], [-71, 10]],
  sungai: [[-14, -8], [-14, -0.5], [13.6, -0.5], [13.6, 41], [14.9, 46], [15, 48]],
};
for (const [area, wp] of Object.entries(walks)) {
  const r = await h.ev((wp) => {
    const C = window.__cat, phys = C.world.phys;
    const b = { x: -14.2, y: 0, z: -12.2, vx: 0, vy: 0, vz: 0, r: 0.22, h: 0.55, onGround: true, stepH: 0.26, climbH: 0.5, g: 18 };
    let t = 0, i = 0;
    const dt = 1 / 60;
    while (i < wp.length && t < 60) {
      const [tx, tz] = wp[i];
      const dx = tx - b.x, dz = tz - b.z, d = Math.hypot(dx, dz);
      if (d < 0.3) { i++; continue; }
      b.vx = (dx / d) * 4.9; b.vz = (dz / d) * 4.9;
      const px = b.x, pz = b.z;
      phys.move(b, dt);
      t += dt;
      if (Math.hypot(b.x - px, b.z - pz) < 0.02) return { ok: false, t, at: [b.x.toFixed(1), b.z.toFixed(1)], i };
    }
    return { ok: i >= wp.length, t, zone: C.day.zoneAt(b.x, b.y, b.z) };
  }, wp);
  check(`walk house -> ${area} < 25 s`, r.ok && r.t < 25 && r.zone === area, JSON.stringify(r));
}

// ---- map screen ----
await h.page.click('#btnMap');
await h.wait(600);
await h.shot('areas-map');
await h.page.click('#mBack');
await h.wait(400);

// ---- day reset: props back home, flocks + butterflies back ----
// ---- and the end-of-day cutscene from far away still finishes ----
await h.tp(-71, 0, 10, 0, 300);
const arrow = await h.ev(() => { const d = window.__cat.day; d.timeLeft = 30; return true; });
await h.wait(600);
check('sofa arrow shows from the school', await h.ev(() => window.__cat.day.arrow.visible), String(arrow));
await h.ev(() => (window.__cat.day.timeLeft = 0.5));
for (let k = 0; k < 14; k++) { await h.wait(1000); await h.dialogs(); if (await h.page.$('#sNext')) break; }
check('day end summary (caught outside)', !!(await h.page.$('#sNext')));
const sum = await h.ev(() => document.body.innerText);
check('summary lists new mischief', sum.includes('Bunyiin bel sekolah'));
await h.page.click('#sNext');
await h.wait(700);
{ const sk = await h.page.$('#skipBtn:not([hidden])'); if (sk) await sk.click(); }
await h.wait(700);
await h.dialogs();
await h.page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 });
const reset = await h.ev(() => {
  const C = window.__cat, P = C.world.props;
  const at = (id) => P[id].obj.position.distanceTo(P[id].home) < 0.01 && P[id].obj.visible;
  return {
    props: ['buku', 'permen', 'galon', 'perahu', 'bel'].filter((id) => !at(id)),
    chip: P.kerupuk.data.chip.parent === P.kerupuk.obj,
    galonUp: P.galon.data.mid.rotation.z === 0,
    ducks: C.flocks[2].state,
    bf: C.butterflies.state,
    done: C.day.doneToday.size,
  };
});
check('day reset restores new props', reset.props.length === 0 && reset.chip && reset.galonUp && reset.ducks === 'ground' && reset.bf === 'idle' && reset.done === 0, JSON.stringify(reset));
await h.close();
