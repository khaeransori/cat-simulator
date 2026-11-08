// Traffic (random cars & motorbikes) + road works (excavator, roller, fresh asphalt) + new mischief.
import { start, check } from './lib.mjs';

const h = await start();
const quality = process.env.Q || 'high';
await h.ev((q) => (window.__cat.save.settings.quality = q, window.__cat.applyQuality()), quality);

async function day(opts = {}) {
  await h.ev((o) => {
    const c = window.__cat;
    c.forceWeather = o.w || 'cerah';
    c.forceWorks = o.works || 'none';
    if (c.day.running) c.day.running = false;
    c.ui.showScreen(null);
    c.startDay();
  }, opts);
  for (let i = 0; i < 40; i++) {
    if (await h.ev(() => window.__cat.mode === 'play')) break;
    const sk = await h.page.$('#skipBtn:not([hidden])');
    if (sk) await sk.click().catch(() => {});
    await h.dialogs(2);
    await h.wait(400);
  }
  await h.page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 });
  await h.ev(() => { const c = window.__cat; c.timeScale = 3; c.day.timeLeft = c.day.len * 0.9; });
}

await h.play();
// overview shot from a fixed camera
const view = async (name, pos, look) => {
  await h.ev(([p, l]) => { const C = window.__cat; C.camRig.override = { pos: new C.camera.position.constructor(...p), look: new C.camera.position.constructor(...l) }; C.camRig.update(0, C.cat, true); }, [pos, look]);
  await gw(0.3);
  await h.shot(name);
  await h.ev(() => { const C = window.__cat; C.camRig.override = null; C.camRig.snap(C.cat); });
};
// headless GL on a busy server is slow: wait in GAME seconds, not wall seconds
const gw = async (sec) => {
  const t0 = await h.ev(() => window.__cat.time);
  for (let i = 0; i < 600; i++) {
    await h.wait(150);
    if ((await h.ev(() => window.__cat.time)) - t0 >= sec) return;
  }
};
const fps = await h.page.evaluate(async () => { const t0 = window.__cat.time, w0 = performance.now(); await new Promise((r) => setTimeout(r, 2000)); return ((window.__cat.time - t0) / ((performance.now() - w0) / 1000)).toFixed(2); });
console.log('game seconds per wall second:', fps);

// ---------------- random vehicles ----------------
const mix = await h.ev(() => {
  const { randomSpec, VTYPES } = window.__cat.trafficApi;
  const types = new Set(), engines = new Set(), colors = new Set(), kinds = { car: 0, motor: 0 };
  let pass = 0, elecCar = 0;
  for (let i = 0; i < 400; i++) {
    const s = randomSpec();
    types.add(s.type); engines.add(s.engine); colors.add(s.color); kinds[s.kind]++;
    if (s.passenger) pass++;
    if (s.kind === 'car' && s.engine === 'listrik') elecCar++;
    const t = VTYPES.find((x) => x.id === s.type);
    if (!t.engines.includes(s.engine) || s.speed < t.speed[0] || s.speed > t.speed[1]) return { bad: s };
  }
  return { types: types.size, all: VTYPES.length, engines: [...engines].sort(), colors: colors.size, kinds, pass, elecCar };
});
console.log('mix', JSON.stringify(mix));
check('random vehicles: every type shows up', mix.types === mix.all, JSON.stringify(mix));
check('random vehicles: all 5 engine kinds', mix.engines && mix.engines.length === 5);
check('random vehicles: many paint colours', mix.colors >= 12);
check('random vehicles: cars and motorbikes', mix.kinds && mix.kinds.car > 100 && mix.kinds.motor > 100);
check('random vehicles: some motorbikes carry a passenger', mix.pass > 10);

// ---------------- trips go THROUGH: in at one end, out at the other, vanish far away ----------------
const trips = await h.ev(() => {
  const T = window.__cat.traffic; const r = { through: 0, uturn: 0, farStart: 0, farEnd: 0, west: 0, east: 0 };
  for (let i = 0; i < 40; i++) {
    const v = T.spawn(); if (!v) { for (const o of T.vehicles) o.dispose(); T.vehicles = []; continue; }
    const p = v.path, n = p.xs.length - 1;
    if (Math.sign(p.xs[0]) !== Math.sign(p.xs[n])) r.through++; else r.uturn++;
    if (Math.abs(p.zs[0]) > 70) r.farStart++;
    if (Math.abs(p.zs[n]) > 70) r.farEnd++;
    if (p.xs[0] > 0) r.west++; else r.east++;
    v.dispose(); T.vehicles.splice(T.vehicles.indexOf(v), 1);
  }
  return r;
});
console.log('trips', JSON.stringify(trips));
check('every trip goes through (no U-turn)', trips.uturn === 0 && trips.through === 40, JSON.stringify(trips));
check('trips start and end far away, out of sight', trips.farStart === 40 && trips.farEnd === 40);
check('both directions', trips.west > 5 && trips.east > 5);

