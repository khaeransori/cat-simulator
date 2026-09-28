import * as THREE from 'three';
import { StaticBuilder, mbox, lam, boxGeo, type AABB } from './builder';
import { Physics } from './physics';

export interface Zone {
  id: string;
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  ymin?: number;
}

export interface MapRect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
  c: string;
}

export interface PropInfo {
  obj: THREE.Object3D;
  home: THREE.Vector3;
  homeRot: THREE.Euler;
  surface: number; // y of the surface it rests on
  data?: any;
}

export interface World {
  mesh: THREE.Mesh;
  phys: Physics;
  pts: Record<string, THREE.Vector3>;
  props: Record<string, PropInfo>;
  gates: Record<string, { cols: AABB[]; obj: THREE.Object3D; open: boolean }>;
  water: { x0: number; z0: number; x1: number; z1: number }[];
  zones: Zone[];
  rects: MapRect[];
  dogYard: { x0: number; z0: number; x1: number; z1: number };
  anim: ((dt: number, t: number) => void)[];
  fishShadows: THREE.Object3D[];
}

const C = {
  grass: 0x7cc45a,
  grass2: 0x8fd26b,
  dirt: 0x94663f,
  asphalt: 0x50545c,
  line: 0xf1efe8,
  sidewalk: 0xd3ccbd,
  curb: 0xb3ab9c,
  peach: 0xf6d2b0,
  mint: 0xcde8d2,
  blue: 0xc5daf2,
  cream: 0xf3e6c8,
  lilac: 0xe3d5f2,
  roof: 0xc4553a,
  roof2: 0x3f8a6a,
  roof3: 0x5577aa,
  white: 0xf7f5ef,
  wood: 0xa8733f,
  woodD: 0x7a4f2a,
  woodL: 0xd4a46a,
  glass: 0x9fd3ee,
  frame: 0xffffff,
  concrete: 0xbdb8ae,
  iron: 0x2f5d45,
  fence: 0xf4f4f4,
  wallLot: 0xe8dcc0,
  hedge: 0x3f9a4a,
  water: 0x4aa3df,
  stone: 0x9a9a92,
};

