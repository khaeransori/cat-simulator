// Vehicle & road-works models ("Kendaraan & proyek jalan").
// Every vehicle is built from boxes merged into ONE vertex-coloured mesh (+ lamps, + glass),
// with real-world proportions (1 unit ~ 1 m). Drivers and riders are seated Kenney Blocky
// people (full adult size, baked + cached), so a car costs ~4 draw calls and a bike ~3-4.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pair } from '../i18n';
import { buildBlocky, poseBlocky, helmetOn, SEATED, type Outfit } from './blocky';

const P = (id: string, en: string): Pair => ({ id, en });

/** Shared materials: body parts use vertex colours, lamps are unlit (they "glow"). */
export const VMAT = {
  body: new THREE.MeshLambertMaterial({ vertexColors: true }),
  lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
  /** see-through windows: the drivers inside stay visible */
  glass: new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.38, depthWrite: false }),
};

/** Collects coloured boxes / cylinders and merges them into one geometry. */
export class Kit {
  parts: THREE.BufferGeometry[] = [];
  private col = new THREE.Color();
  box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    return this.add(new THREE.BoxGeometry(w, h, d), color, x, y, z, ry, rx, rz);
  }
  /** cylinder lying along the z axis (a wheel), or upright when upright = true */
  cyl(r: number, len: number, color: number, x: number, y: number, z: number, upright = false, seg = 12) {
    const g = new THREE.CylinderGeometry(r, r, len, seg);
    if (!upright) g.rotateX(Math.PI / 2);
    return this.add(g, color, x, y, z);
  }
  add(g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, ry = 0, rx = 0, rz = 0) {
    if (rx) g.rotateX(rx);
    if (rz) g.rotateZ(rz);
    if (ry) g.rotateY(ry);
    g.translate(x, y, z);
    if (g.index) g = g.toNonIndexed();
    g.deleteAttribute('uv');
    this.col.setHex(color);
    const n = g.getAttribute('position').count;
    const c = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) c.set([this.col.r, this.col.g, this.col.b], i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(c, 3));
    this.parts.push(g);
    return this;
  }
  mesh(mat: THREE.Material = VMAT.body) {
    const m = new THREE.Mesh(this.parts.length ? mergeGeometries(this.parts) : new THREE.BufferGeometry(), mat);
    for (const p of this.parts) p.dispose();
    this.parts = [];
    return m;
  }
}

// ---------------- people on board (Kenney Blocky riders) ----------------
// Global human scale: an adult Blocky is 2.73 raw units * 0.62 = ~1.7 m, a kid * 0.5.
// Vehicles are built at real-world metres (1 unit ~ 1 m) and are NEVER scaled, so
// drivers and riders keep the same size as the people walking around.
export const ADULT = 0.62;
export const KID = 0.5;
/** raw rig: hip pivot y = 1.0, thigh underside when seated ~0.8 => seat-to-root offset */
const SEAT_RAW = 0.8;

const RIDER_LOOKS: Outfit[] = [
  // bapak kaos + celana panjang
  { skin: 0xc68e5f, top: 'kaos', topC: 0x1565c0, long: false, bottom: 'celana', botC: 0x3e2723, head: 'pendek', hair: 0x1b1410, shoes: 0x222222, mustache: true },
  // mas kaos bola
  { skin: 0xb87a4b, top: 'kaosBola', topC: 0xe53935, topC2: 0xffffff, long: false, bottom: 'celana', botC: 0x263238, head: 'pendek', hair: 0x1b1410, shoes: 0xffffff },
  // ibu gamis + bergo (kerudung => long sleeves + long bottom)
  { skin: 0xd9a877, top: 'gamis', topC: 0x8e5aa8, long: true, bottom: 'gamis', botC: 0x8e5aa8, head: 'bergo', headC: 0x4a2a5e, shoes: 0x5d4037 },
  // ibu kantor: blazer + pashmina + celana panjang
  { skin: 0xe0ac7e, top: 'blazer', topC: 0x37474f, topC2: 0xf5f5f5, long: true, bottom: 'celana', botC: 0x263238, head: 'pashmina', headC: 0xd81b60, shoes: 0x3e2723 },
  // bapak koko + celana + peci
  { skin: 0xa86b3d, top: 'koko', topC: 0xf5f5f5, topC2: 0xd7ccc8, long: true, bottom: 'celana', botC: 0x37474f, head: 'peci', hair: 0x1b1410, shoes: 0x4e342e },
  // mbak kaos panjang + kerudung + rok panjang (kain)
  { skin: 0xd9a877, top: 'kaos', topC: 0x00897b, long: true, bottom: 'kain', botC: 0x5d4037, botPat: 'batik', botC2: 0xd7b56d, head: 'pashmina', headC: 0x26a69a, shoes: 0x5d4037 },
  // pemuda kemeja panjang
  { skin: 0xc68e5f, top: 'kaos', topC: 0xff7043, long: true, bottom: 'celana', botC: 0x1a237e, head: 'topi', headC: 0x212121, hair: 0x1b1410, shoes: 0x212121 },
];
const OJOL: Outfit = { skin: 0xb87a4b, top: 'kaos', topC: 0x2e7d32, topC2: 0xffffff, long: true, bottom: 'celana', botC: 0x263238, head: 'pendek', hair: 0x1b1410, shoes: 0x222222 };
const SOPIR_TAKSI: Outfit = { skin: 0xc68e5f, top: 'seragam', topC: 0x1e88e5, topC2: 0xffffff, long: true, bottom: 'celana', botC: 0x263238, head: 'pendek', hair: 0x1b1410, shoes: 0x222222, mustache: true };
const SOPIR_ANGKOT: Outfit = { skin: 0xa86b3d, top: 'kaos', topC: 0xfdd835, long: false, bottom: 'celana', botC: 0x37474f, head: 'topi', headC: 0x1e88e5, hair: 0x1b1410, shoes: 0x222222, towel: true };
const ANAK: Outfit = { kid: true, skin: 0xe0ac7e, top: 'kaos', topC: 0xffb300, long: false, bottom: 'pendek', botC: 0x1565c0, head: 'pendek', hair: 0x2a1c14, shoes: 0xffffff };
const ANAK_KERUDUNG: Outfit = { kid: true, skin: 0xd9a877, top: 'tunik', topC: 0xec407a, long: true, bottom: 'celana', botC: 0x5c6bc0, head: 'kerudungAnak', headC: 0xffffff, shoes: 0xffffff };
export const OPERATOR: Outfit = { skin: 0xb87a4b, top: 'rompi', topC: 0xff6f00, topC2: 0xe0e0e0, long: true, bottom: 'celana', botC: 0x37474f, head: 'pendek', hair: 0x1b1410, shoes: 0x5d4037 };
export const RIDER_OUTFITS = { looks: RIDER_LOOKS, OJOL, SOPIR_TAKSI, SOPIR_ANGKOT, ANAK, ANAK_KERUDUNG, OPERATOR };

type PoseName = 'drive' | 'car' | 'motor' | 'sport' | 'samping' | 'bench' | 'kidMotor';
const POSES: Record<PoseName, Parameters<typeof poseBlocky>[1]> = {
  drive: SEATED,
  // car seats recline a little (real drivers do), which keeps the big Blocky head under the roof
  car: { ...SEATED, lean: -0.42, armL: -1.12, armR: -1.12, legL: -1.45, legR: -1.45 },
  sport: { legL: -1.05, legR: -1.05, spread: 0.3, armL: -1.35, armR: -1.35, armIn: 0.12, lean: 0.35 },
  motor: { legL: -1.15, legR: -1.15, spread: 0.3, armL: -1.05, armR: -1.05, armIn: 0.12, lean: 0.06 },
  // menyamping: both legs together to one side, one hand on the rider's waist, one on the rack
  samping: { legL: -1.35, legR: -1.35, spread: 0.04, armL: -0.55, armR: -0.25, armIn: 0.12, lean: -0.03 },
  bench: { legL: -1.3, legR: -1.3, spread: 0.12, armL: -0.25, armR: -0.25, armIn: -0.05, lean: 0.0 },
  kidMotor: { legL: -1.2, legR: -1.2, spread: 0.35, armL: -1.2, armR: -1.2, armIn: 0.3, lean: 0.12 },
};