// ---------------- traffic on a normal day ----------------
await day();
const t0 = await h.ev(() => {
  const T = window.__cat.traffic;
  return { n: T.vehicles.length, works: T.works, exc: window.__cat.works.exc.root.visible, max: T.max };
});
check('vehicles on the street at day start', t0.n >= 1 && t0.n <= t0.max, JSON.stringify(t0));
check('no road works when not forced', !t0.works && !t0.exc);
// watch for a while: vehicles move, spawn, leave; never two overlapping
await h.tp(-10, 0.15, 4.4, Math.PI / 2, 200); // cat on the south sidewalk, out of the way
const watch = await h.page.evaluate(async () => {
  const C = window.__cat, T = C.traffic;
  const seen = new Set(), done = new Set(); let overlap = 0, maxN = 0, moved = 0;
  const pos = {};
  const end = C.time + 60;
  while (C.time < end) {
    const tt = C.time;
    while (C.time - tt < 0.5) await new Promise((r) => setTimeout(r, 50));
    const vs = T.vehicles; maxN = Math.max(maxN, vs.length);
    for (const v of vs) {
      if (pos[v.id] && Math.hypot(v.x - pos[v.id][0], v.z - pos[v.id][1]) > 0.5) moved++;
      pos[v.id] = [v.x, v.z]; seen.add(v.id);
    }
    for (const id of Object.keys(pos)) if (!vs.some((v) => v.id === +id)) done.add(id);
    for (let a = 0; a < vs.length; a++) for (let b = a + 1; b < vs.length; b++) {
      const A = vs[a], B = vs[b];
      if (Math.hypot(A.x - B.x, A.z - B.z) < Math.min(A.hl, B.hl) + 0.3) overlap++;
    }
  }
  return { seen: seen.size, done: done.size, overlap, maxN, moved, spawned: T.stats.spawned };
});
console.log('watch', JSON.stringify(watch));
check('vehicles drive (they move)', watch.moved > 20, JSON.stringify(watch));
check('new vehicles keep coming', watch.seen >= 3);
check('vehicles never overlap each other', watch.overlap === 0);
check('never more than the cap', watch.maxN <= 4);

// ---------------- kid-safe: always stop for the cat, honk ----------------
await h.ev(() => { const T = window.__cat.traffic; for (const v of T.vehicles) v.dispose(); T.vehicles = []; T.spawnT = 99; T.stats.braked = T.stats.honks = T.stats.bumps = 0; T.stats.closest = 99; });
await h.tp(12, 0, 1.7, -Math.PI / 2, 300); // standing in the westbound lane
await h.ev(() => window.__cat.traffic.testCar({ type: 'pickup', color: 0xe53935, engine: 'diesel' }, 22));
await gw(7);
const safe = await h.ev(() => {
  const C = window.__cat, T = C.traffic, v = T.vehicles[0], b = C.cat.body;
  return { braked: T.stats.braked, honks: T.stats.honks, bumps: T.stats.bumps, closest: T.stats.closest, v: v?.v, gap: v ? Math.hypot(v.x - b.x, v.z - b.z) - v.hl : -1 };
});
console.log('safe', JSON.stringify(safe));
await view('traffic-stop', [18, 2.6, 6.5], [10, 0.6, 1]);
check('car stops in front of the cat', safe.braked >= 1 && safe.v < 0.3, JSON.stringify(safe));
check('it keeps a gap (never touches the cat)', safe.closest > 0.6 && safe.bumps === 0);
check('it honks "tin tin!"', safe.honks >= 1);
// the cat steps aside: the car drives on
await h.tp(12, 0.15, 4.4, 0, 100);
await gw(4);
const gone = await h.ev(() => { const v = window.__cat.traffic.vehicles[0]; return { v: v?.v, x: v?.x }; });
check('car drives on when the cat moves away', gone.v > 1, JSON.stringify(gone));

