// Re-creates the approved mockup scene (scratch lowpoly/houses/main.ts: street, both rows, tiang listrik, trees)
// with the GAME's house code, same seed, same cameras, so test/houses-mockup.mjs can compare it side by side
// with the approved images. People and cars of the mockup are not part of the game's house code (left out).
import * as THREE from 'three';
import { B, seedRng, rnd, rr, shade, tree, bush, MAT, SIGN_MAT } from './builder';
import { tipe36, tipe45, minimalis, ruko, rumahLama, terbengkalai, mewah, musholla, posRonda, lahanKosong } from './houses';
import { ensureSigns, poles } from './index';

type Lot = { name: string; w: number; fn: (b: B) => void; side: 1 | -1 };

let state: { renderer: THREE.WebGLRenderer; scene: THREE.Scene; camera: THREE.PerspectiveCamera; CENTERS: Record<string, THREE.Vector3>; ROWG: { n: THREE.Group; s: THREE.Group }; POLES: THREE.Group; X0: number; xEndN: number; tris: number } | null = null;

function setup() {
  ensureSigns();
  seedRng(7); // the mockup's seed
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1.5);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xbfe3f2);
  scene.fog = new THREE.Fog(0xcde8f0, 60, 160);
  const camera = new THREE.PerspectiveCamera(40, 2, 0.1, 400);
  scene.add(new THREE.HemisphereLight(0xeef8ff, 0x7a9a60, 1.3));
  const sun = new THREE.DirectionalLight(0xfff1d6, 1.9);
  sun.position.set(14, 30, 26); sun.castShadow = true; sun.shadow.mapSize.set(4096, 4096); sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;
  Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 40, bottom: -40, far: 140 });
  scene.add(sun, sun.target);
  // ground
  const gg = new THREE.PlaneGeometry(220, 160, 80, 60); gg.rotateX(-Math.PI / 2);
  { const p = gg.getAttribute('position'); for (let i = 0; i < p.count; i++) { const z = p.getZ(i), x = p.getX(i); const far = Math.max(0, -z - 40) * 0.25 + Math.max(0, z - 40) * 0.2; p.setXYZ(i, x + (rnd() - 0.5) * 0.8, -0.02 + rnd() * 0.05 + far * rnd(), z + (rnd() - 0.5) * 0.8); } }
  const ground = new THREE.Mesh(gg.toNonIndexed(), new THREE.MeshLambertMaterial({ color: 0x8cc45a, flatShading: true }));
  ground.geometry.computeVertexNormals(); ground.receiveShadow = true; scene.add(ground);
  // street
  const street = new B();
  const RZ0 = 1.0, RZ1 = 6.5, X0 = -34, X1 = 40;
  street.span(X0 - 30, X1 + 30, 0, 0.06, RZ0, RZ1, 0x5d6670, { wob: 0.02 });
  for (let x = X0 - 28; x < X1 + 28; x += 4) street.span(x, x + 1.8, 0.06, 0.075, 3.68, 3.82, 0xf4f1e6, { wob: 0 });
  for (let i = 0; i < 9; i++) { const x = rr(X0, X1), z = rr(RZ0 + 0.5, RZ1 - 0.5); street.span(x, x + rr(0.6, 1.6), 0.06, 0.07, z, z + rr(0.4, 0.9), 0x535b63, { wob: 0 }); }
  for (const [z0, z1] of [[0, RZ0], [RZ1, RZ1 + 1.0]]) {
    street.span(X0 - 30, X1 + 30, 0, 0.12, z0, z0 + 0.15, 0xcfc8b8); street.span(X0 - 30, X1 + 30, 0, 0.12, z1 - 0.15, z1, 0xcfc8b8);
    street.span(X0 - 30, X1 + 30, -0.1, 0.02, z0 + 0.15, z1 - 0.15, 0x3e4a44);
    for (let x = X0 - 29; x < X1 + 29; x += 1.2) street.span(x, x + 1.12, 0.1, 0.16, z0 + 0.12, z1 - 0.12, shade(0xc7c0b0, rr(0.92, 1.05)), { wob: 0.03 });
  }
  const sh = (g: THREE.Group) => { g.traverse((m: any) => { if (m.isMesh) { m.castShadow = m.receiveShadow = true; } }); return g; };
  scene.add(sh(street.build(MAT, SIGN_MAT)));
  // rows
  const NORTH: Lot[] = [
    { name: 'tipe36', w: 8, fn: (b) => tipe36(b), side: 1 },
    { name: 'tipe45', w: 9, fn: (b) => tipe45(b), side: 1 },
    { name: 'minimalis', w: 8, fn: (b) => minimalis(b), side: 1 },
    { name: 'lama', w: 9, fn: (b) => rumahLama(b), side: 1 },
    { name: 'terbengkalai', w: 8, fn: (b) => terbengkalai(b), side: 1 },
    { name: 'mewah', w: 14, fn: (b) => mewah(b), side: 1 },
    { name: 'ruko', w: 9, fn: (b) => ruko(b), side: 1 },
  ];
  const SOUTH: Lot[] = [
    { name: 'tipe36b', w: 8, fn: (b) => tipe36(b, { wall: 0xf4b6c2, roof: 0xa84a32, no: 'no7', roofType: 'pelana', fenceC: 0x7a1f3d, tank: 0x2f7fc4 }), side: -1 },
    { name: 'musholla', w: 10, fn: (b) => musholla(b), side: -1 },
    { name: 'tipe45b', w: 9, fn: (b) => tipe45(b, { wall: 0xbfe0f0, roof: 0xb5452e, no: 'no8', fenceC: 0x2b2b2b, tank: 0xf08a24 }), side: -1 },
    { name: 'kosong', w: 9, fn: (b) => lahanKosong(b), side: -1 },
    { name: 'minimalis2', w: 8, fn: (b) => minimalis(b, { wall: 0xd7e8d0, no: 'no9', tank: 0x2f7fc4 }), side: -1 },
    { name: 'lama2', w: 9, fn: (b) => rumahLama(b, { wall: 0xf7e7a8, trim: 0x2e6aa8, roof: 0xa85538, no: 'no10' }), side: -1 },
    { name: 'tipe36c', w: 8, fn: (b) => tipe36(b, { wall: 0xf6e0b5, roof: 0x8f4a30, no: 'no5', fenceC: 0x1f4e79 }), side: -1 },
  ];
  const CENTERS: Record<string, THREE.Vector3> = {};
  let tris = 0;
  const ROWG = { n: new THREE.Group(), s: new THREE.Group() }; scene.add(ROWG.n, ROWG.s);
  const placeRow = (row: Lot[], z: number, x0: number) => {
    let x = x0;
    for (const L of row) {
      const b = new B(); L.fn(b); const g = sh(b.build(MAT, SIGN_MAT));
      tris += g.userData.tris;
      const cx = x + L.w / 2;
      g.position.set(cx, 0, z); if (L.side < 0) g.rotation.y = Math.PI; (L.side > 0 ? ROWG.n : ROWG.s).add(g);
      CENTERS[L.name] = new THREE.Vector3(cx, 0, z);
      x += L.w;
    }
    return x;
  };
  const xEndN = placeRow(NORTH, 0, X0);
  placeRow(SOUTH, RZ1 + 1.0, X0 + 3);
  // tiang listrik + kabel (same order of random calls as the mockup)
  const furn = new B();
  const P: [number, number][] = [];
  for (let x = X0 + 1; x < X1 + 4; x += 13) P.push([x, 0.55]);
  poles(furn, P, ['tipe36', 'tipe45', 'lama', 'ruko', 'minimalis'].map((nm) => [CENTERS[nm].x + 1.5, 3.4, -4.3] as [number, number, number]));
  furn.cols = [];
  { const g = new B(); posRonda(g); const m = sh(g.build(MAT, SIGN_MAT)); m.position.set(X0 + 1.2, 0, RZ1 + 1.0); m.rotation.y = Math.PI; ROWG.s.add(m); }
  const POLES = sh(furn.build(MAT, SIGN_MAT)); scene.add(POLES); furn.parts = []; furn.signs = [];
  for (let i = 0; i < 22; i++) tree(furn, rr(X0 - 10, X1 + 10), rr(-15, -22), rr(0.9, 1.4));
  const farT = new B(); for (let i = 0; i < 22; i++) tree(farT, rr(X0 - 10, X1 + 10), rr(22, 30), rr(0.9, 1.4)); ROWG.s.add(sh(farT.build(MAT, SIGN_MAT)));
  for (let i = 0; i < 6; i++) bush(furn, rr(X0 - 20, X0 - 4), 0, rr(-1, -10), rr(0.8, 1.3));
  for (let i = 0; i < 5; i++) tree(furn, X0 - 4 - i * 4, rr(-3, -10), rr(0.9, 1.2));
  scene.add(sh(furn.build(MAT, SIGN_MAT)));
  state = { renderer, scene, camera, CENTERS, ROWG, POLES, X0, xEndN, tris };
  return state;
}