interface Baked { skinGeo: THREE.BufferGeometry; skinMat: THREE.Material; extras: THREE.BufferGeometry | null; pattern: { geo: THREE.BufferGeometry; mat: THREE.Material }[]; headTop: number }
const BAKED = new Map<string, Baked>();
const tmpM = new THREE.Matrix4();
const tmpC = new THREE.Color();

/**
 * A seated Blocky person baked into (1) one skin-textured mesh and (2) vertex-coloured
 * extras (hijab, helmet, skirt...). Cached per outfit + pose + helmet, so spawning
 * traffic creates no new textures. Origin = middle of the seat surface, facing +z.
 */
function bake(o: Outfit, pose: PoseName, helmet: number | null): Baked {
  const key = JSON.stringify([o, pose, helmet]);
  const hit = BAKED.get(key);
  if (hit) return hit;
  const n = buildBlocky(o, true);
  poseBlocky(n, POSES[pose]);
  if (helmet !== null) helmetOn(n, helmet);
  const s = o.kid ? KID : ADULT;
  n.root.scale.setScalar(s);
  n.root.position.y = -SEAT_RAW * s;
  n.root.updateMatrixWorld(true);
  const skin: THREE.BufferGeometry[] = [];
  const extras: THREE.BufferGeometry[] = [];
  const pattern: Baked['pattern'] = [];
  let skinMat: THREE.Material | null = null;
  n.root.traverse((m) => {
    const mesh = m as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mat = mesh.material as THREE.MeshLambertMaterial;
    tmpM.copy(mesh.matrixWorld);
    let g = mesh.geometry.clone().applyMatrix4(tmpM);
    if (mat.map === n.skin) {
      skinMat = mat;
      skin.push(g);
    } else if (mat.map) {
      pattern.push({ geo: g, mat });
    } else {
      g.computeBoundingBox();
      // the seated long-garment "lap" block hangs under the hips: it would poke through car floors
      if (g.boundingBox!.max.y < -0.02) {
        g.dispose();
        mat.dispose();
        return;
      }
      if (g.index) g = g.toNonIndexed();
      for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
      tmpC.copy(mat.color);
      const cnt = g.getAttribute('position').count;
      const c = new Float32Array(cnt * 3);
      for (let i = 0; i < cnt; i++) c.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
      g.setAttribute('color', new THREE.BufferAttribute(c, 3));
      extras.push(g);
      mat.dispose();
    }
    if (mat.map !== n.skin) mesh.geometry.dispose();
  });
  const skinGeo = mergeGeometries(skin);
  for (const g of skin) g.dispose();
  const ex = extras.length ? mergeGeometries(extras) : null;
  for (const g of extras) g.dispose();
  skinGeo.computeBoundingBox();
  let headTop = skinGeo.boundingBox!.max.y;
  if (ex) {
    ex.computeBoundingBox();
    headTop = Math.max(headTop, ex.boundingBox!.max.y);
  }
  const b: Baked = { skinGeo, skinMat: skinMat!, extras: ex, pattern, headTop };
  BAKED.set(key, b);
  return b;
}

const QY = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
/**
 * Seat a person in a vehicle: skin mesh goes under `parent`, extras are merged into the
 * vehicle's body kit. (x, seatY, z) = middle of the seat surface, ry = facing (0 = +z, PI/2 = +x).
 */
function seat(k: Kit, parent: THREE.Object3D, o: Outfit, pose: PoseName, helmet: number | null, x: number, seatY: number, z: number, ry: number) {
  const b = bake(o, pose, helmet);
  QY.setFromAxisAngle(UP, ry);
  tmpM.compose(new THREE.Vector3(x, seatY, z), QY, new THREE.Vector3(1, 1, 1));
  const m = new THREE.Mesh(b.skinGeo, b.skinMat);
  m.matrixAutoUpdate = false;
  m.matrix.copy(tmpM);
  m.userData.shared = true;
  parent.add(m);
  for (const p of b.pattern) {
    const pm = new THREE.Mesh(p.geo, p.mat);
    pm.matrixAutoUpdate = false;
    pm.matrix.copy(tmpM);
    pm.userData.shared = true;
    parent.add(pm);
  }
  if (b.extras) k.parts.push(b.extras.clone().applyMatrix4(tmpM));
  return seatY + b.headTop;
}
/** height of the head top above the seat surface for this outfit (drivers fit cabins with it) */
export function headAboveSeat(o: Outfit, pose: PoseName = 'drive') {
  return bake(o, pose, null).headTop;
}

// ---------------- random vehicle specs ----------------
export type Engine = 'bensin' | 'diesel' | 'listrik' | '2tak' | '4tak';
export type VKind = 'car' | 'motor';

export interface VTypeDef {
  id: string;
  kind: VKind;
  name: Pair;
  len: number; // along x (driving direction), metres
  wid: number;
  h: number;
  engines: Engine[];
  speed: [number, number]; // m/s cruising
  colors?: number[]; // fixed palette (taxi, angkot)
}

// real-world sizes (lebar x tinggi x panjang): sedan 1.78x1.48x4.6, angkot 1.66x1.95x4.1,
// taksi 1.75x1.5x4.45, SUV/MPV 1.78x1.75x4.5, pickup 1.7x1.85x4.3, motor ~1.9-2.0 long
export const VTYPES: VTypeDef[] = [
  { id: 'sedan', kind: 'car', name: P('Sedan', 'Sedan'), len: 4.6, wid: 1.78, h: 1.48, engines: ['bensin', 'bensin', 'listrik'], speed: [6.5, 8.5] },
  { id: 'citycar', kind: 'car', name: P('Mobil Mungil', 'City Car'), len: 3.65, wid: 1.62, h: 1.52, engines: ['bensin', 'listrik', 'listrik'], speed: [6, 8] },
  { id: 'mpv', kind: 'car', name: P('Mobil Keluarga', 'Family Van'), len: 4.5, wid: 1.78, h: 1.75, engines: ['bensin', 'diesel', 'listrik'], speed: [6, 7.5] },
  { id: 'pickup', kind: 'car', name: P('Mobil Bak', 'Pickup'), len: 4.3, wid: 1.7, h: 1.85, engines: ['diesel', 'diesel', 'bensin'], speed: [5.5, 7] },
  { id: 'angkot', kind: 'car', name: P('Angkot', 'Minibus'), len: 4.1, wid: 1.66, h: 1.95, engines: ['bensin', 'diesel'], speed: [5.5, 7], colors: [0x2e9e4f, 0x1e88e5, 0xf9a825, 0xe53935] },
  { id: 'taksi', kind: 'car', name: P('Taksi', 'Taxi'), len: 4.45, wid: 1.75, h: 1.5, engines: ['bensin', 'listrik'], speed: [6.5, 8], colors: [0x3f8fd6] },
  { id: 'bebek', kind: 'motor', name: P('Motor Bebek', 'Moped'), len: 1.92, wid: 0.7, h: 1.75, engines: ['4tak', '4tak', '2tak'], speed: [6.5, 9] },
  { id: 'matic', kind: 'motor', name: P('Motor Matic', 'Scooter'), len: 1.88, wid: 0.7, h: 1.75, engines: ['4tak', 'listrik'], speed: [6, 8.5] },
  { id: 'sport', kind: 'motor', name: P('Motor Sport', 'Sport Bike'), len: 2.0, wid: 0.74, h: 1.7, engines: ['4tak', '2tak'], speed: [7.5, 10] },
  { id: 'ojol', kind: 'motor', name: P('Ojek Online', 'Ride-share Bike'), len: 1.88, wid: 0.7, h: 1.75, engines: ['4tak', 'listrik'], speed: [6.5, 9], colors: [0x1b5e20, 0x2e7d32] },
];
export const VTYPE: Record<string, VTypeDef> = Object.fromEntries(VTYPES.map((t) => [t.id, t]));