// ---------------- the new mischief: hitch a ride ----------------
await h.ev(() => { const T = window.__cat.traffic; for (const v of T.vehicles) v.dispose(); T.vehicles = []; });
await h.tp(-6, 0, 1.7, -Math.PI / 2, 200);
await h.ev(() => window.__cat.traffic.testCar({ type: 'sedan', color: 0x1e88e5 }, 20));
await gw(7); // stops for the cat
const roof = await h.ev(() => {
  const C = window.__cat, v = C.traffic.vehicles[0], b = C.cat.body;
  // hop up: put the cat right above the roof (like a jump), physics + movers do the rest
  const t = v.tops.reduce((a, x) => (x.y > a.y ? x : a));
  const lx = (t.x0 + t.x1) / 2, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  b.x = v.x + lx * c; b.z = v.z - lx * s; b.y = t.y + 0.3; b.vy = 0; b.onGround = false;
  return { y: t.y, type: v.spec.type };
});
await gw(0.6);
const on = await h.ev(() => ({ ride: !!window.__cat.traffic.ride, y: window.__cat.cat.body.y }));
check('cat can stand on the car roof', on.ride && Math.abs(on.y - roof.y) < 0.05, JSON.stringify({ on, roof }));
await gw(5);
const rode = await h.ev(() => { const C = window.__cat; return { dist: C.traffic.rideDist, ride: !!C.traffic.ride, done: C.day.doneToday.has('numpang'), x: C.cat.body.x }; });
console.log('ride', JSON.stringify(rode));
await h.ev(() => (window.__cat.timeScale = 0.0001));
{ const p = await h.ev(() => [window.__cat.cat.body.x, window.__cat.cat.body.z]); await view('traffic-ride', [p[0] - 5, 3.2, p[1] + 6], [p[0], 1.2, p[1]]); }
await h.ev(() => (window.__cat.timeScale = 3));
check('the car drives with the cat on top', rode.dist > 3, JSON.stringify(rode));
check('mischief "Numpang mobil lewat" done', rode.done);
// long ride east: it stops before the gate, the cat never leaves the kompleks
await h.ev(() => { const C = window.__cat; C.timeScale = 4; });
await gw(40);
const edge = await h.ev(() => { const C = window.__cat; return { x: C.cat.body.x, ride: !!C.traffic.ride }; });
check('cat never rides out of the kompleks', edge.x < 63.7 && edge.x > -87.7, JSON.stringify(edge));
await h.ev(() => { const C = window.__cat; C.timeScale = 3; });

