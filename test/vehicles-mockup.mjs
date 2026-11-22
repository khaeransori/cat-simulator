// Mockup match: the approved low-poly mockup's vehicle scene (scratch/lowpoly/chars/vehicles.ts)
// rebuilt with the GAME's own models, same positions + same cameras. Compare
// test/shots/vehmock-*.png with the mockup's veh-cars.png / veh-motor.png / veh-wide.png.
import { start, check } from './lib.mjs';

const h = await start({ viewport: { width: 900, height: 420 } });
await h.play();
const gw = async (sec) => {
  const t0 = await h.ev(() => window.__cat.time);
  for (let i = 0; i < 600; i++) {
    await h.wait(120);
    if ((await h.ev(() => window.__cat.time)) - t0 >= sec) return;
  }
};
// mockup road z 4.5..8.5 (centre 6.5) -> game street centre z = 0; base x in a quiet stretch
const X0 = -20, DZ = -6.5;
const res = await h.ev(([X0, DZ]) => {
  const C = window.__cat, T = C.traffic, A = T.api;
  for (const v of T.vehicles) v.dispose();
  T.vehicles = []; T.spawnT = 1e9;
  const b = C.cat.body; b.x = X0; b.z = -12; b.y = 0;
  // hide walking people/animals so only the lineup is in frame
  for (const hm of [...(C.npcs || []), C.kids?.a, C.kids?.b, C.mama].filter(Boolean)) if (hm.model?.root) hm.model.root.visible = false;
  const g = new (Object.getPrototypeOf(T.barrier.root).constructor)();
  C.scene.add(g);
  const P = (o) => ({ shirt: 0x1976d2, helmet: 0xe53935, skin: 0xc68e5f, look: 0, ...o });
  const put = (o, x, z, ry) => { o.position.set(X0 + x, 0, z + DZ); o.rotation.y = ry; g.add(o); };
  // mockup: put(fitCar(kenneyCar(...)), x, 5.3, -PI/2): Kenney +z turned to -x  => game (+x) turned by PI
  const cars = [['sedan', 0xc9ced6, -20], ['angkot', 0x2e9e4f, -12.5], ['taksi', 0x3f8fd6, -5.2], ['mpv', 0x37474f, 2.0], ['pickup', 0xf5f5f5, 9.2], ['boks', 0xf9a825, 17.5]];
  const sizes = {};
  for (const [type, color, x] of cars) {
    const m = A.buildVehicle({ type, kind: 'car', color, engine: 'bensin', speed: 7, rider: P({}), passenger: null, cargo: 0 });
    put(m.root, x, 5.3, Math.PI);
    m.root.updateMatrixWorld(true);
    const bx = new (C.camera.position.constructor)();
    sizes[type] = m.tops.length;
    // the mockup's reference adult next to each car
    const r = A.buildBlocky({ skin: 0xc68e5f, top: 'kaos', topC: 0x1565c0, long: true, bottom: 'celana', botC: 0x3e2723, head: 'pendek', hair: 0x1b1410, shoes: 0x222222 });
    r.root.scale.setScalar(A.ADULT); r.root.position.set(X0 + x + 1.2, 0, 3.4 + DZ); r.root.rotation.y = 0.3; g.add(r.root);
    void bx;
  }
  // mockup motors: put(mk(...), x, 7.9, +PI/2): bike +z turned to +x => game (+x) rotation 0
  const motors = [
    ['ojol', 0x2e7d32, -9, P({ look: 0 }), null],
    ['bebek', 0xe53935, -5.5, P({ look: 0, helmet: 0x1e88e5 }), P({ look: 2, skin: 0xd9a877, helmet: 0xf48fb1 })],
    ['matic', 0xf5f5f5, -2, P({ look: 2, skin: 0xd9a877, helmet: 0xd81b60 }), null],
  ];
  for (const [type, color, x, rider, passenger] of motors) {
    const m = A.buildVehicle({ type, kind: 'motor', color, engine: '4tak', speed: 7, rider, passenger, cargo: 0 });
    put(m.root, x, 7.9, 0);
  }
  C.__vm = g;
  return sizes;
}, [X0, DZ]);
console.log('tops', JSON.stringify(res));
await h.ev(() => (window.__cat.timeScale = 1));
// the mockup's cameras (fov, pos, look), shifted like the models
const V = {
  wide: [[0, 7.5, 24], [0, 0.6, 5.5], 44],
  cars: [[0, 3.0, 15], [0, 0.8, 5.3], 46],
  carsA: [[-9, 2.4, 13.5], [-9, 1.0, 5.0], 52],
  carsB: [[11, 2.6, 14], [11, 1.1, 5.0], 52],
  motor: [[-4.6, 1.4, 12.2], [-5.6, 0.8, 7.9], 44],
  side: [[-5.6, 1.1, 12.0], [-5.6, 0.85, 7.9], 30],
};
for (const [name, [p, l, fov]] of Object.entries(V)) {
  await h.ev(([p, l, fov, X0, DZ]) => {
    const C = window.__cat, V3 = C.camera.position.constructor;
    C.camera.fov = fov; C.camera.updateProjectionMatrix();
    C.camRig.override = { pos: new V3(X0 + p[0], p[1], p[2] + DZ), look: new V3(X0 + l[0], l[1], l[2] + DZ) };
    C.camRig.update(0, C.cat, true);
  }, [p, l, fov, X0, DZ]);
  await gw(0.3);
  await h.shot('vehmock-' + name);
}
check('mockup scene rebuilt from the game models', Object.keys(res).length === 6);
await h.close();
