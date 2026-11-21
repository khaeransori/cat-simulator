// Vehicles restyle: every vehicle type + excavator + roller next to a standing Blocky adult.
// Measures real-world sizes (Box3), checks riders sit inside (heads under the roof, seated),
// a cat can stand on a car roof, ponchos toggle, and takes side + 3/4 screenshots.
import { start, check } from './lib.mjs';

const h = await start({ viewport: { width: 1100, height: 520 } });
await h.play();
const gw = async (sec) => {
  const t0 = await h.ev(() => window.__cat.time);
  for (let i = 0; i < 600; i++) {
    await h.wait(120);
    if ((await h.ev(() => window.__cat.time)) - t0 >= sec) return;
  }
};
// quiet street: no traffic, no works, cat out of the way
await h.ev(() => {
  const C = window.__cat, T = C.traffic;
  for (const v of T.vehicles) v.dispose();
  T.vehicles = []; T.spawnT = 1e9;
  const b = C.cat.body; b.x = 0; b.z = -8; b.y = 0;
});

// real-world table: [lebar, tinggi, panjang] in metres (1 unit ~ 1 m), with tolerance
const REAL = { sedan: [1.78, 1.48, 4.6], taksi: [1.75, 1.5, 4.45], angkot: [1.66, 1.95, 4.1], mpv: [1.78, 1.75, 4.5], pickup: [1.7, 1.85, 4.3], citycar: [1.62, 1.52, 3.65] };