// ---------------- road works: dig day ----------------
await day({ works: 'gali' });
const g = await h.ev(() => {
  const C = window.__cat, W = C.works;
  return { stage: W.stage, exc: W.exc.root.visible, hole: W.hole.visible, cones: W.cones.count, cols: W.cols.every((c) => !c.off), lane: C.traffic.works, mandor: C.npcs.find((n) => n.name === 'mandor').active };
});
check('dig day: excavator, hole, cones, foreman', g.stage === 'gali' && g.exc && g.hole && g.cones > 10 && g.cols && g.lane && g.mandor, JSON.stringify(g));
// the excavator really digs (joints move)
const arm = await h.page.evaluate(async () => {
  const W = window.__cat.works; const a = [];
  const C = window.__cat;
  for (let i = 0; i < 24; i++) { a.push([W.ang.cab, W.ang.boom, W.bucketPos.y]); const tt = C.time; while (C.time - tt < 0.5) await new Promise((r) => setTimeout(r, 50)); }
  const cab = a.map((x) => x[0]), by = a.map((x) => x[2]);
  return { cabRange: Math.max(...cab) - Math.min(...cab), yRange: Math.max(...by) - Math.min(...by) };
});
check('excavator arm swings and digs', arm.cabRange > 0.5 || arm.yRange > 0.8, JSON.stringify(arm));
await view('works-gali', [37, 5.5, 6.5], [50, 0.5, -2]);
// one lane for both directions: never opposite vehicles in the works segment at the same time
const shared = await h.page.evaluate(async () => {
  const C = window.__cat, T = C.traffic, Wk = { x0: 35.5, x1: 62.5 };
  C.cat.body.x = 20; C.cat.body.z = 4.4; C.cat.body.y = 0.15;
  T.spawnT = 0;
  let clash = 0, through = 0, maxStuck = 0; const inside = new Set(); const still = {};
  const end = C.time + 90;
  while (C.time < end) {
    const tt = C.time;
    while (C.time - tt < 0.25) await new Promise((r) => setTimeout(r, 40));
    const vs = T.vehicles.filter((v) => v.x > Wk.x0 && v.x < Wk.x1 && Math.abs(v.z) < 4);
    const dirs = new Set(vs.map((v) => Math.cos(v.yaw) > 0 ? 1 : -1));
    if (dirs.size > 1) {
      // opposite cars in the segment must not be side by side in the narrow part
      for (const a of vs) for (const b of vs) if (a !== b && Math.cos(a.yaw) * Math.cos(b.yaw) < 0 && Math.abs(a.x - b.x) < a.hl + b.hl && Math.abs(a.z - b.z) < 1.4) clash++;
    }
    for (const v of vs) { if (!inside.has(v.id)) { inside.add(v.id); through++; } }
    for (const v of T.vehicles) { still[v.id] = v.v < 0.1 ? (still[v.id] || 0) + 1 : 0; maxStuck = Math.max(maxStuck, still[v.id]); }
  }
  return { clash, through, maxStuck, conesHit: 0 };
});
console.log('shared', JSON.stringify(shared));
check('traffic takes turns in the one open lane (no clash)', shared.clash === 0, JSON.stringify(shared));
check('traffic still passes the road works', shared.through >= 1);
check('no vehicle stuck for long', shared.maxStuck < 100); // 25 s
// mischief: ride the excavator bucket (wait for its break, hop in)
await h.ev(() => { const W = window.__cat.works; W.phase = 'rest'; W.cyc = 0; });
await gw(5);
const bp = await h.ev(() => { const p = window.__cat.works.bucketPos; return { x: p.x, y: p.y, z: p.z, can: window.__cat.works.canRide() }; });
const near = await h.tp(bp.x - 0.4, 0, bp.z + 0.3, Math.PI / 2, 600);
check('excavator bucket rests on the road (hop-in point)', bp.can && bp.y < 0.6, JSON.stringify(bp));
check('"Naik" action next to the bucket', near === 'ekskavator', String(near));
await h.key('KeyE', 100);
await gw(3.2);
const up = await h.ev(() => { const C = window.__cat; return { st: C.cat.state, y: C.cat.body.y, x: C.cat.body.x }; });
await view('works-ride', [up.x - 5, 3.6, 6], [up.x + 1, 1.6, -1]);
check('cat goes up in the bucket', up.st === 'ride' && up.y > 1.2, JSON.stringify(up));
await gw(6);
const down = await h.ev(() => { const C = window.__cat; return { st: C.cat.state, y: C.cat.body.y, done: C.day.doneToday.has('ekskavator') }; });
check('mischief "Naik sendok ekskavator" done', down.done, JSON.stringify(down));
check('cat is let down again', down.st === 'free' && down.y < 1, JSON.stringify(down));
// knock a cone over
await h.ev(() => { const C = window.__cat, W = C.works, c = W.coneSpots[2], b = C.cat.body; b.x = c.x - 1.6; b.z = c.z; b.y = 0; C.cat.yaw = Math.PI / 2; C.camRig.yaw = Math.PI / 2; C.camRig.snap(C.cat); C.cat.setState('free'); });
await h.page.keyboard.down('KeyW');
await gw(0.9);
await h.page.keyboard.up('KeyW');
const cone = await h.ev(() => window.__cat.works.coneSpots[2].fall);
check('cat can topple a cone', cone > 0, String(cone));