export const ENGINE_NAME: Record<Engine, Pair> = {
  bensin: P('Mesin bensin', 'Petrol engine'),
  diesel: P('Mesin diesel', 'Diesel engine'),
  listrik: P('Listrik', 'Electric'),
  '2tak': P('Mesin 2-tak', '2-stroke engine'),
  '4tak': P('Mesin 4-tak', '4-stroke engine'),
};

/** Bright, toy-like body colours (no black: it reads badly at night). */
export const PAINT = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047, 0xfb8c00, 0x8e24aa, 0xf5f5f5, 0x90a4ae, 0x00acc1, 0xd81b60, 0x6d4c41, 0x3949ab, 0xc0ca33, 0xff8a80];
const HELMETS = [0xe53935, 0x1e88e5, 0xfdd835, 0xffffff, 0x212121, 0xec407a, 0x43a047, 0xff9800];
const SHIRTS = [0x1976d2, 0xe53935, 0x43a047, 0xfdd835, 0x8e24aa, 0xff7043, 0x546e7a, 0xf5f5f5, 0x00897b];
const SKINS = [0xc68e5f, 0xb87a4b, 0xd9a877, 0xe0ac7e, 0xa86b3d];

export interface Person {
  shirt: number;
  helmet: number;
  skin: number;
  /** index into the rider looks (outfit); -1 = a child */
  look?: number;
}
export interface VSpec {
  type: string;
  kind: VKind;
  color: number;
  engine: Engine;
  speed: number;
  /** motorbikes: rider shirt/helmet/look, maybe a passenger; cars: driver */
  rider: Person;
  passenger: Person | null;
  cargo: number; // pickup cargo kind (0..2)
}

const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length) % a.length];

/** A random vehicle: type, paint, engine, driver... (kind forces car / motor). */
export function randomSpec(r: () => number = Math.random, kind?: VKind): VSpec {
  const pool = kind ? VTYPES.filter((t) => t.kind === kind) : VTYPES;
  const t = pick(pool, r);
  const person = (): Person => ({ shirt: pick(SHIRTS, r), helmet: pick(HELMETS, r), skin: pick(SKINS, r), look: Math.floor(r() * RIDER_LOOKS.length) });
  const rider = person();
  if (t.id === 'ojol') rider.helmet = rider.shirt = 0x2e7d32;
  let passenger: Person | null = null;
  if (t.kind === 'motor' && t.id !== 'sport' && r() < 0.35) {
    passenger = person();
    if (r() < 0.25) passenger.look = -1; // a child on the back
  } else if (t.id === 'angkot' && r() < 0.6) passenger = person();
  return {
    type: t.id,
    kind: t.kind,
    color: pick(t.colors || PAINT, r),
    engine: pick(t.engines, r),
    speed: t.speed[0] + r() * (t.speed[1] - t.speed[0]),
    rider,
    passenger,
    cargo: Math.floor(r() * 3),
  };
}

/** outfit for a spec person (keeps the rolled skin tone; the shirt tints casual tops) */
function outfitOf(p: Person, role: 'rider' | 'passenger' | 'ojol' | 'taksi' | 'angkot'): Outfit {
  if (role === 'ojol') return { ...OJOL, skin: p.skin };
  if (role === 'taksi') return { ...SOPIR_TAKSI, skin: p.skin };
  if (role === 'angkot') return { ...SOPIR_ANGKOT, skin: p.skin };
  if (p.look === -1) return { ...(p.skin % 2 ? ANAK : ANAK_KERUDUNG), skin: p.skin };
  const base = RIDER_LOOKS[((p.look ?? 0) % RIDER_LOOKS.length + RIDER_LOOKS.length) % RIDER_LOOKS.length];
  const o: Outfit = { ...base, skin: p.skin };
  if (o.top === 'kaos') o.topC = p.shirt;
  return o;
}

const GLASS = 0x9fd3f0;
const TYRE = 0x262626;
const RIM = 0xb0bec5;
const DARK = 0x37474f;
const INSIDE = 0x2b2e33;
const HEAD = 0xfff4c8;
const TAIL = 0xff3b30;

/** A standable/solid column of a vehicle, in local space (x forward, z left/right), from the road up to y. */
export interface Top {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  y: number;
}

export interface VehicleModel {
  root: THREE.Group;
  /** collision columns (the cat stands on them or is pushed out of them) */
  tops: Top[];
  solidH: number;
  body: THREE.Mesh;
  lamps: THREE.Mesh;
  /** see-through windows (cars), null for motorbikes */
  glass: THREE.Mesh | null;
  /** rain ponchos on motorbike riders (toggled by the weather) */
  poncho: THREE.Mesh | null;
  /** front-local x of the exhaust pipe (smoke puffs), or null for electric */
  exhaust: THREE.Vector3 | null;
  /** debug/test: head tops of the people on board (local y) and the roof underside */
  fit?: { heads: number[]; roofIn: number };
}

const shade = (c: number, k: number) => {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};

/** side profile prism (points in x/y) extruded across the width w, centred on z = 0 */
function prism(pts: [number, number][], w: number) {
  const sh = new THREE.Shape();
  sh.moveTo(pts[0][0], pts[0][1]);
  for (const p of pts.slice(1)) sh.lineTo(p[0], p[1]);
  const g = new THREE.ExtrudeGeometry(sh, { depth: w, bevelEnabled: false });
  g.translate(0, 0, -w / 2);
  return g;
}
/** a thin bar between two points in the x/y plane at depth z */
function bar(k: Kit, x1: number, y1: number, x2: number, y2: number, z: number, t: number, d: number, c: number) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  k.box(len + t, t, d, c, (x1 + x2) / 2, (y1 + y2) / 2, z, 0, 0, Math.atan2(y2 - y1, x2 - x1));
}

interface CarDef {
  wheelR: number;
  clear: number; // body bottom
  belt: number; // window line
  roofT: number;
  /** greenhouse: base rear/front x, roof rear/front x (as offsets from the ends) */
  gb0: number; gb1: number; gr0: number; gr1: number;
  noseH?: number; // bonnet height drop
  wheelX: number; // axle distance from the ends
}
const CARS: Record<string, CarDef> = {
  sedan: { wheelR: 0.32, clear: 0.24, belt: 0.86, roofT: 0.07, gb0: 0.95, gb1: 1.25, gr0: 1.4, gr1: 2.0, wheelX: 0.92 },
  taksi: { wheelR: 0.32, clear: 0.24, belt: 0.86, roofT: 0.07, gb0: 0.9, gb1: 1.2, gr0: 1.35, gr1: 1.95, wheelX: 0.9 },
  citycar: { wheelR: 0.3, clear: 0.22, belt: 0.88, roofT: 0.07, gb0: 0.25, gb1: 0.75, gr0: 0.4, gr1: 1.35, wheelX: 0.65 },
  mpv: { wheelR: 0.34, clear: 0.26, belt: 0.98, roofT: 0.08, gb0: 0.12, gb1: 1.0, gr0: 0.22, gr1: 1.65, wheelX: 0.85 },
  angkot: { wheelR: 0.3, clear: 0.24, belt: 0.98, roofT: 0.08, gb0: 0.06, gb1: 0.62, gr0: 0.08, gr1: 0.95, wheelX: 0.72 },
  pickup: { wheelR: 0.34, clear: 0.3, belt: 1.05, roofT: 0.08, gb0: 1.85, gb1: 0.95, gr0: 1.9, gr1: 1.15, wheelX: 0.8 },
};