export function signTex(lines: string[], bg: string, fg: string, w = 512, h = 128, font = 64) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  g.fillStyle = bg;
  g.fillRect(0, 0, w, h);
  g.fillStyle = fg;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `800 ${font}px "Baloo 2", system-ui, sans-serif`;
  lines.forEach((l, i) => g.fillText(l, w / 2, h / 2 + (i - (lines.length - 1) / 2) * font * 1.05));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function buildWorld(scene: THREE.Scene): World {
  const S = new StaticBuilder();
  const pts: Record<string, THREE.Vector3> = {};
  const props: Record<string, PropInfo> = {};
  const rects: MapRect[] = [];
  const anim: ((dt: number, t: number) => void)[] = [];
  const water: World['water'] = [];
  const zones: Zone[] = [];
  const gates: World['gates'] = {};
  const fishShadows: THREE.Object3D[] = [];
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

  const addProp = (id: string, obj: THREE.Object3D, surface: number, data?: any) => {
    scene.add(obj);
    props[id] = { obj, home: obj.position.clone(), homeRot: obj.rotation.clone(), surface, data };
    return props[id];
  };

  // ---------- helpers ----------
  const floor = (x0: number, z0: number, x1: number, z1: number, color: number, y = 0.012, top?: number) => S.mm(x0, y - 0.05, z0, x1, y, z1, color, { collide: false, top, jitter: 0.02 });
  const checker = (x0: number, z0: number, x1: number, z1: number, c1: number, c2: number, s = 1, y = 0.014) => {
    for (let x = x0, i = 0; x < x1 - 0.001; x += s, i++)
      for (let z = z0, j = 0; z < z1 - 0.001; z += s, j++) floor(x, z, Math.min(x + s, x1), Math.min(z + s, z1), (i + j) % 2 ? c1 : c2, y);
  };
  // wall along X at z (thickness t, centered), with gaps [a,b,doorTop]
  const wallX = (x0: number, x1: number, z: number, h: number, color: number, gaps: number[][] = [], t = 0.3, y0 = 0) => {
    let cur = x0;
    const gs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const g of gs) {
      if (g[0] > cur) S.mm(cur, y0, z - t / 2, g[0], y0 + h, z + t / 2, color);
      if (g[2] !== undefined && g[2] < h) S.mm(g[0], y0 + g[2], z - t / 2, g[1], y0 + h, z + t / 2, color);
      cur = g[1];
    }
    if (cur < x1) S.mm(cur, y0, z - t / 2, x1, y0 + h, z + t / 2, color);
  };
  const wallZ = (z0: number, z1: number, x: number, h: number, color: number, gaps: number[][] = [], t = 0.3, y0 = 0) => {
    let cur = z0;
    const gs = [...gaps].sort((a, b) => a[0] - b[0]);
    for (const g of gs) {
      if (g[0] > cur) S.mm(x - t / 2, y0, cur, x + t / 2, y0 + h, g[0], color);
      if (g[2] !== undefined && g[2] < h) S.mm(x - t / 2, y0 + g[2], g[0], x + t / 2, y0 + h, g[1], color);
      cur = g[1];
    }
    if (cur < z1) S.mm(x - t / 2, y0, cur, x + t / 2, y0 + h, z1, color);
  };
  // window panel on an X-facing or Z-facing wall surface (visual only)
  const winZ = (x0: number, x1: number, z: number, y0: number, y1: number, out: number) => {
    // wall along x, window seen from side `out` (+1 or -1 in z)
    const zz = z + out * 0.16;
    S.mm(x0, y0, zz - 0.02, x1, y1, zz + 0.02, C.glass, { collide: false, jitter: 0 });
    S.mm(x0 - 0.08, y0 - 0.08, zz - 0.03, x1 + 0.08, y0, zz + 0.05, C.frame, { collide: false });
    S.mm(x0 - 0.08, y1, zz - 0.03, x1 + 0.08, y1 + 0.08, zz + 0.05, C.frame, { collide: false });
    S.mm(x0 - 0.08, y0, zz - 0.03, x0, y1, zz + 0.05, C.frame, { collide: false });
    S.mm(x1, y0, zz - 0.03, x1 + 0.08, y1, zz + 0.05, C.frame, { collide: false });
    S.mm((x0 + x1) / 2 - 0.04, y0, zz - 0.03, (x0 + x1) / 2 + 0.04, y1, zz + 0.05, C.frame, { collide: false });
  };
  const winX = (z0: number, z1: number, x: number, y0: number, y1: number, out: number) => {
    const xx = x + out * 0.16;
    S.mm(xx - 0.02, y0, z0, xx + 0.02, y1, z1, C.glass, { collide: false, jitter: 0 });
    S.mm(xx - 0.03, y0 - 0.08, z0 - 0.08, xx + 0.05, y0, z1 + 0.08, C.frame, { collide: false });
    S.mm(xx - 0.03, y1, z0 - 0.08, xx + 0.05, y1 + 0.08, z1 + 0.08, C.frame, { collide: false });
    S.mm(xx - 0.03, y0, z0 - 0.08, xx + 0.05, y1, z0, C.frame, { collide: false });
    S.mm(xx - 0.03, y0, z1, xx + 0.05, y1, z1 + 0.08, C.frame, { collide: false });
    S.mm(xx - 0.03, y0, (z0 + z1) / 2 - 0.04, xx + 0.05, y1, (z0 + z1) / 2 + 0.04, C.frame, { collide: false });
  };
  const fenceX = (x0: number, x1: number, z: number, h: number, color: number, gaps: number[][] = [], bars = false) => {
    let cur = x0;
    const segs: number[][] = [];
    for (const g of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (g[0] > cur) segs.push([cur, g[0]]);
      cur = g[1];
    }
    if (cur < x1) segs.push([cur, x1]);
    for (const [a, b] of segs) {
      S.mm(a, 0, z - 0.06, b, h, z + 0.06, color, { visible: false, cam: false });
      const n = Math.max(1, Math.round((b - a) / (bars ? 0.25 : 1)));
      for (let i = 0; i <= n; i++) {
        const x = a + ((b - a) * i) / n;
        const post = bars ? 0.05 : 0.12;
        S.mm(x - post / 2, 0, z - post / 2, x + post / 2, h + (bars ? 0 : 0.08), z + post / 2, color, { collide: false });
      }
      S.mm(a, h - 0.12, z - 0.05, b, h - 0.02, z + 0.05, color, { collide: false });
      S.mm(a, h * 0.35, z - 0.05, b, h * 0.35 + 0.1, z + 0.05, color, { collide: false });
    }
  };
  const fenceZ = (z0: number, z1: number, x: number, h: number, color: number, gaps: number[][] = [], bars = false) => {
    let cur = z0;
    const segs: number[][] = [];
    for (const g of [...gaps].sort((a, b) => a[0] - b[0])) {
      if (g[0] > cur) segs.push([cur, g[0]]);
      cur = g[1];
    }
    if (cur < z1) segs.push([cur, z1]);
    for (const [a, b] of segs) {
      S.mm(x - 0.06, 0, a, x + 0.06, h, b, color, { visible: false, cam: false });
      const n = Math.max(1, Math.round((b - a) / (bars ? 0.25 : 1)));
      for (let i = 0; i <= n; i++) {
        const z = a + ((b - a) * i) / n;
        const post = bars ? 0.05 : 0.12;
        S.mm(x - post / 2, 0, z - post / 2, x + post / 2, h + (bars ? 0 : 0.08), z + post / 2, color, { collide: false });
      }
      S.mm(x - 0.05, h - 0.12, a, x + 0.05, h - 0.02, b, color, { collide: false });
      S.mm(x - 0.05, h * 0.35, a, x + 0.05, h * 0.35 + 0.1, b, color, { collide: false });
    }
  };
  const tree = (x: number, z: number, s = 1, kind = 0) => {
    S.box(x, 0, z, 0.45 * s, 2.1 * s, 0.45 * s, 0x7a4f2a, { cam: false });
    const leaf = kind === 1 ? 0x4fae54 : kind === 2 ? 0x6cc05a : 0x3f9a4a;
    S.box(x, 1.7 * s, z, 2.4 * s, 1.1 * s, 2.4 * s, leaf, { collide: false });
    S.box(x, 2.7 * s, z, 1.8 * s, 0.9 * s, 1.8 * s, leaf + 0x080808, { collide: false });
    S.box(x, 3.5 * s, z, 1.0 * s, 0.6 * s, 1.0 * s, leaf + 0x101010, { collide: false });
    if (kind === 1) for (let i = 0; i < 4; i++) S.box(x + Math.cos(i * 1.7) * 0.9 * s, 1.6 * s, z + Math.sin(i * 1.7) * 0.9 * s, 0.22, 0.28, 0.22, 0xf1a73a, { collide: false });
  };
  const palm = (x: number, z: number) => {
    for (let i = 0; i < 6; i++) S.box(x + i * 0.05, i * 0.7, z, 0.35, 0.7, 0.35, 0x8c6a45, { cam: false });
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      S.rot(x + 0.3 + Math.cos(a) * 1.1, 4.1, z + Math.sin(a) * 1.1, 2.2, 0.12, 0.6, -a, 0x4c9f3c, 0, 0.35);
    }
  };
  const bench = (x: number, z: number, alongX = true) => {
    if (alongX) {
      S.box(x, 0, z, 1.8, 0.45, 0.55, C.woodD, { collide: false });
      S.mm(x - 0.9, 0, z - 0.28, x + 0.9, 0.5, z + 0.28, C.wood, { visible: false });
      S.box(x, 0.4, z, 1.9, 0.1, 0.6, C.wood, { collide: false });
      S.box(x, 0.5, z - 0.28, 1.9, 0.5, 0.08, C.wood, { collide: false });
    } else {
      S.box(x, 0, z, 0.55, 0.45, 1.8, C.woodD, { collide: false });
      S.mm(x - 0.28, 0, z - 0.9, x + 0.28, 0.5, z + 0.9, C.wood, { visible: false });
      S.box(x, 0.4, z, 0.6, 0.1, 1.9, C.wood, { collide: false });
    }
  };
  const lamp = (x: number, z: number) => {
    S.box(x, 0, z, 0.16, 3.8, 0.16, 0x44474d, { cam: false });
    S.box(x, 3.8, z, 0.6, 0.12, 0.3, 0x44474d, { collide: false });
    S.box(x, 3.66, z, 0.4, 0.14, 0.22, 0xfff3c4, { collide: false });
  };
  const bush = (x: number, z: number, w: number, d: number, h = 0.8) => S.box(x, 0, z, w, h, d, C.hedge, { top: 0x4aa955, cam: false });
  const pottedPlant = (x: number, y: number, z: number, s = 1, color = 0xc86b3c) => {
    S.box(x, y, z, 0.4 * s, 0.35 * s, 0.4 * s, color);
    S.box(x, y + 0.35 * s, z, 0.5 * s, 0.4 * s, 0.5 * s, 0x4caf50, { collide: false });
    S.box(x, y + 0.7 * s, z, 0.3 * s, 0.25 * s, 0.3 * s, 0x5fbf5a, { collide: false });
  };
  // pitched stepped roof (ridge along x)
  const pitchedRoof = (x0: number, z0: number, x1: number, z1: number, y: number, color: number, layers = 5) => {
    S.mm(x0 - 0.5, y, z0 - 0.5, x1 + 0.5, y + 0.22, z1 + 0.5, color);
    const d = (z1 - z0 + 1) / 2 / (layers + 0.5);
    for (let i = 1; i <= layers; i++) S.mm(x0 - 0.5, y + 0.22 + (i - 1) * 0.42, z0 - 0.5 + d * i, x1 + 0.5, y + 0.22 + i * 0.42, z1 + 0.5 - d * i, i % 2 ? color : color - 0x080808);
  };
  // solid decorative house block with details
  const solidHouse = (x0: number, z0: number, x1: number, z1: number, wall: number, roofColor: number, flat: boolean, doorX: number) => {
    S.mm(x0, 0, z0, x1, 3.3, z1, wall);
    S.mm(x0 - 0.05, 0, z0 - 0.05, x1 + 0.05, 0.4, z1 + 0.05, wall - 0x202020, { collide: false });
    // front (z1 side) door + windows
    S.mm(doorX - 0.7, 0, z1, doorX + 0.7, 2.5, z1 + 0.08, 0x8a5a33, { collide: false });
    S.mm(doorX + 0.4, 1.2, z1 + 0.08, doorX + 0.52, 1.3, z1 + 0.14, 0xf5c542, { collide: false });
    const w1 = x0 + (doorX - x0) / 2, w2 = doorX + (x1 - doorX) / 2;
    winZ(w1 - 1.1, w1 + 1.1, z1 - 0.15, 1.0, 2.3, 1);
    winZ(w2 - 1.1, w2 + 1.1, z1 - 0.15, 1.0, 2.3, 1);
    if (flat) {
      S.mm(x0 - 0.3, 3.3, z0 - 0.3, x1 + 0.3, 3.6, z1 + 0.3, C.concrete, { top: 0xc9c4ba });
    } else pitchedRoof(x0, z0, x1, z1, 3.3, roofColor);
  };

  // ---------- ground & perimeter ----------
  S.mm(-48, -1, -34, 68, 0, 42, C.grass, { top: C.grass, jitter: 0 });
  // perimeter walls (tall, with invisible extension)
  const PW = 0xd9cdb1;
  S.mm(-48, 0, -33, 68, 4.5, -31, PW);
  S.mm(-48, 0, 39, 68, 4.5, 41, PW);
  S.mm(-48, 0, -33, -46, 4.5, 41, PW);
  S.mm(66, 0, -33, 68, 4.5, 41, PW);
  S.wall(-48, 4.5, -33, 68, 12, -31);
  S.wall(-48, 4.5, 39, 68, 12, 41);
  S.wall(-48, 4.5, -33, -46, 12, 41);
  S.wall(66, 4.5, -33, 68, 12, 41);
  // vines on perimeter
  for (let x = -44; x < 66; x += 7) S.mm(x, 2.5, -31.05, x + 2.5, 4.5, -30.9, 0x5aa55a, { collide: false });

  // ---------- street ----------
  floor(-46, -3.5, 66, 3.5, C.asphalt, 0.012);
  for (let x = -44; x < 64; x += 4) floor(x, -0.08, x + 2, 0.08, C.line, 0.02);
  S.mm(-46, 0, -5, 66, 0.15, -3.5, C.sidewalk, { top: C.sidewalk });
  S.mm(-46, 0, 3.5, 66, 0.15, 5, C.sidewalk, { top: C.sidewalk });
  S.mm(-46, 0, -3.6, 66, 0.17, -3.45, C.curb, { collide: false });
  S.mm(-46, 0, 3.45, 66, 0.17, 3.6, C.curb, { collide: false });
  rects.push({ x0: -46, z0: -5, x1: 66, z1: 5, c: '#8b8f96' });
  for (const x of [-34, -18, 0, 18, 36, 54]) lamp(x, 4.6);
  for (const x of [-26, 10, 44]) lamp(x, -4.6);
  // east gate (closed)
  S.mm(64, 0, -3.5, 65.6, 3.2, 3.5, 0x6d737c);
  for (let z = -3.2; z < 3.5; z += 0.5) S.mm(63.85, 0, z, 64, 3.1, z + 0.12, 0x3e434b, { collide: false });
  const gateSign = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.8), new THREE.MeshBasicMaterial({ map: signTex(['GERBANG KOMPLEKS'], '#2f5d45', '#fff4d6', 512, 96, 52) }));
  gateSign.position.set(63.8, 3.7, 0);
  gateSign.rotation.y = -Math.PI / 2;
  scene.add(gateSign);
  S.mm(63.9, 3.2, -2.2, 64.2, 4.2, 2.2, 0x2f5d45, { collide: false });
  // parked car
  {
    const x0 = -34, x1 = -30.2, z0 = -3.1, z1 = -1.3;
    S.mm(x0, 0.25, z0, x1, 1.0, z1, 0xe8574a);
    S.mm(x0 + 0.9, 1.0, z0 + 0.1, x1 - 0.6, 1.55, z1 - 0.1, 0xe8574a);
    S.mm(x0 + 1.0, 1.05, z0 + 0.05, x1 - 0.7, 1.45, z1 - 0.05, C.glass, { collide: false });
    for (const [x, z] of [
      [x0 + 0.7, z0],
      [x1 - 0.7, z0],
      [x0 + 0.7, z1],
      [x1 - 0.7, z1],
    ])
      S.box(x, 0, z, 0.6, 0.55, 0.25, 0x222222, { collide: false });
    S.mm(x1, 0.5, z0 + 0.2, x1 + 0.05, 0.7, z0 + 0.5, 0xfff3b0, { collide: false });
    S.mm(x1, 0.5, z1 - 0.5, x1 + 0.05, 0.7, z1 - 0.2, 0xfff3b0, { collide: false });
  }
  // gerobak (street cart) decoration
  {
    const x = -40, z = 2.6;
    S.mm(x - 1, 0.5, z - 0.5, x + 1, 1.3, z + 0.5, 0x3d8fd9);
    S.mm(x - 1.05, 1.3, z - 0.55, x + 1.05, 1.36, z + 0.55, 0xffffff, { collide: false });
    S.mm(x - 0.9, 1.36, z - 0.35, x - 0.5, 1.8, z + 0.35, C.glass, { collide: false });
    S.box(x - 0.6, 0, z + 0.45, 0.1, 0.5, 0.5, 0x222222, { collide: false });
    S.box(x + 0.6, 0, z + 0.45, 0.1, 0.5, 0.5, 0x222222, { collide: false });
    S.mm(x - 1, 2.4, z - 0.6, x + 1, 2.5, z + 0.6, 0xf0c24a, { collide: false });
    S.box(x - 0.95, 0.5, z - 0.5, 0.06, 1.9, 0.06, 0x888888, { collide: false });
    S.box(x + 0.95, 0.5, z - 0.5, 0.06, 1.9, 0.06, 0x888888, { collide: false });
  }

  // ================= HOME (Lot A) =================
  rects.push({ x0: -24, z0: -31, x1: -4, z1: -5.2, c: '#a8d88a' });
  fenceX(-24, -4, -5.25, 1.1, C.fence, [[-15.5, -12.5]]);
  S.mm(-24.2, 0, -31, -23.9, 1.4, -5.2, C.wallLot);
  S.mm(-4.1, 0, -31, -3.8, 1.4, -5.2, C.wallLot);
  floor(-15, -10, -13, -5.25, 0xd9cbb3, 0.016);
  for (let z = -9.6; z < -5.4; z += 0.9) floor(-14.8, z, -13.2, z + 0.6, 0xc9b99c, 0.02);
  // teras
  S.mm(-19, 0, -13, -9, 0.2, -10, 0xe0d4c0, { top: 0xefe6d6 });
  pottedPlant(-18.5, 0.2, -10.5, 1.1, 0xc86b3c);
  pottedPlant(-9.5, 0.2, -10.5, 1.1, 0x5d8fc9);
  tree(-21, -8, 1, 1);
  tree(-6.5, -9.5, 0.8, 2);
  // mailbox
  S.box(-11.5, 0, -5.8, 0.15, 1.0, 0.15, 0x555555, { cam: false });
  S.box(-11.5, 1.0, -5.8, 0.5, 0.35, 0.35, 0xe53935, { cam: false });
  // House A shell
  const HA = { x0: -22, z0: -27, x1: -6, z1: -13 };
  rects.push({ x0: HA.x0, z0: HA.z0, x1: HA.x1, z1: HA.z1, c: '#f3b88f' });
  const H = 3.3;
  wallX(HA.x0, HA.x1, HA.z1 - 0.15, H, C.peach, [[-15, -13.4, 2.6]]);
  wallX(HA.x0, HA.x1, HA.z0 + 0.15, H, C.peach);
  wallZ(HA.z0, HA.z1, HA.x0 + 0.15, H, C.peach);
  wallZ(HA.z0, HA.z1, HA.x1 - 0.15, H, C.peach);
  // outside base strip
  S.mm(HA.x0 - 0.04, 0, HA.z1 - 0.02, -15, 0.45, HA.z1 + 0.04, 0xd9a882, { collide: false });
  S.mm(-13.4, 0, HA.z1 - 0.02, HA.x1 + 0.04, 0.45, HA.z1 + 0.04, 0xd9a882, { collide: false });
  // windows (both sides)
  winZ(-21, -18.5, HA.z1 - 0.15, 1.0, 2.3, 1);
  winZ(-11, -8, HA.z1 - 0.15, 1.0, 2.3, 1);
  winZ(-21, -18.5, HA.z1 - 0.15, 1.0, 2.3, -1);
  winZ(-11, -8, HA.z1 - 0.15, 1.0, 2.3, -1);
  winZ(-20, -17.5, HA.z0 + 0.15, 1.2, 2.3, -1);
  winZ(-12.5, -10, HA.z0 + 0.15, 1.2, 2.3, -1);
  winX(-17.5, -14.5, HA.x0 + 0.15, 0.9, 2.4, -1);
  winX(-17.5, -14.5, HA.x0 + 0.15, 0.9, 2.4, 1);
  winX(-17, -15, HA.x1 - 0.15, 1.1, 2.3, 1);
  // door frame + open door leaf
  S.mm(-15.1, 0, HA.z1 - 0.2, -15, 2.7, HA.z1 + 0.1, 0xffffff, { collide: false });
  S.mm(-13.4, 0, HA.z1 - 0.2, -13.3, 2.7, HA.z1 + 0.1, 0xffffff, { collide: false });
  const doorLeaf = new THREE.Group();
  doorLeaf.add(mbox(1.5, 2.5, 0.08, 0x8a5a33, 0.75, 1.25, 0));
  doorLeaf.add(mbox(0.1, 0.1, 0.1, 0xf5c542, 1.35, 1.2, 0.08));
  doorLeaf.position.set(-15, 0.02, HA.z1 - 0.05);
  scene.add(doorLeaf);
  props['door'] = { obj: doorLeaf, home: doorLeaf.position.clone(), homeRot: doorLeaf.rotation.clone(), surface: 0 };
  // interior walls
  wallX(HA.x0 + 0.3, HA.x1 - 0.3, -19, H, 0xf7efe2, [
    [-19.5, -18, 2.5],
    [-11, -9.5, 2.5],
  ], 0.3);
  wallZ(HA.z0 + 0.3, -19.15, -14, H, 0xf7efe2, [], 0.3);
  // ceiling + roof
  S.mm(HA.x0, H, HA.z0, HA.x1, H + 0.25, HA.z1, 0xfaf7f0);
  pitchedRoof(HA.x0, HA.z0, HA.x1, HA.z1, H + 0.25, C.roof, 5);
  // floors
  checker(-21.7, -18.85, -6.3, -13.3, 0xeee4d3, 0xdcd0bb, 1.1);
  floor(-21.7, -26.7, -14.15, -19.15, 0xc79a67, 0.014);
  for (let x = -21.7; x < -14.2; x += 0.6) floor(x, -26.7, x + 0.02, -19.15, 0xa87c4c, 0.016);
  checker(-13.85, -26.7, -6.3, -19.15, 0xd8e6ea, 0xc2d6dc, 0.8);
  floor(-15, -13.3, -13.4, -12.95, 0xdcd0bb, 0.016);
  // --- ruang tamu ---
  // sofa (sleep spot)
  S.mm(-21.5, 0, -14.4, -17.5, 0.55, -13.3, 0x3f7fcf, { top: 0x5a98e6 });
  S.mm(-21.5, 0.55, -13.7, -17.5, 1.15, -13.3, 0x3f7fcf);
  S.mm(-21.6, 0, -14.5, -21.2, 0.85, -13.3, 0x3571bd);
  S.mm(-17.8, 0, -14.5, -17.4, 0.85, -13.3, 0x3571bd);
  S.mm(-21.1, 0.55, -14.3, -19.6, 0.65, -13.75, 0x6aa7ea, { collide: false });
  S.mm(-19.4, 0.55, -14.3, -17.9, 0.65, -13.75, 0x6aa7ea, { collide: false });
  S.mm(-20.9, 0.65, -13.72, -20.3, 1.0, -13.6, 0xffc857, { collide: false });
  pts.sofa = V(-19.5, 0.55, -14.05);
  pts.sofaFront = V(-19.5, 0, -15.2);
  // TV
  S.mm(-21, 0, -18.85, -18, 0.6, -18.3, C.woodD, { top: C.wood });
  S.mm(-20.6, 0.6, -18.75, -18.4, 1.8, -18.6, 0x1c1c22);
  const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.05), new THREE.MeshBasicMaterial({ color: 0x223344 }));
  tvScreen.position.set(-19.5, 1.2, -18.595);
  scene.add(tvScreen);
  // coffee table + rug
  floor(-21, -17.6, -17.6, -14.8, 0xe3a857, 0.02);
  floor(-20.8, -17.4, -17.8, -15.0, 0xd88a3a, 0.024);
  S.mm(-20.3, 0, -16.8, -18.7, 0.5, -15.8, C.wood, { visible: false });
  S.mm(-20.35, 0.42, -16.85, -18.65, 0.5, -15.75, C.woodL, { collide: false });
  for (const [x, z] of [
    [-20.25, -16.75],
    [-18.8, -16.75],
    [-20.25, -15.9],
    [-18.8, -15.9],
  ])
    S.box(x, 0, z, 0.08, 0.42, 0.08, C.woodD, { collide: false });
  // plant stand + bookshelf + clock + photos
  S.mm(-7.3, 0, -14.6, -6.5, 0.9, -13.8, C.woodD, { top: C.wood });
  S.mm(-6.85, 0, -18.6, -6.3, 2.2, -16.4, C.wood);
  for (let i = 0; i < 4; i++) {
    S.mm(-6.9, 0.3 + i * 0.5, -18.5, -6.86, 0.33 + i * 0.5, -16.5, C.woodD, { collide: false });
    for (let b = 0; b < 6; b++) S.mm(-6.95, 0.33 + i * 0.5, -18.4 + b * 0.32, -6.87, 0.7 + i * 0.5 - (b % 3) * 0.05, -18.2 + b * 0.32, [0xe57373, 0x64b5f6, 0xffd54f, 0x81c784, 0xba68c8, 0xff8a65][b], { collide: false });
  }
  S.mm(-12.5, 2.3, -13.49, -11.9, 2.9, -13.43, 0xffffff, { collide: false });
  S.mm(-12.4, 2.4, -13.52, -12.0, 2.8, -13.47, 0x333333, { collide: false });
  S.mm(-9.5, 1.6, -18.83, -8.5, 2.3, -18.8, 0x8a5a33, { collide: false });
  S.mm(-9.4, 1.7, -18.8, -8.6, 2.2, -18.77, 0x9fd3ee, { collide: false });
  S.mm(-8.2, 1.7, -18.83, -7.4, 2.4, -18.8, 0x8a5a33, { collide: false });
  S.mm(-8.1, 1.8, -18.8, -7.5, 2.3, -18.77, 0xf7c6a3, { collide: false });
  // shoe rack by the door
  S.mm(-13.2, 0, -13.9, -12.2, 0.4, -13.35, C.woodD, { top: C.wood });
  // --- kamar ---
  S.mm(-21.6, 0, -26.6, -18.4, 0.45, -22.4, C.woodD);
  S.mm(-21.5, 0.45, -26.5, -18.5, 0.62, -22.5, 0xffffff, { top: 0xf8f8f8 });
  S.mm(-21.52, 0.5, -24.8, -18.48, 0.66, -22.48, 0xf48fb1, { collide: false });
  S.mm(-21.1, 0.62, -26.3, -18.9, 0.78, -25.7, 0xffffff, { collide: false });
  S.mm(-21.6, 0, -26.7, -18.4, 1.25, -26.45, C.woodD);
  S.mm(-17.1, 0, -26.65, -14.4, 0.85, -25.6, C.wood, { top: C.woodL });
  S.mm(-16.3, 0, -25.3, -15.5, 0.5, -24.5, C.woodD, { top: C.wood });
  S.mm(-16.3, 0.5, -24.6, -15.5, 1.05, -24.5, C.woodD, { collide: false });
  S.mm(-21.6, 0, -21.8, -20.1, 2.3, -19.35, 0xb98555);
  S.mm(-20.13, 0.3, -21.7, -20.08, 2.2, -19.45, 0x9c6e45, { collide: false });
  S.mm(-17.5, 0.62, -22.2, -17.2, 0.8, -21.9, 0xe53935, { collide: false });
  floor(-18.2, -23.5, -15.8, -21.5, 0xa5d6a7, 0.02);
  // --- dapur ---
  S.mm(-13.8, 0, -26.7, -8.5, 1.0, -26.0, 0xeceff1, { top: 0xb0bec5 });
  S.mm(-13.5, 1.0, -26.6, -12.5, 1.05, -26.1, 0x263238, { collide: false });
  S.mm(-13.3, 1.05, -26.5, -13.0, 1.1, -26.2, 0x455a64, { collide: false });
  S.mm(-12.9, 1.05, -26.5, -12.6, 1.1, -26.2, 0x455a64, { collide: false });
  S.mm(-9.6, 0.9, -26.6, -8.8, 1.01, -26.1, 0x90a4ae, { collide: false });
  S.mm(-9.3, 1.0, -26.68, -9.2, 1.5, -26.58, 0xb0bec5, { collide: false });
  S.mm(-11.8, 1.0, -26.55, -11.3, 1.4, -26.1, 0xffffff, { collide: false });
  S.mm(-11.75, 1.4, -26.5, -11.35, 1.45, -26.15, 0x9e9e9e, { collide: false });
  S.mm(-7.6, 0, -26.65, -6.35, 2.0, -25.6, 0xfafafa);
  S.mm(-7.6, 1.2, -25.61, -6.35, 1.22, -25.58, 0xbdbdbd, { collide: false });
  S.mm(-6.6, 1.35, -25.6, -6.52, 1.8, -25.55, 0x9e9e9e, { collide: false });
  // dining table: slab + legs, cat can walk under
  S.mm(-12.05, 0.78, -23.25, -8.95, 0.86, -21.75, C.woodL);
  for (const [x, z] of [
    [-11.9, -23.1],
    [-9.1, -23.1],
    [-11.9, -21.9],
    [-9.1, -21.9],
  ])
    S.box(x, 0, z, 0.1, 0.78, 0.1, C.woodD);
  floor(-12.3, -23.5, -8.7, -21.5, 0xfff8e1, 0.87);
  for (const x of [-11.2, -9.8])
    for (const [z0, z1, bz] of [
      [-24.1, -23.5, -24.1],
      [-21.5, -20.9, -20.98],
    ]) {
      S.mm(x - 0.3, 0, z0, x + 0.3, 0.5, z1, C.wood, { top: C.woodL });
      S.mm(x - 0.3, 0.5, bz, x + 0.3, 1.2, bz + 0.08, C.wood);
    }
  pts.mamaStart = V(-10.5, 0, -24.8);
  pts.homeInside = V(-16, 0, -15.5);
  pts.homeDoor = V(-14.2, 0, -12.2);
  pts.homeDoorIn = V(-14.2, 0, -14.2);
  pts.homeGate = V(-14, 0.15, -4.4);
  pts.homeYard = V(-14, 0, -8);
  zones.push({ id: 'rumah', x0: -24, z0: -31, x1: -4, z1: -5.2 });

  // ---- home props ----
  {
    // gelas on dining table edge
    const g = new THREE.Group();
    const glassMat = new THREE.MeshLambertMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.75 });
    g.add(new THREE.Mesh(boxGeo(0.14, 0.2, 0.14), glassMat));
    g.children[0].position.y = 0.1;
    g.add(mbox(0.11, 0.12, 0.11, 0xff9e3d, 0, 0.07, 0));
    g.position.set(-9.25, 0.86, -22.3);
    addProp('gelas', g, 0.86);
  }
  {
    // laptop on the desk
    const g = new THREE.Group();
    g.add(mbox(0.62, 0.04, 0.42, 0x9ea7b3, 0, 0.02, 0));
    g.add(mbox(0.56, 0.01, 0.3, 0x3a3f47, 0, 0.045, 0.02));
    const lid = new THREE.Group();
    lid.position.set(0, 0.04, -0.2);
    lid.rotation.x = -0.35;
    lid.add(mbox(0.62, 0.4, 0.03, 0x9ea7b3, 0, 0.2, 0));
    const c = document.createElement('canvas');
    c.width = 256;
    c.height = 160;
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.34), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c) }));
    sc.position.set(0, 0.2, 0.017);
    lid.add(sc);
    g.add(lid);
    g.position.set(-15.7, 0.85, -26.05);
    addProp('laptop', g, 0.85, { canvas: c, screen: sc });
  }
  {
    // tissue roll on coffee table
    const g = new THREE.Group();
    g.add(mbox(0.2, 0.22, 0.2, 0xffffff, 0, 0.11, 0));
    g.add(mbox(0.07, 0.23, 0.07, 0xd7ccc8, 0, 0.115, 0));
    g.position.set(-19.0, 0.5, -16.3);
    addProp('tisu', g, 0.5);
  }
  {
    // fried fish on a plate on the counter
    const g = new THREE.Group();
    g.add(mbox(0.5, 0.03, 0.34, 0xffffff, 0, 0.015, 0));
    const fish = fishMesh(0xc27a32, 0.9);
    fish.position.y = 0.06;
    g.add(fish);
    g.position.set(-10.6, 1.0, -26.35);
    addProp('ikan_dapur', g, 1.0, { fish });
  }
  {
    const pot = potMesh(0xd9774a, 0xff6f91);
    pot.position.set(-6.9, 0.9, -14.2);
    addProp('pot_rumah', pot, 0.9);
  }
  {
    // curtains on the west window (two panels)
    const g = new THREE.Group();
    const panels: THREE.Mesh[] = [];
    for (const z of [-17.0, -15.0]) {
      const p = mbox(0.08, 2.2, 1.3, 0xef7c8e, 0, 1.5, z);
      g.add(p);
      panels.push(p);
    }
    g.add(mbox(0.06, 0.06, 3.6, 0xc49a5a, 0, 2.66, -16.0));
    g.position.set(-21.55, 0, 0);
    addProp('gorden', g, 0, { panels });
  }

  // ================= GANG =================
  floor(-3.8, -30.8, -0.6, -5.2, 0xb9b2a4, 0.012);
  rects.push({ x0: -3.8, z0: -31, x1: -1, z1: -5.2, c: '#b9b2a4' });
  S.box(-2.5, 0, -8.5, 0.7, 1.0, 0.7, 0x2e7d32);
  S.box(-2.5, 1.0, -8.5, 0.75, 0.08, 0.75, 0x1b5e20, { collide: false });
  S.box(-2.8, 0, -11.2, 0.6, 0.5, 0.6, 0x8d6e63);
  // crate step 1 (always there)
  crate(S, -1.3, -15.4, 1.3, 1.2, 0.9);
  pts.crates = V(-1.8, 0, -13.8);
  // crates 2 + water barrel (appear with rooftop unlock)
  {
    const g = new THREE.Group();
    const c2a = crateMesh(1.3, 0.9, 1.3);
    c2a.position.set(-1.3, 0.45, -16.65);
    const c2b = crateMesh(1.2, 0.9, 1.2);
    c2b.position.set(-1.3, 1.35, -16.65);
    const drum = new THREE.Group();
    drum.add(mbox(1.1, 1.5, 1.1, 0x607d8b, 0, 0.75, 0));
    drum.add(mbox(1.3, 1.25, 1.3, 0x1e88e5, 0, 2.08, 0));
    drum.add(mbox(0.6, 0.1, 0.6, 0x1565c0, 0, 2.75, 0));
    drum.position.set(-1.3, 0, -18.1);
    g.add(c2a, c2b, drum);
    scene.add(g);
    const cols: AABB[] = [];
    S.mm(-1.95, 0, -17.3, -0.85, 1.8, -16.0, 0, { visible: false, out: cols });
    S.mm(-1.95, 0, -18.75, -0.85, 2.75, -17.45, 0, { visible: false, out: cols });
    gates.atap = { cols, obj: g, open: false };
  }
  zones.push({ id: 'gang', x0: -3.9, z0: -31, x1: -0.6, z1: -5.2 });

  // ================= LOT B (Bu Siti) =================
  rects.push({ x0: -1, z0: -31, x1: 19.3, z1: -5.2, c: '#b5e39a' });
  fenceX(-1, 19.3, -5.25, 1.1, C.iron, [[6.5, 9.5]], true);
  S.mm(-1.1, 0, -14, -0.8, 1.4, -5.2, C.wallLot);
  S.mm(19.0, 0, -31, 19.3, 2.2, -5.2, C.wallLot);
  const HB = { x0: -0.5, z0: -27, x1: 15, z1: -14 };
  rects.push({ x0: HB.x0, z0: HB.z0, x1: HB.x1, z1: HB.z1, c: '#9ed1b0' });
  S.mm(HB.x0, 0, HB.z0, HB.x1, 3.3, HB.z1, C.mint);
  S.mm(HB.x0 - 0.04, 0, HB.z1, HB.x1 + 0.04, 0.45, HB.z1 + 0.05, 0x9fc9aa, { collide: false });
  S.mm(6.8, 0.2, HB.z1, 8.2, 2.5, HB.z1 + 0.08, 0x6d4c33, { collide: false });
  winZ(1.5, 4.5, HB.z1 - 0.15, 1.0, 2.3, 1);
  winZ(10, 13, HB.z1 - 0.15, 1.0, 2.3, 1);
  winX(-24, -20, HB.x0 + 0.15, 1.2, 2.3, -1);
  // flat roof with parapet (gap west for crates, gap east for the plank)
  const RY = 3.6;
  S.mm(HB.x0 - 0.3, 3.3, HB.z0 - 0.3, HB.x1 + 0.3, RY, HB.z1 + 0.3, C.concrete, { top: 0xcac4b8 });
  S.mm(HB.x0 - 0.3, RY, HB.z0 - 0.3, HB.x1 + 0.3, RY + 0.35, HB.z0 - 0.1, 0xb0aa9e);
  S.mm(HB.x0 - 0.3, RY, HB.z1 + 0.1, HB.x1 + 0.3, RY + 0.35, HB.z1 + 0.3, 0xb0aa9e);
  wallZ(HB.z0 - 0.1, HB.z1 + 0.1, HB.x0 - 0.2, 0.35, 0xb0aa9e, [[-19.3, -14.3]], 0.2, RY);
  wallZ(HB.z0 - 0.1, HB.z1 + 0.1, HB.x1 + 0.2, 0.35, 0xb0aa9e, [[-21.2, -20.2]], 0.2, RY);
  rects.push({ x0: HB.x0, z0: HB.z0, x1: HB.x1, z1: HB.z1, c: '#9ed1b0' });
  // roof water tank + antenna
  S.mm(11, RY, -26.2, 13.2, RY + 1.6, -24.2, 0xf08a3a);
  S.mm(11.1, RY + 1.6, -26.1, 13.1, RY + 1.75, -24.3, 0xe07020, { collide: false });
  S.box(2, RY, -25.5, 0.08, 2.2, 0.08, 0x777777, { cam: false });
  S.box(2, RY + 2.0, -25.5, 1.2, 0.05, 0.05, 0x777777, { collide: false });
  // jemuran on roof B
  S.box(3.6, RY, -21.2, 0.12, 1.8, 0.12, 0x9e9e9e, { cam: false });
  S.box(10.4, RY, -21.2, 0.12, 1.8, 0.12, 0x9e9e9e, { cam: false });
  S.box(7, RY + 1.72, -21.2, 6.8, 0.03, 0.03, 0xeeeeee, { collide: false });
  {
    const g = new THREE.Group();
    const cloths: THREE.Object3D[] = [];
    const cols = [0xef5350, 0x42a5f5, 0xffee58, 0x66bb6a, 0xab47bc];
    for (let i = 0; i < 5; i++) {
      const c = new THREE.Group();
      const col = cols[i];
      c.add(mbox(0.7, 0.62, 0.04, col, 0, -0.33, 0));
      c.add(mbox(1.0, 0.2, 0.04, col, 0, -0.1, 0));
      c.add(mbox(0.06, 0.06, 0.06, 0xffffff, -0.25, 0.0, 0));
      c.add(mbox(0.06, 0.06, 0.06, 0xffffff, 0.25, 0.0, 0));
      c.position.set(4.6 + i * 1.2, RY + 1.7, -21.2);
      g.add(c);
      cloths.push(c);
    }
    scene.add(g);
    props['jemuran'] = { obj: g, home: g.position.clone(), homeRot: g.rotation.clone(), surface: RY, data: { cloths, homes: cloths.map((c) => c.position.clone()) } };
  }
  pts.jemuran = V(7, RY, -20.6);
  // yard: teras, ledge, bench, sandals, motor
  S.mm(2, 0, -14, 13, 0.2, -11.5, 0xd7ccc8, { top: 0xe8dfd8 });
  S.mm(2, 0, -11.7, 6, 0.8, -11.45, 0xbcaaa4, { top: 0xd7ccc8 });
  S.mm(9, 0, -11.7, 13, 0.8, -11.45, 0xbcaaa4, { top: 0xd7ccc8 });
  S.mm(9.5, 0.2, -13.8, 12, 0.5, -13.0, 0xc8a165, { top: 0xdcb87a });
  S.mm(9.5, 0.5, -13.95, 12, 1.0, -13.8, 0xc8a165);
  tree(1.6, -8.5, 0.9, 1);
  for (let x = 0.5; x < 6; x += 1.2) pottedPlant(x, 0, -6.2, 0.7, 0xc86b3c);
  pottedPlant(10.5, 0, -6.2, 0.7, 0xd4a15a);
  {
    const pot = potMesh(0x8d6e63, 0xffd54f);
    pot.position.set(4, 0.8, -11.58);
    addProp('pot_tetangga', pot, 0.8);
  }
  {
    const g = new THREE.Group();
    g.add(mbox(0.62, 0.05, 0.42, 0xf5f5f5, 0, 0.025, 0));
    for (let i = 0; i < 4; i++) g.add(mbox(0.5, 0.012, 0.03, 0x555555, 0, 0.056, -0.15 + i * 0.08));
    g.add(mbox(0.22, 0.012, 0.15, 0x90a4ae, 0.15, 0.056, 0.1));
    g.position.set(10.7, 0.5, -13.35);
    g.rotation.y = 0.2;
    addProp('koran', g, 0.5);
  }
  {
    const g = new THREE.Group();
    for (const x of [-0.12, 0.12]) {
      g.add(mbox(0.16, 0.04, 0.36, 0x1e88e5, x, 0.02, 0));
      g.add(mbox(0.12, 0.05, 0.03, 0xffffff, x, 0.06, 0.05));
    }
    g.position.set(7.5, 0.2, -12.7);
    addProp('sandal', g, 0.2);
  }
  {
    const g = new THREE.Group();
    g.add(mbox(0.5, 0.45, 1.4, 0xd32f2f, 0, 0.55, 0));
    g.add(mbox(0.46, 0.14, 0.8, 0x222222, 0, 0.84, -0.15));
    g.add(mbox(0.12, 0.55, 0.55, 0x222222, 0, 0.28, 0.72));
    g.add(mbox(0.12, 0.55, 0.55, 0x222222, 0, 0.28, -0.72));
    g.add(mbox(0.3, 0.5, 0.2, 0xd32f2f, 0, 0.95, 0.72));
    g.add(mbox(0.9, 0.06, 0.06, 0x333333, 0, 1.25, 0.72));
    const light = new THREE.Mesh(boxGeo(0.18, 0.12, 0.06), new THREE.MeshLambertMaterial({ color: 0xfff3b0, emissive: 0x000000 }));
    light.position.set(0, 1.0, 0.83);
    const tail = new THREE.Mesh(boxGeo(0.16, 0.08, 0.05), new THREE.MeshLambertMaterial({ color: 0xff5252, emissive: 0x000000 }));
    tail.position.set(0, 0.8, -0.72);
    g.add(light, tail);
    g.position.set(14.6, 0, -8.2);
    addProp('motor', g, 0, { lights: [light, tail] });
    S.mm(14.3, 0, -9.0, 14.9, 0.98, -7.4, 0, { visible: false });
    S.mm(14.34, 0, -9.0, 14.86, 0.55, -7.2, 0, { visible: false });
  }
  pts.motorSeat = V(14.6, 0.98, -8.35);
  pts.sitiHome = V(8, 0, -9);
  zones.push({ id: 'tetangga', x0: -0.6, z0: -31, x1: 19.2, z1: -5.2 });

  // ================= LOT C (Pak RT + dog) =================
  rects.push({ x0: 19.3, z0: -31, x1: 40, z1: -5.2, c: '#c9e7a8' });
  fenceX(19.3, 40, -5.25, 2.2, 0x2f4f3f, [], true);
  S.mm(39.8, 0, -31, 40.1, 2.2, -5.2, C.wallLot);
  const HC = { x0: 23, z0: -27, x1: 38, z1: -15 };
  S.mm(HC.x0, 0, HC.z0, HC.x1, 3.3, HC.z1, C.blue);
  S.mm(HC.x0 - 0.04, 0, HC.z1, HC.x1 + 0.04, 0.45, HC.z1 + 0.05, 0x9db7d6, { collide: false });
  S.mm(29.8, 0, HC.z1, 31.2, 2.5, HC.z1 + 0.08, 0x5d4037, { collide: false });
  winZ(24.5, 27.5, HC.z1 - 0.15, 1.0, 2.3, 1);
  winZ(33.5, 36.5, HC.z1 - 0.15, 1.0, 2.3, 1);
  S.mm(HC.x0 - 0.3, 3.3, HC.z0 - 0.3, HC.x1 + 0.3, RY, HC.z1 + 0.3, C.concrete, { top: 0xcac4b8 });
  S.mm(HC.x0 - 0.3, RY, HC.z0 - 0.3, HC.x1 + 0.3, RY + 0.35, HC.z0 - 0.1, 0xb0aa9e);
  S.mm(HC.x0 - 0.3, RY, HC.z1 + 0.1, HC.x1 + 0.3, RY + 0.35, HC.z1 + 0.3, 0xb0aa9e);
  wallZ(HC.z0 - 0.1, HC.z1 + 0.1, HC.x0 - 0.2, 0.35, 0xb0aa9e, [[-21.2, -20.2]], 0.2, RY);
  wallZ(HC.z0 - 0.1, HC.z1 + 0.1, HC.x1 + 0.2, 0.35, 0xb0aa9e, [], 0.2, RY);
  rects.push({ x0: HC.x0, z0: HC.z0, x1: HC.x1, z1: HC.z1, c: '#a9c4e6' });
  // plank bridge between roofs
  S.mm(HB.x1 + 0.1, RY - 0.15, -21.1, HC.x0 - 0.1, RY, -20.3, C.woodL, { top: 0xdcb87a });
  rects.push({ x0: HB.x1, z0: -21.1, x1: HC.x0, z1: -20.3, c: '#d4a46a' });
  // roof C details
  S.mm(34, RY, -26.4, 36, RY + 1.2, -24.4, 0x90a4ae);
  S.box(37, RY, -17, 0.08, 2.5, 0.08, 0x777777, { cam: false });
  S.box(37, RY + 2.3, -17, 0.05, 0.05, 1.4, 0x777777, { collide: false });
  S.mm(28.6, RY, -22.6, 31.4, RY + 0.35, -21.4, C.woodD, { top: C.wood });
  {
    const g = new THREE.Group();
    g.add(mbox(1.6, 0.06, 1.6, 0xd8b36a, 0, 0.03, 0));
    for (let i = 0; i < 6; i++) {
      const f = fishMesh(0xb0a080, 0.7);
      f.position.set(-0.45 + (i % 3) * 0.45, 0.07, -0.3 + Math.floor(i / 3) * 0.6);
      f.rotation.y = 0.3 * (i % 2 ? 1 : -1);
      g.add(f);
    }
    g.position.set(30, RY + 0.35, -22);
    addProp('ikan_asin', g, RY + 0.35);
  }
  pts.ikanAsin = V(30, RY, -22);
  pts.pigeonRoof = V(33.5, RY, -18.5);
  zones.push({ id: 'atap', x0: -1.2, z0: -28, x1: 38.6, z1: -13.5, ymin: 3.3 });
  // dog yard
  const dogYard = { x0: 19.6, z0: -14.7, x1: 39.6, z1: -5.5 };
  S.mm(35.3, 0, -13.2, 37.1, 1.2, -11.8, 0xb5651d);
  S.mm(35.1, 1.2, -13.4, 37.3, 1.35, -11.6, 0x8d3f14);
  S.mm(35.9, 0, -11.78, 36.5, 0.8, -11.74, 0x3e2723, { collide: false });
  S.mm(33.5, 0.02, -11.2, 34.1, 0.14, -10.6, 0x9e9e9e, { collide: false });
  pts.dogBed = V(34.5, 0, -10.2);
  pts.dogFence = V(29.5, 0.15, -4.5);
  tree(22, -8, 0.9, 2);
  zones.push({ id: 'anjing', x0: 19.3, z0: -31, x1: 40.1, z1: -5.2 });

  // ================= HOUSE D (west) and E (east), decorative =================
  rects.push({ x0: -46, z0: -31, x1: -24.2, z1: -5.2, c: '#a8d88a' });
  fenceX(-46, -24.2, -5.25, 1.1, C.fence);
  solidHouse(-42, -27, -28, -12, C.lilac, C.roof3, false, -35);
  rects.push({ x0: -42, z0: -27, x1: -28, z1: -12, c: '#c9b8e6' });
  tree(-44, -9, 0.9, 0);
  tree(-26, -8, 0.8, 2);
  rects.push({ x0: 40.1, z0: -31, x1: 66, z1: -5.2, c: '#a8d88a' });
  fenceX(40.1, 66, -5.25, 1.1, C.fence, [[49, 53]]);
  solidHouse(44, -27, 60, -12, C.cream, C.roof2, false, 51);
  rects.push({ x0: 44, z0: -27, x1: 60, z1: -12, c: '#eed9a8' });
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshBasicMaterial({ map: signTex(['WARUNG BU INAH'], '#c0392b', '#fff4d6', 512, 128, 60) }));
    sign.position.set(51, 2.9, -11.9);
    scene.add(sign);
  }
  S.mm(47, 0, -11.5, 55, 0.9, -10.5, 0x8d6e63, { top: 0xa1887f });
  for (let i = 0; i < 6; i++) S.box(47.8 + i * 1.3, 0.9, -11, 0.4, 0.4, 0.4, [0xff7043, 0x42a5f5, 0xffee58, 0x66bb6a, 0xec407a, 0xffa726][i], { collide: false });
  palm(62, -9);
  palm(42, -8);

  // ================= PARK =================
  rects.push({ x0: -30, z0: 5.2, x1: 12, z1: 39, c: '#86cf62' });
  floor(-30, 5.2, 12, 39, C.grass2, 0.006);
  // hedges
  for (const [a, b] of [
    [-30, -14.5],
    [-8.5, 4],
    [6, 12],
  ])
    bush((a + b) / 2, 5.6, b - a, 0.7);
  bush(-29.6, 22, 0.7, 33);
  bush(11.6, 22, 0.7, 33);
  // entrance pillars
  S.box(-14.2, 0, 5.6, 0.7, 1.0, 0.7, 0xd7ccc8, { top: 0xe0d6cf });
  S.box(-8.8, 0, 5.6, 0.7, 1.0, 0.7, 0xd7ccc8, { top: 0xe0d6cf });
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 0.8), new THREE.MeshBasicMaterial({ map: signTex(['TAMAN KOMPLEKS'], '#2e7d32', '#fffbe6', 512, 96, 56), side: THREE.DoubleSide }));
    sign.position.set(-11.5, 3.0, 5.6);
    sign.rotation.y = Math.PI;
    scene.add(sign);
    S.box(-14.2, 1.0, 5.6, 0.15, 2.4, 0.15, 0x6d4c41, { collide: false });
    S.box(-8.8, 1.0, 5.6, 0.15, 2.4, 0.15, 0x6d4c41, { collide: false });
  }
  {
    const pot = potMesh(0xc75b39, 0xba68c8);
    pot.position.set(-8.8, 1.0, 5.6);
    addProp('pot_taman', pot, 1.0);
  }
  pottedPlant(-14.2, 1.0, 5.6, 0.8, 0xc75b39);
  // paths
  floor(-12.5, 5.2, -10.5, 24, 0xe2d3b4, 0.012);
  floor(-12.5, 16, 8, 18, 0xe2d3b4, 0.012);
  floor(-15, 21.5, -10.5, 23.5, 0xe2d3b4, 0.013);
  // pond
  const P = { x0: -26, z0: 19, x1: -15, z1: 31 };
  rects.push({ x0: P.x0, z0: P.z0, x1: P.x1, z1: P.z1, c: '#4aa3df' });
  S.mm(P.x0, 0, P.z0, P.x1, 0.2, P.z0 + 0.4, C.stone, { top: 0xb0b0a8 });
  S.mm(P.x0, 0, P.z1 - 0.4, P.x1, 0.2, P.z1, C.stone, { top: 0xb0b0a8 });
  S.mm(P.x0, 0, P.z0, P.x0 + 0.4, 0.2, P.z1, C.stone, { top: 0xb0b0a8 });
  S.mm(P.x1 - 0.4, 0, P.z0, P.x1, 0.2, 24.3, C.stone, { top: 0xb0b0a8 });
  S.mm(P.x1 - 0.4, 0, 25.7, P.x1, 0.2, P.z1, C.stone, { top: 0xb0b0a8 });
  const waterMat = new THREE.MeshLambertMaterial({ color: C.water, transparent: true, opacity: 0.88 });
  const wm = new THREE.Mesh(new THREE.BoxGeometry(P.x1 - P.x0 - 0.8, 0.05, P.z1 - P.z0 - 0.8), waterMat);
  wm.position.set((P.x0 + P.x1) / 2, 0.03, (P.z0 + P.z1) / 2);
  scene.add(wm);
  floor(P.x0 + 0.4, P.z0 + 0.4, P.x1 - 0.4, P.z1 - 0.4, 0x2d6f9a, -0.02);
  water.push({ x0: P.x0 + 0.4, z0: P.z0 + 0.4, x1: P.x1 - 0.4, z1: P.z1 - 0.4 });
  anim.push((dt, t) => {
    waterMat.color.setHSL(0.56, 0.62, 0.57 + Math.sin(t * 0.8) * 0.02);
  });
  // lily pads & reeds
  for (const [x, z] of [
    [-24, 21],
    [-22.5, 28.5],
    [-17, 21],
    [-24.6, 26],
    [-20, 29.7],
  ]) {
    S.mm(x - 0.35, 0.04, z - 0.35, x + 0.35, 0.07, z + 0.35, 0x4caf50, { collide: false });
    S.mm(x - 0.08, 0.07, z - 0.08, x + 0.08, 0.14, z + 0.08, 0xf48fb1, { collide: false });
  }
  for (let i = 0; i < 8; i++) S.box(P.x0 + 0.2 + (i % 2) * 0.3, 0, P.z0 + 1 + i * 1.3, 0.08, 0.9 + (i % 3) * 0.2, 0.08, 0x558b2f, { collide: false });
  // dock
  S.mm(-19.2, 0, 24.3, -15, 0.3, 25.7, C.woodL, { top: 0xdcb87a });
  for (let x = -19; x < -15; x += 0.5) S.mm(x, 0.3, 24.3, x + 0.04, 0.305, 25.7, C.woodD, { collide: false });
  for (const [x, z] of [
    [-19.1, 24.35],
    [-19.1, 25.65],
  ])
    S.box(x, 0, z, 0.15, 0.7, 0.15, C.woodD, { cam: false });
  pts.dock = V(-18.45, 0.3, 25);
  pts.dockLook = V(-22, 0, 25);
  // fish shadows swimming in the pond
  for (let i = 0; i < 6; i++) {
    const f = new THREE.Mesh(boxGeo(0.35, 0.02, 0.14), new THREE.MeshBasicMaterial({ color: 0x1f4f70, transparent: true, opacity: 0.5 }));
    const cx = -20.5 + (Math.random() - 0.5) * 6, cz = 25 + (Math.random() - 0.5) * 7, r = 1 + Math.random() * 1.5, sp = 0.3 + Math.random() * 0.5, ph = Math.random() * 6;
    f.userData = { cx, cz, r, sp, ph };
    scene.add(f);
    fishShadows.push(f);
  }
  anim.push((dt, t) => {
    for (const f of fishShadows) {
      const u = f.userData;
      const a = t * u.sp + u.ph;
      f.position.set(u.cx + Math.cos(a) * u.r, 0.035, u.cz + Math.sin(a) * u.r * 0.7);
      f.rotation.y = -a;
    }
  });
  // Lisa's rock
  S.mm(-13.9, 0, 21.9, -12.5, 0.5, 23.1, 0x9e9e9e, { top: 0xb5b5ad });
  S.mm(-13.7, 0.5, 22.1, -12.8, 0.6, 22.9, 0xa8a8a0, { collide: false });
  pts.lisa = V(-13.25, 0.6, 22.5);
  // flower bed (dig)
  S.mm(-6, 0, 9, -1, 0.22, 12, 0x6d4c41, { top: 0x7b5436 });
  S.mm(-6.1, 0, 8.9, -0.9, 0.3, 9.05, 0xbcaaa4, { collide: false });
  S.mm(-6.1, 0, 11.95, -0.9, 0.3, 12.1, 0xbcaaa4, { collide: false });
  {
    const g = new THREE.Group();
    const cols = [0xff5252, 0xffeb3b, 0xff80ab, 0xffffff, 0xba68c8, 0xff9800];
    const flowers: THREE.Object3D[] = [];
    for (let i = 0; i < 12; i++) {
      const f = new THREE.Group();
      f.add(mbox(0.05, 0.4, 0.05, 0x388e3c, 0, 0.2, 0));
      f.add(mbox(0.18, 0.12, 0.18, cols[i % cols.length], 0, 0.44, 0));
      f.add(mbox(0.07, 0.13, 0.07, 0xfff176, 0, 0.45, 0));
      f.add(mbox(0.16, 0.04, 0.06, 0x43a047, 0.06, 0.18, 0));
      f.position.set(-5.4 + (i % 6) * 0.85, 0.22, 9.7 + Math.floor(i / 6) * 1.5);
      g.add(f);
      flowers.push(f);
    }
    scene.add(g);
    const mound = mbox(1.2, 0.3, 0.9, 0x5d4037, -3.5, 0.3, 10.5);
    mound.visible = false;
    scene.add(mound);
    props['bunga'] = { obj: g, home: g.position.clone(), homeRot: g.rotation.clone(), surface: 0.22, data: { flowers, mound } };
  }
  pts.flowerBed = V(-3.5, 0.22, 10.5);
  // benches + pigeons
  bench(-5, 18.8, true);
  bench(3, 14.8, true);
  pts.pigeonPark = V(-4.5, 0, 20.5);
  // playground: slide (steps + stepped slope)
  {
    const x0 = 2, x1 = 3.2;
    for (let i = 0; i < 4; i++) S.mm(x0, 0, 20 + i * 0.3, x1, 0.4 * (i + 1), 20.3 + i * 0.3, 0xef5350, { top: 0xff7961 });
    S.mm(x0, 0, 21.2, x1, 1.6, 22.4, 0xffca28, { top: 0xffd95a });
    S.box(x0 - 0.05, 1.6, 21.8, 0.1, 0.6, 1.2, 0x1e88e5, { collide: false });
    S.box(x1 + 0.05, 1.6, 21.8, 0.1, 0.6, 1.2, 0x1e88e5, { collide: false });
    for (let i = 0; i < 5; i++) S.mm(x0, 0, 22.4 + i * 0.8, x1, 1.6 - 0.32 * (i + 1), 23.2 + i * 0.8, 0x42a5f5, { visible: false });
    S.rot((x0 + x1) / 2, 0.85, 24.4, 1.2, 0.12, 4.3, 0, 0x42a5f5, 0.36);
    S.rot(x0 - 0.05, 1.0, 24.4, 0.1, 0.25, 4.3, 0, 0x1e88e5, 0.36);
    S.rot(x1 + 0.05, 1.0, 24.4, 0.1, 0.25, 4.3, 0, 0x1e88e5, 0.36);
  }
  // swings
  {
    S.box(6.4, 0, 20, 0.15, 2.5, 0.15, 0x6d4c41, { cam: false });
    S.box(9.6, 0, 20, 0.15, 2.5, 0.15, 0x6d4c41, { cam: false });
    S.box(8, 2.45, 20, 3.4, 0.15, 0.15, 0x6d4c41, { collide: false });
    const seats: THREE.Group[] = [];
    for (const x of [7.2, 8.8]) {
      const s = new THREE.Group();
      s.position.set(x, 2.45, 20);
      s.add(mbox(0.03, 1.9, 0.03, 0x9e9e9e, -0.25, -0.95, 0));
      s.add(mbox(0.03, 1.9, 0.03, 0x9e9e9e, 0.25, -0.95, 0));
      s.add(mbox(0.6, 0.06, 0.3, 0xff7043, 0, -1.9, 0));
      scene.add(s);
      seats.push(s);
    }
    anim.push((dt, t) => {
      seats[0].rotation.x = Math.sin(t * 1.6) * 0.25;
      seats[1].rotation.x = Math.sin(t * 1.6 + 2) * 0.15;
    });
  }
  // sandbox
  S.mm(5, 0, 24, 9.5, 0.2, 28.5, C.woodD, { collide: false });
  floor(5.15, 24.15, 9.35, 28.35, 0xf3dfa2, 0.21);
  S.mm(5, 0, 24, 9.5, 0.22, 28.5, 0, { visible: false });
  // field + goals
  floor(-11, 30, 9, 37.5, 0x94d670, 0.014);
  floor(-1.05, 30, -0.95, 37.5, 0xffffff, 0.02);
  for (const gx of [-11, 9]) {
    S.box(gx, 0, 31.8, 0.12, 1.6, 0.12, 0xffffff, { cam: false });
    S.box(gx, 0, 35.7, 0.12, 1.6, 0.12, 0xffffff, { cam: false });
    S.box(gx, 1.55, 33.75, 0.12, 0.12, 4.0, 0xffffff, { collide: false });
  }
  pts.kidA = V(-5, 0, 33.8);
  pts.kidB = V(4, 0, 33.8);
  // trees & lamps
  tree(-27, 8.5, 1, 0);
  tree(-26, 15, 0.9, 2);
  tree(-19, 35.5, 1.1, 0);
  tree(-26.5, 35.5, 0.9, 1);
  tree(-8, 26.5, 0.85, 2);
  tree(9.5, 9.5, 1, 1);
  tree(10, 29.5, 0.8, 0);
  tree(-1.5, 7.5, 0.7, 2);
  lamp(-12.8, 14);
  lamp(-2, 16.6);
  lamp(-14, 29);
  zones.push({ id: 'taman', x0: -30, z0: 5.2, x1: 12, z1: 39 });
  // lane between park and market
  tree(15, 10, 0.9, 0);
  tree(15, 20, 1, 2);
  tree(15, 30, 0.9, 1);

  // ================= PASAR IKAN =================
  rects.push({ x0: 18, z0: 5.5, x1: 62, z1: 39, c: '#d6d0c4' });
  floor(18.3, 5.8, 62, 39, 0xcfc9bd, 0.01);
  for (let x = 20; x < 62; x += 3) floor(x, 5.8, x + 0.05, 39, 0xbdb6a8, 0.013);
  const PW2 = 0xe0a96d;
  wallX(18, 62, 5.65, 3.0, PW2, [[33, 39]], 0.3);
  S.mm(17.8, 0, 5.5, 18.3, 3.0, 39, PW2);
  S.mm(61.8, 0, 5.5, 62.2, 3.0, 39, PW2);
  S.mm(18, 0, 38.7, 62, 3.0, 39, PW2);
  for (let x = 19; x < 62; x += 6) if (x < 32 || x > 40) S.mm(x, 1.0, 5.45, x + 2.4, 2.2, 5.5, 0x9fd3ee, { collide: false });
  // arch + sign
  S.box(32.7, 0, 5.65, 0.6, 4.2, 0.6, 0x8d6e63);
  S.box(39.3, 0, 5.65, 0.6, 4.2, 0.6, 0x8d6e63);
  S.box(36, 3.6, 5.65, 7.2, 0.8, 0.4, 0x5d4037, { collide: false });
  {
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6.2, 0.7), new THREE.MeshBasicMaterial({ map: signTex(['PASAR IKAN'], '#1565c0', '#fffbe6', 512, 64, 50) }));
    sign.position.set(36, 4.0, 5.43);
    sign.rotation.y = Math.PI;
    scene.add(sign);
  }
  {
    // rolling gate (closed until unlocked)
    const g = new THREE.Group();
    for (let i = 0; i < 14; i++) g.add(mbox(6.0, 0.18, 0.08, i % 2 ? 0x8f969e : 0xa3aab2, 36, 0.12 + i * 0.2, 5.65));
    g.add(mbox(0.4, 0.25, 0.1, 0xf5c542, 36, 0.5, 5.55));
    scene.add(g);
    const cols: AABB[] = [];
    S.mm(33, 0, 5.4, 39, 3.0, 5.9, 0, { visible: false, out: cols, cam: false });
    gates.pasar = { cols, obj: g, open: false };
  }
  pts.pasarGate = V(36, 0.15, 4.4);
  pts.pasarIn = V(36, 0, 8.5);
  const stall = (x0: number, z0: number, x1: number, z1: number, canopy: number, goods: 'fish' | 'veg' | 'misc') => {
    S.mm(x0, 0, z0, x1, 1.0, z1, 0x8d6e63, { top: 0xa1887f });
    S.mm(x0 + 0.05, 0.98, z0 + 0.05, x1 - 0.05, 1.02, z1 - 0.05, goods === 'fish' ? 0xe0f2f1 : 0xd7ccc8, { collide: false });
    for (const [x, z] of [
      [x0 - 0.3, z0 - 0.4],
      [x1 + 0.3, z0 - 0.4],
      [x0 - 0.3, z1 + 0.4],
      [x1 + 0.3, z1 + 0.4],
    ])
      S.box(x, 0, z, 0.1, 2.95, 0.1, 0x9e9e9e, { cam: false });
    S.mm(x0 - 0.5, 2.9, z0 - 0.6, x1 + 0.5, 3.0, z1 + 0.6, canopy, { cam: false });
    for (let x = x0 - 0.5; x < x1 + 0.5; x += 1.0) S.mm(x, 2.75, z0 - 0.62, x + 0.5, 2.9, z0 - 0.58, 0xffffff, { collide: false });
    if (goods === 'fish')
      for (let i = 0; i < Math.floor((x1 - x0) / 0.5); i++) {
        S.rot(x0 + 0.3 + i * 0.5, 1.07, z0 + 0.35 + (i % 2) * 0.5, 0.42, 0.1, 0.16, 0.4 * (i % 3), [0x90a4ae, 0xb0bec5, 0xa1887f][i % 3]);
      }
    if (goods === 'veg')
      for (let i = 0; i < Math.floor((x1 - x0) / 0.45); i++) S.box(x0 + 0.3 + i * 0.45, 1.02, z0 + 0.4 + (i % 2) * 0.5, 0.3, 0.22, 0.3, [0x66bb6a, 0xffa726, 0x8bc34a, 0xab47bc][i % 4], { collide: false });
    if (goods === 'misc')
      for (let i = 0; i < Math.floor((x1 - x0) / 0.6); i++) S.box(x0 + 0.35 + i * 0.6, 1.02, (z0 + z1) / 2, 0.45, 0.35, 0.6, [0xef5350, 0x42a5f5, 0xffee58][i % 3], { collide: false });
  };
  stall(24, 12, 28, 13.4, 0x1e88e5, 'fish');
  stall(30, 12, 34, 13.4, 0x1e88e5, 'fish');
  stall(24, 20, 28, 21.4, 0xfb8c00, 'fish');
  stall(30, 20, 34, 21.4, 0xfb8c00, 'fish');
  stall(42, 14, 48, 15.4, 0x43a047, 'veg');
  stall(42, 24, 48, 25.4, 0xd81b60, 'misc');
  stall(51, 18, 57, 19.4, 0x8e24aa, 'fish');
  // ice boxes, sacks, crates
  for (const [x, z] of [
    [22.8, 12.4],
    [35.2, 12.9],
    [22.8, 20.5],
    [50, 18.6],
  ])
    S.box(x, 0, z, 0.9, 0.6, 0.6, 0xf5f5f5, { top: 0xe0e0e0 });
  for (const [x, z] of [
    [41, 16.3],
    [49, 25],
    [55, 30],
    [57, 30],
  ])
    crate(S, x, z, 0.9, 0.9, 0.7);
  for (const [x, z] of [
    [58, 10],
    [59.2, 10.3],
    [44, 32],
  ])
    S.box(x, 0, z, 0.8, 0.7, 0.6, 0xd7c29e, { top: 0xe3d2b0 });
  {
    const f = new THREE.Group();
    f.add(mbox(0.5, 0.03, 0.34, 0xe0e0e0, 0, 0.015, 0));
    const fish = fishMesh(0x7fa3b8, 1.1);
    fish.position.y = 0.07;
    f.add(fish);
    f.position.set(31.6, 1.02, 12.6);
    addProp('ikan_pasar', f, 1.02, { fish });
  }
  {
    const e = new THREE.Group();
    e.add(mbox(0.55, 0.55, 0.55, 0x1e88e5, 0, 0.275, 0));
    e.add(mbox(0.47, 0.02, 0.47, 0x81d4fa, 0, 0.55, 0));
    e.add(mbox(0.6, 0.05, 0.05, 0x0d47a1, 0, 0.62, 0));
    e.position.set(35.6, 0, 20.6);
    addProp('ember', e, 0);
  }
  {
    const b = new THREE.Group();
    b.add(mbox(0.7, 0.35, 0.5, 0xc49a5a, 0, 0.175, 0));
    const toms: THREE.Mesh[] = [];
    for (let i = 0; i < 8; i++) {
      const t = mbox(0.16, 0.15, 0.16, 0xe53935, -0.2 + (i % 4) * 0.13, 0.4, -0.08 + Math.floor(i / 4) * 0.16);
      b.add(t);
      toms.push(t);
    }
    b.position.set(46.8, 1.0, 14.6);
    addProp('tomat', b, 1.0, { toms });
  }
  pts.ujangA = V(29, 0, 10.2);
  pts.ujangB = V(36.2, 0, 16.6);
  pts.ujangC = V(29, 0, 17.2);
  pts.ujangD = V(22.6, 0, 16.6);
  pts.tini = V(45, 0, 16.5);
  zones.push({ id: 'pasar', x0: 18, z0: 5.5, x1: 62, z1: 39 });

  // West of park
  rects.push({ x0: -46, z0: 5, x1: -30, z1: 39, c: '#a8d88a' });
  tree(-40, 12, 1.1, 0);
  tree(-35, 22, 1, 1);
  tree(-42, 32, 1, 2);
  tree(-34, 34, 0.9, 0);
  S.mm(-44, 0, 16, -38, 0.6, 18, 0x8d6e63, { top: 0xa1887f });
  palm(-37, 9);

  // Build
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const mesh = S.build(mat);
  scene.add(mesh);
  const phys = new Physics(S.colliders);
  return { mesh, phys, pts, props, gates, water, zones, rects, dogYard, anim, fishShadows };
}