// ---------------- road works: fresh asphalt day ----------------
await day({ works: 'aspal' });
const a = await h.ev(() => { const W = window.__cat.works; return { stage: W.stage, fresh: W.fresh.visible, roller: W.roller.root.visible, movers: window.__cat.traffic.movers.length }; });
check('asphalt day: fresh asphalt + road roller', a.stage === 'aspal' && a.fresh && a.roller && a.movers === 1, JSON.stringify(a));
// walk across the soft asphalt (past the roller)
await h.tp(48.6, 0, -2.95, Math.PI / 2, 300);
await h.page.keyboard.down('KeyW');
await gw(1.8);
await h.page.keyboard.up('KeyW');
await gw(0.3);
const pr = await h.ev(() => { const C = window.__cat; return { n: C.works.printN, done: C.day.doneToday.has('cap_kaki'), saved: C.save.works.prints.length, x: C.cat.body.x }; });
console.log('prints', JSON.stringify(pr));
await view('works-aspal', [46, 4.2, 3.5], [52, 0, -2]);
check('paw prints in the fresh asphalt', pr.n >= 5, JSON.stringify(pr));
check('mischief "Cap kaki di aspal baru" done', pr.done);
// the roller is a solid the cat can stand on
const rl = await h.ev(() => { const C = window.__cat, R = C.works.rollerMover, b = C.cat.body; b.x = R.x - 1.0; b.z = R.z; b.y = 1.8; b.vy = 0; b.onGround = false; return 1; });
await gw(0.8);
const onR = await h.ev(() => ({ y: window.__cat.cat.body.y, ride: !!window.__cat.traffic.ride }));
check('cat can sit on the road roller', onR.ride && Math.abs(onR.y - 1.5) < 0.05, JSON.stringify(onR));
void rl;

// ---------------- the new smooth road keeps the paw prints ----------------
await day({ works: 'baru' });
const nb = await h.ev(() => { const W = window.__cat.works; return { stage: W.stage, patch: W.newPatch.visible, exc: W.exc.root.visible, prints: W.prints.count, lane: window.__cat.traffic.works }; });
check('new road day: smooth patch, machines gone, lane open', nb.stage === 'baru' && nb.patch && !nb.exc && !nb.lane, JSON.stringify(nb));
check('paw prints stay in the new road', nb.prints >= 5);

// ---------------- schedule: projects come and go ----------------
const sched = await h.ev(() => {
  const C = window.__cat, W = C.works, s = C.save;
  const keep = JSON.stringify(s.works);
  C.forceWorks = undefined;
  s.works = { start: 0, rolled: 0, prints: [] };
  const seq = [];
  for (let n = 1; n <= 60; n++) seq.push(W.stageFor(n) || '-');
  s.works = JSON.parse(keep);
  return seq.join(' ');
});
console.log('schedule', sched);
const days = sched.split(' ');
check('no road works in the first days', days.slice(0, 2).every((d) => d === '-'));
check('projects happen and finish (gali > aspal > baru > baru)', /gali aspal baru baru/.test(sched) && days.filter((d) => d === '-').length > 15, sched);

// ---------------- night & rain ----------------
await day({ w: 'malam' });
await h.ev(() => { const T = window.__cat.traffic; for (const v of T.vehicles) v.dispose(); T.vehicles = []; window.__cat.traffic.testCar({ type: 'angkot' }, 30); window.__cat.traffic.testCar({ type: 'bebek' }, 6); });
await h.tp(4, 0.15, 4.4, -Math.PI / 2 - 0.4, 100);
await gw(3);
const nt = await h.ev(() => window.__cat.traffic.vehicles.map((v) => v.pool.visible));
await view('traffic-night', [6, 3, 7], [-6, 0.5, 0]);
await view('traffic-gate', [56, 4, 6], [74, 1, -1]);
await view('traffic-west', [-78, 4.5, 7], [-98, 1, -2]);
check('headlights shine at night', nt.length >= 1 && nt.every(Boolean), JSON.stringify(nt));
await day({ w: 'hujan' });
await h.ev(() => { const T = window.__cat.traffic; for (const v of T.vehicles) v.dispose(); T.vehicles = []; T.testCar({ type: 'matic' }, 10); });
const rn = await h.ev(() => window.__cat.traffic.vehicles.map((v) => v.model.poncho?.visible));
check('motorbike riders wear a rain poncho', rn[0] === true, JSON.stringify(rn));

// ---------------- album, quests ----------------
const alb = await h.ev(() => {
  const C = window.__cat, ids = ['numpang', 'ekskavator', 'cap_kaki'];
  const m = ids.map((id) => C.save.mischief[id] || 0);
  const gen = [];
  for (let i = 0; i < 200; i++) { const q = C.progressApi.genQuest([], i % 20); if (q.set) gen.push(...q.set); }
  return { m, askRare: gen.filter((x) => x === 'ekskavator' || x === 'cap_kaki').length };
});
check('new mischief counted in the album/save', alb.m.every((x) => x > 0), JSON.stringify(alb));
check('quests never ask for road-works-only mischief', alb.askRare === 0);

const calls = await h.ev(() => window.__cat.renderer.info.render.calls);
check('draw calls reasonable', calls < 600, String(calls));
await h.close();
