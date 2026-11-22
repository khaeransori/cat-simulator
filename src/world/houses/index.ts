// Places the approved Indonesian house mockup (houses.ts) in the game world:
//  - the three decorative lots (D west of home, E east of Pak RT, W west of the warung) as rows of mockup lots,
//  - the backdrop row across the west cross road (musholla, pos ronda, lahan kosong, more houses),
//  - tiang listrik with sagging wires along the street,
//  - visual-only facade details on the gameplay houses A/B/C (their colliders are untouched).
// Everything is merged into a few meshes (one per area + one shared sign-atlas mesh).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { B, ATLAS_TEX, MAT, SIGN_MAT, seedRng, rnd, rr, tree, bush, fence, roster, acUnit, parabola, shade, type HCol, type HWin } from './builder';
import { makeSigns, tipe36, tipe45, minimalis, ruko, rumahLama, terbengkalai, mewah, musholla, posRonda, lahanKosong } from './houses';

export type LotFn = (b: B) => void;
export interface Lot { name: string; w: number; fn: LotFn }

/** the mockup's north row (houses mockup main.ts), used by the mockup-match test */
export const MOCK_NORTH: Lot[] = [
  { name: 'tipe36', w: 8, fn: (b) => tipe36(b) },
  { name: 'tipe45', w: 9, fn: (b) => tipe45(b) },
  { name: 'minimalis', w: 8, fn: (b) => minimalis(b) },
  { name: 'lama', w: 9, fn: (b) => rumahLama(b) },
  { name: 'terbengkalai', w: 8, fn: (b) => terbengkalai(b) },
  { name: 'mewah', w: 14, fn: (b) => mewah(b) },
  { name: 'ruko', w: 9, fn: (b) => ruko(b) },
];

let signsMade = false;
export function ensureSigns() {
  if (signsMade) return;
  signsMade = true;
  makeSigns();
  ATLAS_TEX.needsUpdate = true;
}

/** Place one mockup lot: local (x, z) -> world. ry = 0 faces +z; Math.PI faces -z; Math.PI/2 faces +x. */
export function placeLot(b: B, fn: LotFn, x: number, z: number, ry = 0) {
  b.push(x, 0, z, ry);
  fn(b);
  b.pop();
}

/** tiang listrik + wires (mockup main.ts street furniture), poles given in world coords; arm along `armAlongX` */
export function poles(b: B, P: [number, number][], drops: [number, number, number][] = []) {
  for (const [x, z] of P) {
    b.cyl(0.11, 0.14, 8.0, x, 0, z, 0x9a9a94, 7);
    b.col(x - 0.14, x + 0.14, 0, 8.0, z - 0.14, z + 0.14, false);
    b.bx(1.6, 0.12, 0.12, x, 7.4, z, 0x7a7a74, { wob: 0 });
    for (const dx of [-0.65, 0, 0.65]) b.cyl(0.05, 0.06, 0.14, x + dx, 7.52, z, 0xe8e8e0, 6);
    if (Math.round(x) % 2 === 0) b.cyl(0.32, 0.32, 0.75, x, 5.9, z - 0.32, 0x6f7a80, 8); // trafo can
    b.bx(0.3, 0.12, 0.9, x, 6.6, z + 0.45, 0x7a7a74, { wob: 0 }); b.bx(0.36, 0.14, 0.24, x, 6.52, z + 0.95, 0xf0f0e0, { wob: 0 }); // PJU lamp arm
  }
  for (let i = 0; i < P.length - 1; i++) {
    const [a, za] = P[i], [c, zc] = P[i + 1];
    for (const dx of [-0.65, 0, 0.65]) b.wire([a + dx, 7.58, za], [c + dx, 7.58, zc], 0.55 + rnd() * 0.2);
    b.wire([a, 6.6, za + 0.1], [c, 6.6, zc + 0.1], 0.8, 0x1d1d1d, 8, 0.05);
  }
  // service drops to houses (kabel ke rumah)
  for (const [hx, hy, hz] of drops) {
    const p = P.reduce((m, q) => (Math.abs(q[0] - hx) < Math.abs(m[0] - hx) ? q : m));
    b.wire([p[0], 6.6, p[1]], [hx, hy, hz], 0.35, 0x1d1d1d, 6, 0.03);
  }
}