const res = await h.ev((REAL) => {
  const C = window.__cat;
  const A = C.traffic.api, scene = C.scene;
  const V3 = C.camera.position.constructor;
  const g = new (Object.getPrototypeOf(C.traffic.barrier.root).constructor)(); // a THREE.Group
  C.__ponchos = [];
  g.name = 'vehLineup';
  scene.add(g);
  const box = (o, noPeople = false) => {
    o.updateMatrixWorld(true);
    const mn = new V3(1e9, 1e9, 1e9), mx = new V3(-1e9, -1e9, -1e9), v = new V3();
    let topK = '', xK = '', xK2 = '';
    o.traverse((m) => {
      if (!m.isMesh || !m.visible || m.name === 'shadow' || (noPeople && m.material.map)) return;
      const p = m.geometry.attributes.position;
      for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).applyMatrix4(m.matrixWorld); if (v.x < mn.x) xK = (m.material.map ? 'skin' : 'body') + '@' + (v.x - o.position.x).toFixed(2) + ',' + v.y.toFixed(2) + ',' + (v.z - o.position.z).toFixed(2); if (v.x > mx.x) xK2 = (m.material.map ? 'skin' : 'body') + '@' + (v.x - o.position.x).toFixed(2) + ',' + v.y.toFixed(2); mn.min(v); if (v.y > mx.y) topK = (m.material.map ? 'skin' : m.material.transparent ? 'glass' : 'body') + '@' + (v.x - o.position.x).toFixed(2) + ',' + (v.z - o.position.z).toFixed(2); mx.max(v); }
    });
    return { mn, mx, topK, xK, xK2, size: [mx.x - mn.x, mx.y - mn.y, mx.z - mn.z] };
  };
  const ref = () => {
    const o = { skin: 0xc68e5f, top: 'kaos', topC: 0x1565c0, long: true, bottom: 'celana', botC: 0x3e2723, head: 'pendek', hair: 0x1b1410, shoes: 0x222222 };
    const n = A.buildBlocky(o);
    n.root.scale.setScalar(A.ADULT);
    return n.root;
  };
  const out = { cars: {}, motors: {}, people: {}, machines: {} };
  // reference height
  { const r = ref(); g.add(r); out.personH = +box(r).size[1].toFixed(2); g.remove(r); }
  const person = (o) => ({ shirt: 0x1976d2, helmet: 0xe53935, skin: 0xc68e5f, look: 0, ...o });
  // cars in the westbound lane (z = +1.7), facing +x, a standing adult on the kerb next to each
  const cars = ['sedan', 'taksi', 'citycar', 'mpv', 'pickup', 'angkot'];
  cars.forEach((type, i) => {
    const spec = { type, kind: 'car', color: [0xe53935, 0x3f8fd6, 0xfdd835, 0x90a4ae, 0xf5f5f5, 0x2e9e4f][i], engine: 'bensin', speed: 7, rider: person({ look: i % 7 }), passenger: type === 'angkot' ? person({ look: 2, skin: 0xd9a877 }) : null, cargo: 1 };
    const m = A.buildVehicle(spec);
    m.root.position.set(-42 + i * 6.4, 0, 1.7);
    g.add(m.root);
    const r = ref(); r.position.set(-42 + i * 6.4 + 3.2, 0, 1.7); g.add(r);
    const b = box(m.root);
    out.cars[type] = { size: b.size.map((x) => +x.toFixed(2)), topK: b.topK, heads: m.fit.heads.map((x) => +x.toFixed(2)), roofIn: +m.fit.roofIn.toFixed(2), tops: m.tops.length };
  });
  // motorbikes in the eastbound lane (z = -1.7)
  const motors = [
    ['bebek', person({ look: 0 }), person({ look: 2, skin: 0xd9a877, helmet: 0xf48fb1 })], // ibu bergamis menyamping
    ['matic', person({ look: 3 }), person({ look: -1, skin: 0xe0ac7e })], // anak bonceng
    ['sport', person({ look: 1 }), null],
    ['ojol', person({ look: 0 }), null],
  ];
  motors.forEach(([type, rider, passenger], i) => {
    const spec = { type, kind: 'motor', color: [0xe53935, 0xf5f5f5, 0x1e88e5, 0x2e7d32][i], engine: '4tak', speed: 7, rider, passenger, cargo: 0 };
    const m = A.buildVehicle(spec);
    m.root.position.set(-4 + i * 3.6, 0, 1.7);
    g.add(m.root);
    const r = ref(); r.position.set(-4 + i * 3.6 + 1.8, 0, 1.7); g.add(r);
    const b = box(m.root);
    // poncho toggle
    const hadPoncho = !!m.poncho;
    const bb = box(m.root, true);
    if (m.poncho) C.__ponchos.push(m.poncho);
    out.motors[type] = { size: b.size.map((x) => +x.toFixed(2)), bike: bb.size.map((x) => +x.toFixed(2)), heads: m.fit.heads.map((x) => +x.toFixed(2)), poncho: hadPoncho };
  });
  // machines further east
  const e = A.buildExcavator();
  e.root.position.set(16, 0, 1.2);
  e.cab.rotation.y = 0.0;
  // rest pose from roadworks (bucket on the road)
  e.boom.rotation.z = 1.06; e.stick.rotation.z = -1.81; e.bucket.rotation.z = 0.16;
  g.add(e.root);
  { const r = ref(); r.position.set(13.2, 0, 1.4); g.add(r); }
  const eb = box(e.root);
  const op = new V3(); e.operator.getWorldPosition(op);
  out.machines.excavator = { size: eb.size.map((x) => +x.toFixed(2)), maxY: +eb.mx.y.toFixed(2), opSeatY: +op.y.toFixed(2) };
  const ro = A.buildRoller();
  ro.root.position.set(28, 0, 1.7);
  g.add(ro.root);
  { const r = ref(); r.position.set(30.4, 0, 1.7); g.add(r); }
  const rb = box(ro.root);
  out.machines.roller = { size: rb.size.map((x) => +x.toFixed(2)), maxY: +rb.mx.y.toFixed(2) };
  // excavator bucket orientation: the teeth (mouth) must face back toward the cab in a digging pose
  e.boom.rotation.z = 0.66; e.stick.rotation.z = -1.53; e.bucket.rotation.z = 0.67; // reach
  e.root.updateMatrixWorld(true);
  const pv = new V3(), tip = new V3(), cabP = new V3();
  e.bucket.getWorldPosition(pv);
  // mouth point in bucket space (last profile point)
  tip.set(0.68, -0.52, 0); e.bucket.localToWorld(tip);
  e.cab.getWorldPosition(cabP);
  const pivotD = Math.hypot(pv.x - cabP.x, pv.z - cabP.z), mouthD = Math.hypot(tip.x - cabP.x, tip.z - cabP.z);
  out.machines.bucketMouthTowardCab = mouthD < pivotD + 0.6 && tip.y < pv.y;
  out.machines.bucketDbg = { pivot: [pv.x, pv.y].map((x) => +x.toFixed(2)), mouth: [tip.x, tip.y].map((x) => +x.toFixed(2)) };
  e.boom.rotation.z = 1.06; e.stick.rotation.z = -1.81; e.bucket.rotation.z = 0.16;
  C.__lineup = g;
  return out;
}, REAL);
console.log('person height', res.personH);
console.log('cars', JSON.stringify(res.cars));
console.log('motors', JSON.stringify(res.motors));
console.log('machines', JSON.stringify(res.machines));
check('adult Blocky is ~1.7 m', Math.abs(res.personH - 1.7) < 0.08, String(res.personH));
for (const [type, [w, hgt, l]] of Object.entries(REAL)) {
  const c = res.cars[type];
  const [sw, sh, sl] = c.size; // x = length, y = height, z = width (incl. mirrors)
  check(`${type}: length ${sl}≈${l}`, Math.abs(sw - l) < 0.3, JSON.stringify(c.size));
  check(`${type}: height ≈${hgt}`, Math.abs(sh - hgt) < 0.18, String(sh));
  check(`${type}: width ≈${w} (+mirrors)`, sl > w - 0.05 && sl < w + 0.36, String(sl));
  check(`${type}: driver head under the roof`, c.heads.every((y) => y <= c.roofIn + 0.01), JSON.stringify(c));
}
for (const [type, m] of Object.entries(res.motors)) {
  check(`${type}: motorbike ~1.9-2.0 long`, m.bike[0] > 1.8 && m.bike[0] < 2.1, JSON.stringify(m.bike));
  // Blocky people have short legs + a big head: seated on a 0.78 m seat the helmet top is ~2.0 m
  check(`${type}: rider head at seated Blocky height`, m.heads[0] > 1.7 && m.heads[0] < 2.12, JSON.stringify(m.heads));
  check(`${type}: rain poncho present`, m.poncho);
}
check('excavator about 2.5 adults tall with the arm up (> 3.2 m)', res.machines.excavator.maxY > 3.2, JSON.stringify(res.machines.excavator));
check('excavator operator seated in the cab (seat ~2 m up)', res.machines.excavator.opSeatY > 1.8 && res.machines.excavator.opSeatY < 2.3, String(res.machines.excavator.opSeatY));
check('excavator bucket mouth faces back toward the cab', res.machines.bucketMouthTowardCab, JSON.stringify(res.machines.bucketDbg));
check('roller canopy over a full-size operator (> 3 m)', res.machines.roller.maxY > 3.1, JSON.stringify(res.machines.roller));