/** Build a vehicle facing +x, wheels on y = 0. Real metres; never scaled (riders stay full size). */
export function buildVehicle(s: VSpec): VehicleModel {
  const t = VTYPE[s.type];
  const k = new Kit();
  const L = new Kit();
  const G = new Kit();
  const c = s.color;
  const trim = c === 0xf5f5f5 ? 0x90a4ae : 0xf5f5f5;
  const elec = s.engine === 'listrik';
  let exhaust: THREE.Vector3 | null = null;
  let poncho: THREE.Mesh | null = null;
  const tops: Top[] = [];
  let solidH = 0.9;
  const root = new THREE.Group();
  const people = new THREE.Group(); // skin meshes (shared, cached geometry)
  const heads: number[] = [];
  let roofIn = 99;

  if (t.kind === 'car') {
    const d = CARS[t.id];
    const hl = t.len / 2, hw = t.wid / 2;
    const H = t.h;
    const { wheelR, clear, belt } = d;
    const pickup = t.id === 'pickup';
    solidH = belt;
    // ---- lower body: one chunky slab with a slightly lower bonnet, arches cut by dark boxes
    const noseX = hl - d.gb1; // front of the greenhouse base
    const hoodDrop = pickup ? 0.0 : t.id === 'sedan' || t.id === 'taksi' ? 0.08 : 0.04;
    k.box(t.len - 0.1, belt - clear, t.wid, c, -0.05 + 0.0, (clear + belt) / 2, 0);
    k.box(0.1, belt - clear - hoodDrop - 0.06, t.wid - 0.06, c, hl - 0.05, (clear + belt - hoodDrop - 0.06) / 2, 0); // rounded nose
    if (hoodDrop) k.box(hl - noseX + 0.02, 0.03, t.wid - 0.1, shade(c, 0.9), (hl + noseX) / 2, belt - hoodDrop / 2, 0); // bonnet crease
    // wheel arches + wheels
    for (const x of [hl - d.wheelX, -hl + d.wheelX]) {
      for (const z of [hw - 0.005, -hw + 0.005]) k.box(wheelR * 2.3, 0.06, 0.04, shade(c, 0.7), x, wheelR * 2 + 0.06, z);
      for (const z of [hw - 0.13, -hw + 0.13]) k.cyl(wheelR, 0.24, TYRE, x, wheelR, z, false, 14).cyl(wheelR * 0.55, 0.26, RIM, x, wheelR, z, false, 8).cyl(wheelR * 0.18, 0.28, DARK, x, wheelR, z, false, 6);
    }
    k.box(t.len - 0.6, clear - 0.08, t.wid - 0.5, INSIDE, 0, (clear + 0.08) / 2 + 0.02, 0); // underbody
    // bumpers, grille, plates
    k.box(0.14, 0.2, t.wid + 0.04, DARK, hl - 0.06, clear + 0.08, 0);
    k.box(0.14, 0.2, t.wid + 0.04, DARK, -hl + 0.06, clear + 0.08, 0);
    k.box(0.04, 0.16, t.wid * 0.5, INSIDE, hl - 0.005, belt - 0.24, 0);
    for (const x of [hl + 0.02, -hl - 0.02]) k.box(0.02, 0.13, 0.46, 0x111111, x, clear + 0.32, 0).box(0.025, 0.08, 0.4, 0xfafafa, x, clear + 0.32, 0);
    // side trim line + door seams + handles
    k.box(t.len * 0.86, 0.04, t.wid + 0.012, trim, 0, belt - 0.3, 0);
    for (const z of [hw + 0.004, -hw - 0.004]) {
      const doors = pickup ? [noseX - 0.1] : t.id === 'citycar' ? [noseX - 0.05, noseX - 1.0] : [noseX - 0.05, noseX - 1.15, noseX - 2.2];
      for (const x of doors) if (x > -hl + 0.5) k.box(0.025, belt - clear - 0.12, 0.01, shade(c, 0.72), x, (clear + belt) / 2 + 0.04, z);
      for (const x of doors.slice(1)) if (x > -hl + 0.5) k.box(0.16, 0.04, 0.012, 0x9e9e9e, x + 0.22, belt - 0.12, z);
      if (pickup) k.box(0.16, 0.04, 0.012, 0x9e9e9e, noseX - 0.4, belt - 0.12, z);
    }
    // mirrors
    for (const z of [hw + 0.07, -hw - 0.07]) k.box(0.1, 0.1, 0.1, c, noseX - 0.1, belt + 0.12, z).box(0.03, 0.03, 0.12, INSIDE, noseX - 0.08, belt + 0.06, z * 0.97);
    // electric: blue badge on the doors (no exhaust)
    if (elec) for (const z of [hw + 0.006, -hw - 0.006]) k.box(0.28, 0.1, 0.012, 0x00b0ff, noseX - 0.6, belt - 0.42, z);
    else {
      exhaust = new THREE.Vector3(-hl - 0.1, clear + 0.02, -hw + 0.3);
      k.add(new THREE.CylinderGeometry(0.04, 0.04, 0.24, 6).rotateZ(Math.PI / 2), 0x9e9e9e, -hl + 0.1, clear - 0.02, -hw + 0.3);
    }
    // lamps
    for (const z of [hw - 0.22, -hw + 0.22]) {
      L.box(0.05, 0.14, 0.34, HEAD, hl + 0.005, belt - hoodDrop - 0.16, z);
      L.box(0.05, 0.16, 0.26, TAIL, -hl + 0.005, belt - 0.14, z);
      L.box(0.05, 0.06, 0.12, 0xffa000, hl + 0.006, clear + 0.22, z * 1.02);
    }
    // ---- greenhouse: glass prism + roof + pillars
    const x0 = -hl + d.gb0, x1 = hl - d.gb1;
    const r0 = -hl + d.gr0, r1 = hl - d.gr1;
    const top = H - d.roofT;
    roofIn = top - 0.02;
    const cw = t.wid - 0.14;
    G.add(prism([[x0 + 0.03, belt], [x1 - 0.03, belt], [r1 - 0.02, top], [r0 + 0.02, top]], cw - 0.02), GLASS, 0, 0, 0);
    k.box(r1 - r0 + 0.06, d.roofT, cw + 0.04, c, (r0 + r1) / 2, H - d.roofT / 2, 0);
    for (const z of [cw / 2 - 0.02, -cw / 2 + 0.02]) {
      bar(k, x1, belt, r1, top, z, 0.08, 0.06, c); // A pillar
      bar(k, x0, belt, r0, top, z, pickup || t.id === 'angkot' || t.id === 'mpv' ? 0.12 : 0.14, 0.06, c); // C / D pillar
      const bx = pickup ? (x1 + x0) / 2 : x1 - 1.12;
      if (bx > r0 + 0.2) bar(k, bx, belt, bx + (r1 - x1) * 0.1, top, z, 0.08, 0.06, INSIDE); // B pillar
      if (t.id === 'mpv' || t.id === 'angkot') bar(k, x1 - 2.2, belt, x1 - 2.2, top, z, 0.08, 0.06, INSIDE);
    }
    // windows read darker on the lower part of the doors? keep: belt strip in body colour
    k.box(x1 - x0, 0.04, cw + 0.02, c, (x0 + x1) / 2, belt + 0.02, 0);
    // interior: dashboard, steering wheel, seats
    k.box(0.4, 0.2, cw - 0.1, INSIDE, x1 - 0.05, belt - 0.02, 0);
    if (pickup) {
      // the open bed is a lower step: the cat can sit inside it
      tops.push({ x0: x0 - 0.08, x1: hl, z0: -hw, z1: hw, y: belt });
      tops.push({ x0: -hl, x1: x0 - 0.08, z0: -hw, z1: hw, y: belt - 0.37 });
      solidH = belt - 0.37;
    } else tops.push({ x0: -hl, x1: hl, z0: -hw, z1: hw, y: belt });
    tops.push({ x0: r0, x1: r1, z0: -cw / 2, z1: cw / 2, y: H });
    // ---- the driver (right-hand drive: Indonesia drives on the left, driver sits on the right, +z)
    const role = t.id === 'taksi' ? 'taksi' : t.id === 'angkot' ? 'angkot' : 'rider';
    const dOut = outfitOf(s.rider, role);
    const headUp = headAboveSeat(dOut, 'car');
    // a low seat (hidden inside the body) keeps the big Blocky head under the roof
    const seatY = Math.max(0.12, Math.min(belt - 0.3, roofIn - 0.03 - headUp));
    const dz = hw - 0.6;
    const dx = Math.min(r1 - 0.42, x1 - 0.75);
    k.box(0.5, 0.1, 0.48, INSIDE, dx + 0.02, seatY - 0.05, dz); // seat
    k.box(0.12, 0.62, 0.48, INSIDE, dx - 0.3, seatY + 0.28, dz, 0, 0, -0.15); // backrest
    k.box(0.5, 0.1, 0.48, INSIDE, dx + 0.02, seatY - 0.05, -dz).box(0.12, 0.62, 0.48, INSIDE, dx - 0.3, seatY + 0.28, -dz, 0, 0, -0.15);
    k.add(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 10).rotateZ(Math.PI / 2 + 0.5), 0x212121, dx + 0.6, seatY + 0.5, dz); // steering wheel
    heads.push(seat(k, people, dOut, 'car', null, dx, seatY, dz, Math.PI / 2));
    if (t.id === 'angkot') {
      // angkot: benches along both sides in the back, a passenger may sit sideways
      const bx0 = x0 + 0.15, bx1 = x1 - 0.95;
      for (const z of [hw - 0.32, -hw + 0.32]) k.box(bx1 - bx0, 0.12, 0.42, INSIDE, (bx0 + bx1) / 2, seatY - 0.06, z).box(bx1 - bx0, 0.5, 0.06, INSIDE, (bx0 + bx1) / 2, seatY + 0.3, z + Math.sign(z) * 0.2);
      if (s.passenger) heads.push(seat(k, people, outfitOf(s.passenger, 'passenger'), 'bench', null, (bx0 + bx1) / 2 - 0.2, seatY, hw - 0.36, Math.PI));
      // stripe + route board + roof rack
      k.box(t.len - 0.08, 0.1, t.wid + 0.02, 0xffffff, -0.05, belt - 0.12, 0);
      k.box(0.9, 0.22, 0.04, 0xffffff, r1 - 0.5, H - 0.25, cw / 2 + 0.03);
      k.box(0.8, 0.12, 0.05, 0x263238, r1 - 0.5, H - 0.25, cw / 2 + 0.03);
      k.box(0.04, 0.2, 0.9, 0xffffff, r1 + 0.04, H - 0.18, 0).box(0.05, 0.1, 0.8, 0x263238, r1 + 0.05, H - 0.18, 0);
    }
    if (t.id === 'taksi') {
      k.box(0.46, 0.15, 0.24, 0xfff59d, (r0 + r1) / 2, H + 0.07, 0).box(0.47, 0.04, 0.25, 0x1565c0, (r0 + r1) / 2, H + 0.02, 0);
      for (const z of [hw + 0.006, -hw - 0.006]) k.box(1.2, 0.08, 0.01, 0xffffff, x1 - 1.0, belt - 0.2, z);
    }
    if (t.id === 'mpv') for (const z of [cw / 2 - 0.12, -cw / 2 + 0.12]) k.box(r1 - r0 - 0.4, 0.05, 0.05, DARK, (r0 + r1) / 2, H + 0.04, z).box(0.05, 0.05, 0.05, DARK, r0 + 0.25, H + 0.02, z).box(0.05, 0.05, 0.05, DARK, r1 - 0.25, H + 0.02, z);
    if (pickup) {
      // open bed behind the cab: floor, low walls, tailgate, cargo
      const bx0 = -hl + 0.05, bx1 = x0 - 0.06;
      const floorY = belt - 0.42;
      k.box(bx1 - bx0, 0.05, t.wid - 0.12, INSIDE, (bx0 + bx1) / 2, floorY, 0);
      for (const z of [hw - 0.04, -hw + 0.04]) k.box(bx1 - bx0, 0.08, 0.09, shade(c, 0.85), (bx0 + bx1) / 2, belt + 0.02, z);
      k.box(0.08, 0.06, t.wid, shade(c, 0.85), bx0, belt + 0.01, 0);
      k.box(0.1, 0.5, t.wid - 0.04, c, x0 - 0.02, belt + 0.18, 0); // headboard
      const mid = (bx0 + bx1) / 2;
      const by = floorY + 0.03;
      if (s.cargo === 0) for (const dz2 of [-0.45, 0.05, 0.5]) k.cyl(0.17, 0.48, 0x4fc3f7, mid + dz2 * 0.6, by + 0.24, dz2, true, 10).cyl(0.06, 0.08, 0x1565c0, mid + dz2 * 0.6, by + 0.52, dz2, true, 6);
      else if (s.cargo === 1) for (const [dx2, dz2, col] of [[-0.4, -0.35, 0x8bc34a], [0.35, 0.3, 0xff7043], [-0.3, 0.35, 0x8d6e63]] as const) k.box(0.55, 0.36, 0.5, 0xb48a5a, mid + dx2, by + 0.18, dz2).box(0.5, 0.08, 0.45, col, mid + dx2, by + 0.38, dz2);
      else k.box(0.9, 0.4, 0.7, 0xeeeeee, mid, by + 0.2, 0).box(0.5, 0.02, 0.5, 0x43a047, mid, by + 0.41, 0);
    }
  } else {
    // ---------- motorbike (real size: ~1.9 m long, seat ~0.78) ----------
    const hl = t.len / 2;
    const scooter = t.id === 'matic' || t.id === 'ojol';
    const sport = t.id === 'sport';
    const wr = scooter ? 0.28 : 0.3;
    const fx = hl - wr, bxW = -hl + wr; // axles
    for (const x of [fx, bxW]) k.cyl(wr, 0.12, TYRE, x, wr, 0, false, 14).cyl(wr * 0.6, 0.14, RIM, x, wr, 0, false, 8).cyl(wr * 0.15, 0.16, DARK, x, wr, 0, false, 6);
    // mudguards
    k.box(0.5, 0.04, 0.16, scooter ? c : 0x212121, fx - 0.02, wr * 2 + 0.06, 0, 0, 0, -0.1);
    const seatY = sport ? 0.82 : 0.78;
    if (scooter) {
      k.box(0.62, 0.1, 0.38, 0x3a3a44, 0.12, 0.36, 0); // footboard
      k.box(0.2, 0.72, 0.5, c, fx - 0.2, 0.66, 0, 0, 0, -0.32); // leg shield
      k.box(0.82, 0.36, 0.44, c, -0.42, seatY - 0.22, 0); // body under the seat
      k.box(0.5, 0.2, 0.3, c, -0.68, seatY - 0.12, 0, 0, 0, 0.18); // tail
      k.box(0.28, 0.2, 0.3, 0x9e9e9e, bxW + 0.1, 0.36, 0.0); // engine/cvt
    } else if (t.id === 'bebek') {
      k.box(0.9, 0.12, 0.18, c, 0.12, 0.62, 0, 0, 0, 0.32); // backbone
      k.box(0.26, 0.5, 0.42, c, fx - 0.18, 0.7, 0, 0, 0, -0.3); // front cowl
      k.box(0.78, 0.3, 0.36, c, -0.38, seatY - 0.2, 0);
      k.box(0.42, 0.26, 0.26, 0x616161, -0.02, 0.4, 0); // engine
      k.box(0.08, 0.05, 0.6, 0x3a3a44, -0.06, 0.32, 0); // foot pegs
    } else {
      k.box(0.62, 0.3, 0.42, c, 0.22, seatY + 0.02, 0); // tank
      k.box(0.4, 0.5, 0.46, c, fx - 0.24, 0.76, 0, 0, 0, -0.5); // fairing
      k.box(0.6, 0.18, 0.28, c, -0.6, seatY + 0.08, 0, 0, 0, 0.22); // raised tail
      k.box(0.5, 0.32, 0.3, 0x616161, 0.02, 0.45, 0);
      k.box(0.08, 0.05, 0.6, 0x3a3a44, -0.15, 0.4, 0);
    }
    k.box(0.68, 0.1, sport ? 0.3 : 0.36, 0x212121, -0.32, seatY - 0.02, 0); // seat
    // fork + handlebar + mirrors
    const barX = fx - 0.3, barY = 1.02;
    k.box(0.05, 0.7, 0.05, 0x9e9e9e, fx - 0.12, 0.62, 0.1, 0, 0, -0.38).box(0.05, 0.7, 0.05, 0x9e9e9e, fx - 0.12, 0.62, -0.1, 0, 0, -0.38);
    k.box(0.06, 0.05, 0.66, 0x212121, barX, barY, 0);
    for (const z of [0.3, -0.3]) k.box(0.03, 0.22, 0.03, 0x9e9e9e, barX - 0.02, barY + 0.12, z).box(0.03, 0.08, 0.12, 0x212121, barX - 0.02, barY + 0.24, z * 1.1);
    if (!elec) {
      exhaust = new THREE.Vector3(-hl + 0.05, 0.34, -0.2);
      k.box(0.62, 0.09, 0.09, 0x9e9e9e, -0.3, 0.34, -0.2, 0, 0, 0.12);
    } else k.box(0.2, 0.08, 0.02, 0x00b0ff, -0.4, seatY - 0.15, 0.23);
    // plate
    k.box(0.02, 0.12, 0.24, 0x111111, -hl + 0.06, 0.62, 0);
    // rider (always a full-size adult; feet on the board / pegs, hands on the bar)
    const role = t.id === 'ojol' ? 'ojol' : 'rider';
    const rOut = outfitOf(s.rider, role);
    const rx = barX - 0.6; // hips: hands reach ~0.55 forward
    heads.push(seat(k, people, rOut, sport ? 'sport' : 'motor', s.rider.helmet, rx, seatY, 0, Math.PI / 2));
    const hw = t.wid / 2;
    solidH = seatY;
    tops.push({ x0: barX - 0.1, x1: hl, z0: -hw, z1: hw, y: barY + 0.05 }); // front + handlebar
    let backX = rx - 0.26;
    // pick the passenger's way of sitting: gamis/daster/kain => menyamping (legs to the left side)
    const box = t.id === 'ojol' && !s.passenger;
    if (s.passenger) {
      const pOut = outfitOf(s.passenger, 'passenger');
      const side = pOut.bottom === 'gamis' || pOut.bottom === 'daster' || pOut.bottom === 'kain' || pOut.bottom === 'sarung';
      const px = rx - (pOut.kid ? 0.36 : 0.48);
      const ph = seat(k, people, pOut, side ? 'samping' : pOut.kid ? 'kidMotor' : 'motor', pOut.kid ? 0xffeb3b : s.passenger.helmet, side ? px - 0.06 : px, seatY + 0.02, side ? -0.06 : 0, side ? Math.PI : Math.PI / 2);
      heads.push(ph);
      if (side) k.box(0.3, 0.04, 0.14, 0x3a3a44, px - 0.1, 0.36, -0.36); // side foot step
      tops.push({ x0: px - 0.24, x1: backX, z0: -hw, z1: hw, y: ph });
      backX = px - 0.24;
    }
    tops.push({ x0: backX, x1: barX - 0.1, z0: -hw, z1: hw, y: heads[0] }); // rider
    if (box) {
      k.box(0.46, 0.44, 0.46, 0x2e7d32, -hl + 0.28, seatY + 0.3, 0).box(0.47, 0.08, 0.47, 0xffffff, -hl + 0.28, seatY + 0.36, 0).box(0.3, 0.04, 0.4, 0x9e9e9e, -hl + 0.3, seatY + 0.06, 0);
      tops.push({ x0: -hl, x1: backX, z0: -hw, z1: hw, y: seatY + 0.52 });
    } else tops.push({ x0: -hl, x1: backX, z0: -hw, z1: hw, y: seatY + 0.04 }); // free back seat: a cat seat!
    // rain poncho over the rider(s) (shown on rainy days)
    const pk = new Kit();
    const pc = pick([0x1e88e5, 0xfdd835, 0xe53935, 0x7e57c2], () => (s.color % 97) / 97);
    pk.box(0.46, 0.62, 0.62, pc, rx + 0.04, seatY + 0.42, 0).box(0.82, 0.08, 0.7, pc, rx + 0.12, seatY + 0.1, 0).box(0.3, 0.4, 0.66, pc, rx + 0.28, seatY + 0.3, 0, 0, 0, -0.5);
    if (s.passenger) pk.box(0.44, 0.58, 0.6, pc, rx - (s.passenger.look === -1 ? 0.36 : 0.5), seatY + 0.4, 0);
    poncho = pk.mesh();
    poncho.visible = false;
    // lamps: head lamp + tail lamp + indicators
    L.box(0.06, 0.12, 0.18, HEAD, fx - 0.08, sport ? 0.9 : 0.94, 0);
    L.box(0.05, 0.08, 0.16, TAIL, -hl + 0.04, seatY - 0.04, 0);
    for (const z of [0.2, -0.2]) L.box(0.05, 0.04, 0.06, 0xffa000, fx - 0.12, 0.9, z);
  }
  const body = k.mesh(VMAT.body);
  const lamps = L.mesh(VMAT.lamp);
  const glass = G.parts.length ? G.mesh(VMAT.glass) : null;
  body.add(people);
  root.add(body, lamps);
  if (glass) body.add(glass);
  if (poncho) body.add(poncho);
  return { root, body, lamps, glass, poncho, exhaust, tops, solidH, fit: { heads, roofIn } };
}