export interface HousesOut {
  group: THREE.Group;
  cols: HCol[];
  wins: HWin[];
  tris: number;
}

// ---- game layout ----
/** world z of the mockup's local z = 0 (front fence line z = -0.12 lands on the game's fence line -5.25) */
const ZN = -5.13;
/** decorative areas whose colliders may change (also used by test/world-colliders.mjs) */
export const DECOR_RECTS = {
  D: { x0: -46, z0: -31, x1: -24.2, z1: -5.0 },
  E: { x0: 40.1, z0: -31, x1: 66, z1: -5.0 },
  W: { x0: -88, z0: -20, x1: -64, z1: -5.0 },
  backdrop: { x0: -120, z0: -90, x1: -102, z1: 90 },
};

/** backdrop chunks further than this from the camera are not drawn (the fog is ~80% there) */
const FAR_DIST = 80;
const MAIN_POLES: [number, number][] = [-86, -78, -69.5, -59, -48.8, -43, -31, -19, -7, 5, 18, 31.5, 46.5, 58].map((x) => [x, -4.9]);

/** visual-only facade details on the gameplay houses (no colliders, no glow windows) */
function facadeABC(b: B) {
  const KER = 0xd9cfc0, TR = 0xf4efe4;
  // teralis (window bars) in front of a glass pane whose outer face is at zf (wall facing +z)
  const teralis = (x0: number, x1: number, y0: number, y1: number, zf: number, c = 0x2b2b2b) => {
    const w = x1 - x0, x = (x0 + x1) / 2, n = Math.max(3, Math.round(w / 0.16)), h = y1 - y0;
    for (let i = 1; i < n; i++) b.bx(0.03, h - 0.1, 0.03, x0 + (i * w) / n, y0 + 0.05, zf + 0.13, c, { wob: 0 });
    for (const yy of [0.25, h * 0.55, h - 0.25]) b.bx(w - 0.06, 0.035, 0.03, x, y0 + yy, zf + 0.13, c, { wob: 0 });
    for (const xx of [x0 - 0.02, x1 + 0.02]) b.bx(0.05, h - 0.06, 0.12, xx, y0 + 0.03, zf + 0.08, c, { wob: 0 }); // side brackets to the wall
  };
  const doorFrame = (x0: number, x1: number, h: number, y0: number, zf: number, c: number) => {
    b.bx(x1 - x0 + 0.28, 0.12, 0.12, (x0 + x1) / 2, y0 + h, zf + 0.06, c);
    for (const x of [x0 - 0.07, x1 + 0.07]) b.bx(0.12, h, 0.12, x, y0, zf + 0.06, c);
  };
  const plinthBand = (x0: number, x1: number, zf: number, h = 0.45) => b.span(x0, x1, h, h + 0.06, zf, zf + 0.07, shade(KER, 0.9), { wob: 0.02 }); // keramik cap on the base strip
  // ---- House A (home): front face z = -12.99 (glass), wall outer face -13.0 ----
  {
    const zf = -13.0;
    plinthBand(-22.04, -15, zf + 0.04); plinthBand(-13.4, -5.96, zf + 0.04);
    roster(b, -14.2, 2.72, 1.5, zf, TR);
    roster(b, -19.75, 2.45, 2.5, zf, TR); roster(b, -9.5, 2.45, 3.0, zf, TR);
    teralis(-21, -18.5, 1.0, 2.3, zf); teralis(-11, -8, 1.0, 2.3, zf);
    b.sign('noA', 0.5, 0.25, -15.55, 2.05, zf + 0.04);
    // AC outdoor unit on the east wall (outer face x = -6.0), facing +x
    b.push(-6.0, 0, -22.5, Math.PI / 2); acUnit(b, 0, 2.0, 0); b.pop();
  }
  // ---- House B (Bu Siti): front face z = -14 ----
  {
    const zf = -14.0;
    plinthBand(-0.54, 15.04, zf);
    doorFrame(6.8, 8.2, 2.5, 0.2, zf, TR);
    roster(b, 7.5, 2.75, 1.4, zf, TR);
    roster(b, 3.0, 2.45, 3.0, zf, TR); roster(b, 11.5, 2.45, 3.0, zf, TR);
    teralis(1.5, 4.5, 1.0, 2.3, zf + 0.01, 0x1f5e48); teralis(10, 13, 1.0, 2.3, zf + 0.01, 0x1f5e48);
    b.sign('noB', 0.5, 0.25, 8.75, 2.05, zf + 0.03);
    b.push(0, 0, zf); acUnit(b, 14.25, 2.0, 0); b.pop();
    // wall-mounted parabola on the east wall (outer face x = 15)
    b.push(15.0, 0, -18.5, Math.PI / 2); b.bx(0.5, 0.08, 0.3, 0, 2.12, 0.15, 0x8a8a8a, { wob: 0 }); parabola(b, 0, 2.2, 0.3, 0, 0.3); b.pop();
    // side plinth bands
    b.span(14.99, 15.05, 0, 0.45, -27, -14, 0x9fc9aa, { wob: 0.02 });
  }
  // ---- House C (Pak RT): front face z = -15 ----
  {
    const zf = -15.0;
    plinthBand(22.96, 38.04, zf);
    doorFrame(29.8, 31.2, 2.5, 0, zf, TR);
    roster(b, 30.5, 2.75, 1.4, zf, TR);
    roster(b, 26.0, 2.45, 3.0, zf, TR); roster(b, 35.0, 2.45, 3.0, zf, TR);
    teralis(24.5, 27.5, 1.0, 2.3, zf + 0.01); teralis(33.5, 36.5, 1.0, 2.3, zf + 0.01);
    b.sign('noC', 0.5, 0.25, 31.75, 2.05, zf + 0.03);
    b.push(0, 0, zf); acUnit(b, 37.35, 2.0, 0); b.pop();
    b.push(38.0, 0, -21.5, Math.PI / 2); b.bx(0.5, 0.08, 0.3, 0, 2.12, 0.15, 0x8a8a8a, { wob: 0 }); parabola(b, 0, 2.2, 0.3, 0, 0.3); b.pop();
    b.span(37.99, 38.05, 0, 0.45, -27, -15, 0x9db7d6, { wob: 0.02 });
  }
}