// lane fit: a car centred in its lane must clear the centre line and the kerb (street |z| < 3.5)
const fit = await h.ev(() => {
  const A = window.__cat.traffic.api;
  const wid = Math.max(...Object.values(A.VTYPE).filter((t) => t.kind === 'car').map((t) => t.wid));
  return { wid, lane: 1.7, kerb: 3.5 };
});
check('widest car fits its lane (centre line .. kerb)', fit.lane - fit.wid / 2 > 0.05 && fit.lane + fit.wid / 2 < fit.kerb - 0.3, JSON.stringify(fit));

// views
// hide walking people/animals so they don't block the lineup shots (restored after)
await h.ev(() => {
  const C = window.__cat; C.__hidden = [];
  for (const o of C.scene.children) if (o !== C.__lineup && o.visible && o.type === 'Group' && o.children.some((c) => c.name === 'root' || c.type === 'SkinnedMesh')) { o.visible = false; C.__hidden.push(o); }
  for (const hm of [...(C.npcs || []), C.kids?.a, C.kids?.b, C.mama].filter(Boolean)) if (hm.model?.root?.visible) { hm.model.root.visible = false; C.__hidden.push(hm.model.root); }
});
const view = async (name, pos, look) => {
  await h.ev(([p, l]) => { const C = window.__cat; C.camRig.override = { pos: new C.camera.position.constructor(...p), look: new C.camera.position.constructor(...l) }; C.camRig.update(0, C.cat, true); }, [pos, look]);
  await gw(0.4);
  await h.shot(name);
};
await h.ev(() => (window.__cat.timeScale = 1));
// shoot from the far side of the street (z = -3.3), so fences/gardens don't block the view
for (let i = 0; i < 6; i += 2) await view(`veh-cars-side-${i / 2 + 1}`, [-42 + (i + 0.5) * 6.4 + 1.6, 1.2, -3.2], [-42 + (i + 0.5) * 6.4 + 1.6, 1.0, 1.7]);
await view('veh-cars-34', [-49, 2.6, -3.2], [-36, 0.9, 1.7]);
await view('veh-cars-34b', [-6, 2.6, -3.2], [-20, 0.9, 1.7]);
await view('veh-motors-side', [1.4, 1.1, -4.0], [1.4, 0.95, 1.7]);
await view('veh-motors-34', [-7.5, 1.9, -2.8], [1.0, 0.9, 1.7]);
await view('veh-motors-front', [-8, 1.5, 1.7], [0, 1.0, 1.7]);
await view('veh-machines-side', [20, 1.9, -3.1], [20, 1.7, 1.4]);
await view('veh-machines-34', [10.5, 3.2, -3.0], [17.5, 1.5, 1.2]);
await view('veh-exc-close', [14.2, 2.9, -2.4], [16.4, 2.4, 0.8]);
await view('veh-roller', [24.5, 2.2, -2.9], [28.6, 1.6, 1.7]);
// rain: ponchos on
await h.ev(() => { for (const p of window.__cat.__ponchos) p.visible = true; });
await view('veh-motors-poncho', [1.4, 1.2, -4.0], [1.4, 0.95, 1.7]);
await h.ev(() => { const C = window.__cat; for (const o of C.__hidden) o.visible = true; C.scene.remove(C.__lineup); C.camRig.override = null; C.camRig.snap(C.cat); });