// ---------------- road-works machines ----------------
export interface Excavator {
  root: THREE.Group;
  cab: THREE.Group; // turns (yaw)
  boom: THREE.Group; // pitch at the cab pivot (rotation.z)
  stick: THREE.Group; // pitch at the boom tip
  bucket: THREE.Group; // pitch at the stick tip
  bucketTip: THREE.Object3D; // inside the bucket's scoop (where the cat sits)
  /** the operator in the cabin (origin = seat surface); bubbles + visibility */
  operator: THREE.Object3D;
}

const YEL = 0xf9b81b, YD = 0xd99a10, STEEL = 0xb0bec5, MID = 0x5f6368, DK = 0x2f3236;
/** a cylinder from a to b (x/y plane at depth z) */
function rod(k: Kit, ax: number, ay: number, bx: number, by: number, z: number, r: number, c: number) {
  const len = Math.hypot(bx - ax, by - ay);
  const g = new THREE.CylinderGeometry(r, r, len, 8);
  g.rotateZ(Math.atan2(by - ay, bx - ax) - Math.PI / 2);
  k.add(g, c, (ax + bx) / 2, (ay + by) / 2, z);
}
function hazardStripes(k: Kit, w: number, h: number, x: number, y: number, z: number, n = 6) {
  k.box(0.02, h, w, 0x222222, x, y, z);
  for (let i = 0; i < n; i++) k.box(0.025, h * 0.98, w / n / 2, YEL, x, y, z - w / 2 + (i + 0.25) * (w / n), 0.5);
}