// ---------- prop mesh builders ----------
export function fishMesh(color: number, s = 1) {
  const g = new THREE.Group();
  g.add(mbox(0.34 * s, 0.1 * s, 0.14 * s, color, 0, 0, 0));
  g.add(mbox(0.12 * s, 0.08 * s, 0.1 * s, color, 0.2 * s, 0, 0));
  const tail = mbox(0.08 * s, 0.14 * s, 0.03 * s, color, -0.21 * s, 0, 0);
  g.add(tail);
  g.add(mbox(0.03 * s, 0.03 * s, 0.03 * s, 0x111111, 0.22 * s, 0.03 * s, 0.05 * s));
  g.add(mbox(0.03 * s, 0.03 * s, 0.03 * s, 0x111111, 0.22 * s, 0.03 * s, -0.05 * s));
  return g;
}

export function potMesh(potColor: number, flower: number) {
  const g = new THREE.Group();
  g.add(mbox(0.34, 0.3, 0.34, potColor, 0, 0.15, 0));
  g.add(mbox(0.4, 0.07, 0.4, potColor - 0x101010, 0, 0.3, 0));
  g.add(mbox(0.3, 0.03, 0.3, 0x5d4037, 0, 0.33, 0));
  g.add(mbox(0.05, 0.3, 0.05, 0x388e3c, 0, 0.47, 0));
  g.add(mbox(0.26, 0.1, 0.1, 0x43a047, 0, 0.42, 0));
  g.add(mbox(0.2, 0.16, 0.2, flower, 0, 0.66, 0));
  g.add(mbox(0.08, 0.17, 0.08, 0xfff176, 0, 0.67, 0));
  return g;
}

export function crateMesh(w: number, h: number, d: number) {
  const g = new THREE.Group();
  g.add(mbox(w, h, d, 0xc49a5a));
  g.add(mbox(w + 0.02, 0.08, d + 0.02, 0x9c7040, 0, h / 2 - 0.1, 0));
  g.add(mbox(w + 0.02, 0.08, d + 0.02, 0x9c7040, 0, -h / 2 + 0.1, 0));
  return g;
}

function crate(S: StaticBuilder, x: number, z: number, w: number, d: number, h: number) {
  S.box(x, 0, z, w, h, d, 0xc49a5a, { top: 0xd4aa6a });
  S.box(x, h - 0.16, z, w + 0.02, 0.08, d + 0.02, 0x9c7040, { collide: false });
  S.box(x, 0.08, z, w + 0.02, 0.08, d + 0.02, 0x9c7040, { collide: false });
}

void lam;