// cat on a real traffic car roof (moving platform)
await h.ev(() => (window.__cat.timeScale = 3));
await h.tp(-6, 0, 1.7, -Math.PI / 2, 200);
await h.ev(() => window.__cat.traffic.testCar({ type: 'mpv', color: 0x1e88e5 }, 20));
await gw(7);
const roof = await h.ev(() => {
  const C = window.__cat, v = C.traffic.vehicles[0], b = C.cat.body;
  const t = v.tops.reduce((a, x) => (x.y > a.y ? x : a));
  const lx = (t.x0 + t.x1) / 2, c = Math.cos(v.yaw), s = Math.sin(v.yaw);
  b.x = v.x + lx * c; b.z = v.z - lx * s; b.y = t.y + 0.3; b.vy = 0; b.onGround = false;
  return { y: t.y, h: C.traffic.api.VTYPE[v.spec.type].h };
});
await gw(0.6);
const on = await h.ev(() => ({ ride: !!window.__cat.traffic.ride, y: window.__cat.cat.body.y }));
check('cat stands on the MPV roof (roof = real height)', on.ride && Math.abs(on.y - roof.y) < 0.05 && Math.abs(roof.y - roof.h) < 0.02, JSON.stringify({ on, roof }));
{ const p = await h.ev(() => [window.__cat.cat.body.x, window.__cat.cat.body.z]); await h.ev(() => (window.__cat.timeScale = 0.0001)); await view('veh-cat-roof', [p[0] - 4, 3.0, p[1] + 5], [p[0], 1.4, p[1]]); await h.ev(() => { const C = window.__cat; C.timeScale = 3; C.camRig.override = null; }); }

// busy moment: lots of traffic, count draw calls
await h.ev(() => { const C = window.__cat, T = C.traffic; for (const v of T.vehicles) v.dispose(); T.vehicles = []; C.cat.body.x = 0; C.cat.body.z = 6; T.max = 6; for (let i = 0; i < 6; i++) { const v = T.spawn(); if (v) v.place(v.path.len * (0.25 + i * 0.08)); } });
await gw(1);
const busy = await h.ev(() => ({ n: window.__cat.traffic.vehicles.length, calls: window.__cat.renderer.info.render.calls, tris: window.__cat.renderer.info.render.triangles }));
console.log('busy traffic', JSON.stringify(busy));
check('busy traffic draw calls < 600', busy.calls < 600, JSON.stringify(busy));
check('no page errors', h.errs.length === 0, h.errs.slice(0, 3).join(' | '));
await h.close();