/** Boom geometry: pivot at the cab, a 1.9 m segment, a bend, a 1.7 m segment (cab frame: +x forward). */
export const EXC_ARM = { pivot: [0.75, 0.55] as const, s1: 1.9, knee: -0.9, s2: 1.7, stick: 1.7 };

/**
 * Yellow excavator (beko) facing +x, about 2.5 adults tall with the arm up.
 * Joint angles: boom.rotation.z, stick.rotation.z, bucket.rotation.z.
 * The bucket is a curved scoop whose mouth and teeth face back toward the cab.
 */
export function buildExcavator(): Excavator {
  const root = new THREE.Group();
  const base = new Kit();
  // tracks with pads, rollers, idlers
  for (const z of [0.92, -0.92]) {
    base.box(3.1, 0.5, 0.56, 0x2a2c2f, 0, 0.33, z);
    for (let i = 0; i < 16; i++) base.box(0.12, 0.06, 0.6, 0x1b1c1e, -1.5 + i * 0.2, 0.6, z).box(0.12, 0.06, 0.6, 0x1b1c1e, -1.5 + i * 0.2, 0.05, z);
    for (const x of [-1.4, 1.4]) base.cyl(0.3, 0.6, MID, x, 0.33, z, false, 12);
    for (let i = -2; i <= 2; i++) base.cyl(0.12, 0.62, MID, i * 0.45, 0.2, z, false, 8);
  }
  base.box(1.6, 0.32, 1.4, DK, 0, 0.6, 0);
  base.cyl(0.6, 0.14, MID, 0, 0.82, 0, true, 14);
  root.add(base.mesh());
  const cab = new THREE.Group();
  cab.position.y = 0.9;
  root.add(cab);
  const ck = new Kit();
  const G = new Kit();
  ck.box(2.4, 0.72, 2.0, YEL, -0.25, 0.36, 0); // house
  ck.box(0.6, 0.6, 2.0, YD, -1.2, 0.3, 0); // counterweight
  hazardStripes(ck, 2.0, 0.3, -1.51, 0.35, 0);
  ck.box(1.0, 0.18, 0.9, MID, -0.7, 0.8, 0.45);
  for (let i = 0; i < 4; i++) ck.box(0.06, 0.03, 0.8, DK, -1.05 + i * 0.22, 0.9, 0.45); // engine grille
  ck.cyl(0.06, 0.7, DK, -0.95, 1.1, 0.75, true, 6); // exhaust stack
  // cabin (left front: -z), tall enough for a seated full-size operator
  const cx = 0.42, cz = -0.48, CW = 1.1, CD = 1.0, CH = 1.65;
  ck.box(CW, 0.12, CD, YEL, cx, 0.78 + CH, cz); // roof
  for (const [x, z] of [[cx - CW / 2 + 0.05, cz + CD / 2 - 0.05], [cx + CW / 2 - 0.05, cz + CD / 2 - 0.05], [cx - CW / 2 + 0.05, cz - CD / 2 + 0.05], [cx + CW / 2 - 0.05, cz - CD / 2 + 0.05]]) ck.box(0.09, CH, 0.09, YD, x, 0.72 + CH / 2, z);
  ck.box(CW, 0.35, CD, YEL, cx, 0.9, cz); // lower panel
  G.box(0.03, CH - 0.4, CD - 0.1, GLASS, cx + CW / 2 - 0.02, 1.07 + (CH - 0.4) / 2, cz);
  G.box(CW - 0.1, CH - 0.4, 0.03, GLASS, cx, 1.07 + (CH - 0.4) / 2, cz - CD / 2 + 0.02);
  G.box(CW - 0.1, CH - 0.4, 0.03, GLASS, cx, 1.07 + (CH - 0.4) / 2, cz + CD / 2 - 0.02);
  G.box(0.03, CH - 0.4, CD - 0.1, GLASS, cx - CW / 2 + 0.02, 1.07 + (CH - 0.4) / 2, cz);
  ck.box(0.04, CH - 0.45, 0.04, DK, cx - 0.1, 1.4, cz - CD / 2 - 0.08); // handrail
  ck.box(0.25, 0.05, 0.28, MID, cx + 0.2, 0.35, cz - CD / 2 - 0.15); // step
  // beacon + mirror
  ck.cyl(0.11, 0.05, DK, cx - 0.2, 0.84 + CH, cz, true, 8);
  ck.box(0.04, 0.3, 0.04, DK, cx + CW / 2 + 0.04, 2.0, cz - CD / 2 - 0.05).box(0.04, 0.2, 0.14, DK, cx + CW / 2 + 0.06, 2.2, cz - CD / 2 - 0.12);
  const lampK = new Kit();
  lampK.cyl(0.08, 0.14, 0xff9100, cx - 0.2, 0.84 + CH + 0.1, cz, true, 8);
  lampK.box(0.04, 0.1, 0.16, HEAD, cx + CW / 2 + 0.01, 0.78 + CH - 0.12, cz + 0.25);
  // seat + control levers
  ck.box(0.5, 0.12, 0.5, INSIDE, cx - 0.1, 1.12, cz).box(0.1, 0.6, 0.5, INSIDE, cx - 0.38, 1.45, cz);
  for (const z of [cz + 0.28, cz - 0.28]) ck.box(0.3, 0.3, 0.1, DK, cx + 0.1, 1.1, z).box(0.03, 0.2, 0.03, 0x111111, cx + 0.2, 1.33, z);
  // operator (full size, seated, helmet)
  const operator = new THREE.Group();
  operator.position.set(cx - 0.1, 1.18, cz);
  cab.add(operator);
  const opKit = new Kit();
  seat(opKit, operator, OPERATOR, 'car', 0xfdd835, 0, 0, 0, Math.PI / 2);
  if (opKit.parts.length) operator.add(opKit.mesh());
  cab.add(ck.mesh(), G.mesh(VMAT.glass), lampK.mesh(VMAT.lamp));
  // ---- arm: boom (bent) -> stick -> bucket; each joint rotates about z, segments run along +x
  const A = EXC_ARM;
  const boom = new THREE.Group();
  boom.position.set(A.pivot[0], A.pivot[1], 0.32);
  cab.add(boom);
  const bk = new Kit();
  bk.cyl(0.2, 0.46, MID, 0, 0, 0, false, 10);
  bk.box(A.s1, 0.44, 0.38, YEL, A.s1 / 2, 0, 0);
  const kx = A.s1, kc = Math.cos(A.knee), ks = Math.sin(A.knee);
  bk.cyl(0.22, 0.42, YEL, kx, 0, 0, false, 10);
  bk.box(A.s2, 0.4, 0.34, YEL, kx + (A.s2 / 2) * kc, (A.s2 / 2) * ks, 0, 0, 0, A.knee);
  const tipX = kx + A.s2 * kc, tipY = A.s2 * ks;
  bk.cyl(0.17, 0.46, MID, tipX, tipY, 0, false, 10);
  // stick ram on top of the boom (barrel)
  rod(bk, 0.9, 0.3, kx - 0.1, 0.42, 0, 0.09, MID);
  boom.add(bk.mesh());
  // boom rams from the house to under the boom (fixed to the boom: good enough for the range we use)
  const stick = new THREE.Group();
  stick.position.set(tipX, tipY, 0);
  boom.add(stick);
  const sk = new Kit();
  sk.box(A.stick, 0.32, 0.28, YD, A.stick / 2, 0, 0);
  sk.box(0.5, 0.42, 0.3, YD, -0.15, 0.12, 0); // stick tail (ram mount)
  rod(sk, 0.15, 0.24, A.stick - 0.35, 0.22, 0, 0.055, STEEL); // bucket ram
  rod(sk, -0.3, 0.3, -0.75, 0.3, 0, 0.05, STEEL); // stick ram rod
  sk.cyl(0.12, 0.5, MID, A.stick, 0, 0, false, 10);
  stick.add(sk.mesh());
  const bucket = new THREE.Group();
  bucket.position.set(A.stick, 0, 0);
  stick.add(bucket);
  // bucket profile in bucket space (x along the stick, y: back of the scoop at +y, mouth toward -y)
  const prof: [number, number][] = [[0.0, 0.02], [0.22, 0.2], [0.5, 0.27], [0.78, 0.18], [0.92, -0.08], [0.86, -0.36], [0.68, -0.52]];
  const BW = 0.78, BC = 0x45484d;
  const kk = new Kit();
  for (let i = 0; i < prof.length - 1; i++) {
    const [x1, y1] = prof[i], [x2, y2] = prof[i + 1];
    const len = Math.hypot(x2 - x1, y2 - y1) + 0.04;
    kk.box(len, 0.06, BW, BC, (x1 + x2) / 2, (y1 + y2) / 2, 0, 0, 0, Math.atan2(y2 - y1, x2 - x1));
  }
  // side plates (D shape from the profile)
  const sh = new THREE.Shape();
  sh.moveTo(prof[0][0], prof[0][1]);
  for (const [x, y] of prof.slice(1)) sh.lineTo(x, y);
  sh.lineTo(prof[0][0], prof[0][1]);
  for (const z of [-BW / 2, BW / 2]) kk.add(new THREE.ExtrudeGeometry(sh, { depth: 0.03, bevelEnabled: false }), 0x3a3d42, 0, 0, z - 0.015);
  // teeth + lip at the mouth, pointing toward the cab side (-y)
  const [lx, ly] = prof[prof.length - 1], [px, py] = prof[prof.length - 2];
  const ang = Math.atan2(ly - py, lx - px);
  kk.box(0.12, 0.05, BW + 0.04, STEEL, lx, ly, 0, 0, 0, ang);
  for (const z of [-0.27, -0.09, 0.09, 0.27]) kk.box(0.18, 0.05, 0.1, STEEL, lx + Math.cos(ang) * 0.1, ly + Math.sin(ang) * 0.1, z, 0, 0, ang);
  kk.cyl(0.12, 0.5, MID, 0, 0, 0, false, 10);
  // a lump of soil inside
  kk.add(new THREE.DodecahedronGeometry(0.22, 0).scale(1.0, 0.7, 1.4), 0x8d6e4b, 0.55, -0.12, 0);
  bucket.add(kk.mesh());
  const bucketTip = new THREE.Object3D();
  bucketTip.position.set(0.56, -0.12, 0);
  bucket.add(bucketTip);
  // a "PROYEK" panel on the house side
  const pk = new Kit();
  pk.box(0.9, 0.22, 0.02, 0xffffff, -0.3, 0.42, 1.011).box(0.8, 0.1, 0.022, 0xc62828, -0.3, 0.42, 1.012);
  cab.add(pk.mesh());
  return { root, cab, boom, stick, bucket, bucketTip, operator };
}