/** build everything for the game; returns one group (few meshes), colliders and glow windows */
export function buildHouses(): HousesOut {
  ensureSigns();
  seedRng(20240607);
  const chunks: B[] = [];
  const farChunks = new Set<B>(); // far-away backdrop chunks: drawn only when the camera is near (fog hides them anyway)
  const signs: THREE.BufferGeometry[] = [];
  const cols: HCol[] = [];
  const wins: HWin[] = [];
  const chunk = (fill: (b: B) => void, far = false) => { const b = new B(); fill(b); chunks.push(b); if (far) farChunks.add(b); return b; };
  const lotRow = (b: B, x0: number, z: number, row: Lot[]) => { let x = x0; for (const L of row) { placeLot(b, L.fn, x + L.w / 2, z); x += L.w; } return x; };
  const back = (b: B, x0: number, x1: number, z0: number, z1: number, n: number) => { for (let i = 0; i < n; i++) tree(b, rr(x0, x1), rr(z0, z1), rr(0.9, 1.35)); };

  // ---- Lot D (x -46 .. -24.2): rumah lama + tipe 45, side garden ----
  chunk((b) => {
    const xe = lotRow(b, -46, ZN, [
      { name: 'lama', w: 9, fn: (q) => rumahLama(q, { no: 'no11' }) },
      { name: 'tipe45', w: 9, fn: (q) => tipe45(q, { no: 'no12' }) },
    ]);
    // side garden up to house A's lot wall (fence continues the tipe 45 one)
    b.span(xe, -24.25, 0, 0.11, ZN - 0.2, ZN - 12, 0x7cbf4f, { wob: 0.06, col: true });
    fence(b, xe + 0.16, -24.4, ZN - 0.12, { style: 'besi', barC: 0x1f5e48, pillarC: 0xf2ead8 });
    tree(b, -26, ZN - 2.9, 0.8); bush(b, -27.3, 0, ZN - 1.0, 0.7); bush(b, -25, 0, ZN - 6.5, 0.8, 0x6dbb52);
    back(b, -45, -25.5, -19.5, -29.5, 7);
  });
  // ---- Lot E (x 40.1 .. 66): rumah orang kaya + ruko (Warung Bu Inah | fotokopi), side garden ----
  chunk((b) => {
    const xe = lotRow(b, 40.3, ZN, [
      { name: 'mewah', w: 14, fn: (q) => mewah(q) },
      { name: 'ruko', w: 9, fn: (q) => ruko(q, { sign: 'warungInah' }) },
    ]);
    b.span(xe, 65.95, 0, 0.11, ZN - 0.2, ZN - 12, 0x7cbf4f, { wob: 0.06, col: true });
    fence(b, xe + 0.16, 65.8, ZN - 0.12, { style: 'besi', barC: 0x2b2b2b });
    tree(b, 64.6, ZN - 3.5, 0.75); bush(b, 64.3, 0, ZN - 1.2, 0.7);
    back(b, 41, 65, -19.5, -29.5, 7);
  });
  // ---- Lot W (x -88 .. -64, west of the warung): terbengkalai + tipe 36 + minimalis ----
  chunk((b) => {
    lotRow(b, -88, ZN, [
      { name: 'terbengkalai', w: 8, fn: (q) => terbengkalai(q) },
      { name: 'tipe36', w: 8, fn: (q) => tipe36(q, { no: 'no13' }) },
      { name: 'minimalis', w: 8, fn: (q) => minimalis(q, { no: 'no14' }) },
    ]);
  });
  // ---- backdrop row across the west cross road: facades face +x (towards the road) ----
  const BX = -103.5 - 0.05; // fence line just behind the sidewalk (-103.4)
  const backRow: Lot[] = [
    { name: 'tipe36b', w: 8, fn: (b) => tipe36(b, { wall: 0xf4b6c2, roof: 0xa84a32, no: 'no7', roofType: 'pelana', fenceC: 0x7a1f3d, tank: 0x2f7fc4 }) },
    { name: 'musholla', w: 10, fn: (b) => musholla(b) },
    { name: 'tipe45b', w: 9, fn: (b) => tipe45(b, { wall: 0xbfe0f0, roof: 0xb5452e, no: 'no8', fenceC: 0x2b2b2b, tank: 0xf08a24 }) },
    { name: 'kosong', w: 9, fn: (b) => lahanKosong(b) },
    { name: 'minimalis2', w: 8, fn: (b) => minimalis(b, { wall: 0xd7e8d0, no: 'no9', tank: 0x2f7fc4 }) },
    { name: 'lama2', w: 9, fn: (b) => rumahLama(b, { wall: 0xf7e7a8, trim: 0x2e6aa8, roof: 0xa85538, no: 'no10' }) },
    { name: 'tipe36c', w: 8, fn: (b) => tipe36(b, { wall: 0xf6e0b5, roof: 0x8f4a30, no: 'no5', fenceC: 0x1f4e79 }) },
  ];
  const backRow2: Lot[] = [
    { name: 'tipe45c', w: 9, fn: (b) => tipe45(b, { wall: 0xf3d9b1, roof: 0x8f4a30, no: 'no15', fenceC: 0x5d4037, tank: 0x2f7fc4 }) },
    { name: 'terbengkalai2', w: 8, fn: (b) => terbengkalai(b) },
    { name: 'tipe36d', w: 8, fn: (b) => tipe36(b, { wall: 0xd8d8ee, roof: 0xb24a3a, no: 'no16', fenceC: 0x2b2b2b }) },
    { name: 'kosong2', w: 9, fn: (b) => lahanKosong(b) },
    { name: 'lama3', w: 9, fn: (b) => rumahLama(b, { wall: 0xe8f0e0, trim: 0x8a3a2a, roof: 0x9c5a3c, no: 'no6' }) },
    { name: 'minimalis3', w: 8, fn: (b) => minimalis(b, { wall: 0xf3e0c0, no: 'no3', tank: 0xece6d6 }) },
    { name: 'tipe36e', w: 8, fn: (b) => tipe36(b, { wall: 0xcde8d2, roof: 0x5d7f99, no: 'no2', fenceC: 0x1f5e48 }) },
  ];
  // local x runs towards world -z when ry = +PI/2, so start each row at its north end
  const rowZ = (b: B, z0: number, row: Lot[]) => { let z = z0; for (const L of row) { placeLot(b, L.fn, BX, z - L.w / 2, Math.PI / 2); z -= L.w; } return z; };
  // four chunks (so the far ones can be culled): z 69 .. 34, 34 .. 8 (+ pos ronda at the T-junction), -7.5 .. -41.5, -41.5 .. -66.5
  chunk((b) => { rowZ(b, 69, backRow.slice(0, 4)); for (let i = 0; i < 5; i++) tree(b, rr(-117, -105), rr(70, 80), rr(0.9, 1.3)); for (let i = 0; i < 3; i++) bush(b, rr(-110, -104.5), 0, rr(70, 80), rr(0.8, 1.2)); }, true);
  chunk((b) => { rowZ(b, 33, backRow.slice(4)); placeLot(b, posRonda, BX - 0.2, 4.6, Math.PI / 2); }, true);
  chunk((b) => {
    rowZ(b, -7.5, backRow2.slice(0, 4));
    // tiang listrik along the cross road (west sidewalk), wires along z
    b.push(-102.5, 0, 0, Math.PI / 2);
    const n0 = b.cols.length;
    const P: [number, number][] = [];
    for (let z = 76; z >= -77; z -= 13) P.push([-z, 0]);
    poles(b, P);
    for (let i = n0; i < b.cols.length; i++) b.cols[i].tag = 'tiang';
    b.pop();
  }, true);
  chunk((b) => { rowZ(b, -41.5, backRow2.slice(4)); for (let i = 0; i < 5; i++) tree(b, rr(-117, -105), rr(-80, -67.5), rr(0.9, 1.3)); for (let i = 0; i < 3; i++) bush(b, rr(-110, -104.5), 0, rr(-80, -67.5), rr(0.8, 1.2)); }, true);
  // ---- tiang listrik along the street (north sidewalk) + service drops ----
  chunk((b) => {
    const n0 = b.cols.length;
    poles(b, MAIN_POLES, [
      [-41.5 + 1.5, 3.4, ZN - 4.3], [-32.5 + 1.5, 3.4, ZN - 4.3], [-76 + 1.5, 3.4, ZN - 4.3], [-68 + 1.5, 3.4, ZN - 4.3], [58.8 + 1.5, 3.4, ZN - 2.3],
      [-14.2, 3.0, -13.0], [7.5, 3.0, -14.0], [30.5, 3.0, -15.0],
    ]);
    for (let i = n0; i < b.cols.length; i++) b.cols[i].tag = 'tiang'; // street poles (on the sidewalk, outside the lots)
    facadeABC(b);
  });

  const group = new THREE.Group();
  group.name = 'houses';
  let tris = 0;
  const far: { m: THREE.Object3D; box: THREE.Box3 }[] = [];
  chunks.forEach((b, i) => {
    for (const c of b.cols) cols.push(c);
    for (const w of b.wins) wins.push(w);
    signs.push(...b.signs);
    b.signs = [];
    const g = b.build(MAT, SIGN_MAT);
    tris += g.userData.tris;
    for (const m of [...g.children]) {
      const mesh = m as THREE.Mesh;
      mesh.matrixAutoUpdate = false; m.castShadow = m.receiveShadow = false; m.name = 'houses' + i;
      mesh.geometry.computeBoundingBox();
      if (farChunks.has(b)) far.push({ m, box: mesh.geometry.boundingBox!.clone() });
      group.add(m);
    }
  });
  if (signs.length) {
    const s = new THREE.Mesh(mergeGeometries(signs), SIGN_MAT);
    s.matrixAutoUpdate = false;
    s.name = 'houseSigns';
    // always drawn (tiny), and it switches the far backdrop chunks on/off by camera distance (applies from the next frame)
    s.frustumCulled = false;
    s.onBeforeRender = (_r, _s, cam) => { for (const f of far) f.m.visible = f.box.distanceToPoint(cam.position) < FAR_DIST; };
    group.add(s);
    tris += s.geometry.getAttribute('position').count / 3;
  }
  return { group, cols, wins, tris };
}