const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
/** render one of the mockup's views (cap.mjs names: street, over, game, jalan, c:<lot>:<l|c|r>) and return a PNG data URL */
export function mockShot(view: string, W = 1280, H = 600) {
  const S = state || setup();
  const { renderer, scene, camera, CENTERS, ROWG, POLES, X0, xEndN } = S;
  renderer.setSize(W, H, false);
  camera.aspect = W / H;
  let pos: THREE.Vector3, look: THREE.Vector3, fov = 40;
  const mid = (X0 + xEndN) / 2;
  ROWG.n.visible = ROWG.s.visible = true; POLES.visible = !view.startsWith('c:');
  switch (view) {
    case 'street': fov = 31; ROWG.s.visible = false; pos = v(mid + 0.5, 6.0, 37); look = v(mid + 0.5, 3.4, -5); break;
    case 'jalan': fov = 55; pos = v(X0 + 2, 2.2, 4.6); look = v(X0 + 30, 1.6, -1.5); break;
    case 'game': fov = 50; ROWG.s.visible = false; POLES.visible = true; pos = v(X0 + 13, 4.5, 14); look = v(X0 + 21, 1, -4); break;
    case 'over': fov = 38; pos = v(mid + 26, 32, 44); look = v(mid - 1, 0, 0); break;
    default: {
      const [, n, dir] = view.split(':'); const c = CENTERS[n]; const s = n === 'mewah' ? 1.35 : 1;
      const side = c.z > 1 ? -1 : 1; if (side > 0) ROWG.s.visible = false; else ROWG.n.visible = false;
      const ang = dir === 'l' ? -0.55 : dir === 'r' ? 0.55 : 0.3;
      const R = 13.5 * s;
      pos = v(c.x + side * Math.sin(ang) * R, 6.8 * s, c.z - side * 5 + side * Math.cos(ang) * R); look = v(c.x, 2.4 * s, c.z - side * 6); fov = 44;
    }
  }
  camera.fov = fov; camera.position.copy(pos); camera.lookAt(look); camera.updateProjectionMatrix();
  renderer.render(scene, camera);
  return { url: renderer.domElement.toDataURL('image/png'), tris: S.tris, calls: renderer.info.render.calls };
}