/** Road roller ("mesin penggilas"), facing +x, ~3.2 m long. drums[] spin while it drives. */
export function buildRoller() {
  const root = new THREE.Group();
  const k = new Kit();
  const L = new Kit();
  // frames over both drums
  for (const [x, w] of [[1.0, 1.4], [-1.0, 1.3]] as const) {
    k.box(0.5, 0.2, w + 0.14, YEL, x, 1.18, 0);
    for (const z of [w / 2 + 0.05, -w / 2 - 0.05]) k.box(0.8, 0.62, 0.06, YEL, x, 0.86, z);
  }
  // engine body + seat deck
  k.box(1.5, 0.72, 1.3, YEL, 0, 1.22, 0);
  hazardStripes(k, 1.3, 0.18, 0.76, 1.1, 0);
  k.box(1.5, 0.08, 1.32, YD, 0, 1.62, 0);
  for (let i = 0; i < 4; i++) k.box(0.6, 0.3, 0.03, DK, -0.3 + 0.0, 1.25, 0.66 + i * 0.001);
  // ROPS canopy (head room for a full-size seated operator)
  for (const [x, z] of [[-0.62, 0.58], [-0.62, -0.58], [0.55, 0.58], [0.55, -0.58]]) k.box(0.08, 1.62, 0.08, DK, x, 2.45, z);
  k.box(1.4, 0.1, 1.4, YEL, -0.04, 3.28, 0);
  k.cyl(0.11, 0.05, DK, -0.4, 3.35, 0.4, true, 8);
  L.cyl(0.08, 0.14, 0xff9100, -0.4, 3.45, 0.4, true, 8);
  // dash + steering wheel + seat
  k.box(0.08, 0.36, 0.5, DK, 0.45, 1.85, 0);
  k.add(new THREE.CylinderGeometry(0.16, 0.16, 0.04, 10).rotateZ(-0.6), 0x222222, 0.36, 2.1, 0);
  k.box(0.45, 0.1, 0.45, INSIDE, -0.22, 1.7, 0).box(0.1, 0.5, 0.45, INSIDE, -0.46, 1.98, 0);
  // the operator (full size) on the seat
  const people = new THREE.Group();
  seat(k, people, OPERATOR, 'car', 0xfdd835, -0.2, 1.76, 0, Math.PI / 2);
  // a sign on the back
  k.box(0.02, 0.2, 1.0, 0xffffff, -0.76, 1.38, 0).box(0.022, 0.08, 0.86, 0xc62828, -0.761, 1.38, 0);
  L.box(0.04, 0.1, 0.16, TAIL, -0.76, 1.55, 0.5).box(0.04, 0.1, 0.16, TAIL, -0.76, 1.55, -0.5);
  const body = k.mesh();
  body.add(people);
  root.add(body, L.mesh(VMAT.lamp));
  const drums: THREE.Mesh[] = [];
  for (const [x, r, w] of [[1.0, 0.55, 1.4], [-1.0, 0.52, 1.3]] as const) {
    const d = new Kit();
    d.cyl(r, w, 0x9ea6ab, 0, 0, 0, false, 18).cyl(r * 0.6, w + 0.04, YEL, 0, 0, 0, false, 12).box(r * 1.9, 0.05, w + 0.01, 0x80888d, 0, 0, 0);
    const m = d.mesh();
    m.position.set(x, r, 0);
    root.add(m);
    drums.push(m);
  }
  /** standable columns (local; x forward): deck/seat area + both drum frames */
  const tops: Top[] = [
    { x0: -0.75, x1: 0.75, z0: -0.65, z1: 0.65, y: 1.66 },
    { x0: 0.75, x1: 1.6, z0: -0.76, z1: 0.76, y: 1.28 },
    { x0: -1.6, x1: -0.75, z0: -0.71, z1: 0.71, y: 1.28 },
  ];
  return { root, drums, tops, hl: 1.6, hw: 0.76 };
}

/** Traffic cone (one small merged mesh). */
export function coneMesh() {
  const k = new Kit();
  k.box(0.42, 0.05, 0.42, 0x212121, 0, 0.025, 0);
  const g = new THREE.CylinderGeometry(0.035, 0.17, 0.62, 10);
  k.add(g, 0xff6d00, 0, 0.36, 0);
  k.add(new THREE.CylinderGeometry(0.115, 0.13, 0.1, 10), 0xffffff, 0, 0.36, 0);
  return k.mesh();
}

/** Boom barrier at the kompleks gate (pivot at the post; arm along +z, lifts with rotation.x < 0). */
export function buildBoomBarrier() {
  const root = new THREE.Group();
  const k = new Kit();
  k.box(0.5, 1.1, 0.5, 0x546e7a, 0, 0.55, 0).box(0.56, 0.1, 0.56, 0x37474f, 0, 1.12, 0);
  root.add(k.mesh());
  const arm = new THREE.Group();
  arm.position.set(0, 0.95, 0);
  root.add(arm);
  const a = new Kit();
  for (let i = 0; i < 12; i++) a.box(0.09, 0.12, 0.6, i % 2 ? 0xffffff : 0xe53935, 0, 0, 0.35 + i * 0.6);
  arm.add(a.mesh());
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.16), new THREE.MeshBasicMaterial({ color: 0x6d4c00 }));
  lamp.position.set(0, 1.24, 0);
  root.add(lamp);
  return { root, arm, lamp };
}
