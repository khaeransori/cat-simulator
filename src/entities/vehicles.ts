// Vehicle & road-works models ("Kendaraan & proyek jalan"), exactly as in the approved
// low-poly mockup: cars are the Kenney Car Kit (CC0) models fitted to real size, motorbikes are
// the mockup's chunky bikes with seated Kenney Blocky riders. Everything is merged into ONE
// vertex-coloured mesh (+ glowing lamps), so a car costs 2 draw calls and a bike ~3-4.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pair } from '../i18n';
import { buildBlocky, poseBlocky, helmetOn, SEATED, type Outfit } from './blocky';
import { CARKIT, CAR_GEO } from './carKit';

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

type PoseName = 'drive' | 'car' | 'motor' | 'sport' | 'samping' | 'bench' | 'kidMotor' | 'mockMotor' | 'mockSamping';
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
  // the approved mockup's rider + ibu bonceng menyamping
  mockMotor: { legL: -1.15, legR: -1.15, spread: 0.3, armL: -1.05, armR: -1.05, armIn: 0.12, lean: 0.02 },
  mockSamping: { legL: -1.35, legR: -1.35, spread: 0.05, armL: -0.5, armR: -0.2, armIn: -0.25, lean: -0.05 },
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
  // the approved mockup's vehicles (Kenney Car Kit cars + the mockup motorbikes), real sizes
  { id: 'sedan', kind: 'car', name: P('Sedan', 'Sedan'), len: 4.6, wid: 1.78, h: 1.48, engines: ['bensin', 'bensin', 'listrik'], speed: [6.5, 8.5], colors: [0xc9ced6, 0xc9ced6, 0xe53935, 0x1e88e5, 0xf5f5f5, 0x37474f] },
  { id: 'mpv', kind: 'car', name: P('Mobil Keluarga', 'Family Car'), len: 4.5, wid: 1.78, h: 1.75, engines: ['bensin', 'diesel', 'listrik'], speed: [6, 7.5], colors: [0x37474f, 0x37474f, 0xc9ced6, 0xf5f5f5, 0x8d6e63, 0xc62828] },
  { id: 'pickup', kind: 'car', name: P('Mobil Bak', 'Pickup'), len: 4.3, wid: 1.7, h: 1.85, engines: ['diesel', 'diesel', 'bensin'], speed: [5.5, 7], colors: [0xf5f5f5, 0xf5f5f5, 0x1e88e5, 0xc62828] },
  { id: 'angkot', kind: 'car', name: P('Angkot', 'Minibus'), len: 4.1, wid: 1.66, h: 1.95, engines: ['bensin', 'diesel'], speed: [5.5, 7], colors: [0x2e9e4f, 0x2e9e4f, 0x1e88e5, 0xf9a825, 0xe53935] },
  { id: 'taksi', kind: 'car', name: P('Taksi', 'Taxi'), len: 4.45, wid: 1.75, h: 1.5, engines: ['bensin', 'listrik'], speed: [6.5, 8], colors: [0x3f8fd6] },
  { id: 'boks', kind: 'car', name: P('Truk Boks', 'Box Truck'), len: 6.2, wid: 2.0, h: 2.85, engines: ['diesel'], speed: [5, 6.5], colors: [0xf9a825, 0xf9a825, 0xf5f5f5] },
  { id: 'bebek', kind: 'motor', name: P('Motor Bebek', 'Moped'), len: 2.0, wid: 0.74, h: 1.75, engines: ['4tak', '4tak', '2tak'], speed: [6.5, 9], colors: [0xe53935, 0x1e88e5, 0x212121, 0xf5f5f5] },
  { id: 'matic', kind: 'motor', name: P('Motor Matic', 'Scooter'), len: 2.0, wid: 0.74, h: 1.75, engines: ['4tak', 'listrik'], speed: [6, 8.5], colors: [0xf5f5f5, 0xe53935, 0x1e88e5, 0xfdd835, 0x8e24aa] },
  { id: 'ojol', kind: 'motor', name: P('Ojek Online', 'Ride-share Bike'), len: 2.0, wid: 0.74, h: 1.75, engines: ['4tak', 'listrik'], speed: [6.5, 9], colors: [0x2e7d32] },
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
  if (t.kind === 'motor' && r() < 0.35) {
    passenger = person();
    if (r() < 0.25) passenger.look = -1; // a child on the back
  }
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

interface CarFit {
  kit: string; // Kenney Car Kit model
  dims: [number, number, number]; // [lebar, tinggi, panjang] the mockup fits it to (fitCar)
}
/** Exactly the approved mockup's cars: Kenney Car Kit model -> fitted to real size (scratch/lowpoly/chars/vehicles.ts). */
const CARFIT: Record<string, CarFit> = {
  sedan: { kit: 'sedan', dims: [1.78, 1.48, 4.6] },
  angkot: { kit: 'van', dims: [1.66, 1.95, 4.1] },
  taksi: { kit: 'taxi', dims: [1.75, 1.5, 4.45] },
  mpv: { kit: 'suv', dims: [1.78, 1.75, 4.5] },
  pickup: { kit: 'truck', dims: [1.7, 1.85, 4.3] },
  boks: { kit: 'delivery', dims: [2.0, 2.85, 6.2] },
};

// ---- decoded Kenney meshes (once) ----
interface KGeo { pos: Float32Array; nrm: Float32Array; ci: Uint8Array; idx: Uint16Array; pal: number[][] }
const KGEO = new Map<string, KGeo>();
const b64 = (s: string) => {
  const bin = atob(s);
  const u = new Uint8Array(new ArrayBuffer(bin.length));
  for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
  return u.buffer;
};
function kgeo(id: string): KGeo {
  let g = KGEO.get(id);
  if (g) return g;
  const r = CAR_GEO[id];
  const P = new Int16Array(b64(r.p));
  const N = new Int8Array(b64(r.n));
  g = {
    pos: Float32Array.from(P, (v) => v / 4096),
    nrm: Float32Array.from(N, (v) => v / 127),
    ci: new Uint8Array(b64(r.c)),
    idx: new Uint16Array(b64(r.i)),
    pal: r.pal,
  };
  KGEO.set(id, g);
  return g;
}
const LAMP_CELLS = new Set([51, 53]); // kit palette: yellow head lamps, red tail lamps (they glow at night)
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const lin = new THREE.Color();

/**
 * A Kenney Car Kit car exactly as the mockup builds it (kenneyCar + fitCar): body paint = the
 * dominant coloured palette cell recoloured with paint * luminance / 160, non-uniform fit to the
 * real size, wheels re-scaled round (k = sy * 1.05). Turned to face +x, wheels on y = 0.
 */
function kenneyCarGeo(type: string, paint: number) {
  const f = CARFIT[type];
  const nodes = CARKIT[f.kit];
  // 1) unscaled bbox (mockup: Box3 of the scene at scale 1)
  const bb = new THREE.Box3();
  const mats = nodes.map((n) => new THREE.Matrix4().compose(tmpV.fromArray(n.t), tmpQ.fromArray(n.r), tmpS.fromArray(n.s)));
  nodes.forEach((n, i) => {
    const g = kgeo(n.geo);
    for (let v = 0; v < g.pos.length; v += 3) bb.expandByPoint(tmpV.set(g.pos[v], g.pos[v + 1], g.pos[v + 2]).applyMatrix4(mats[i]));
  });
  const sx = f.dims[0] / (bb.max.x - bb.min.x), sy = f.dims[1] / (bb.max.y - bb.min.y), sz = f.dims[2] / (bb.max.z - bb.min.z);
  const k = sy * 1.05;
  // 2) the body paint cell (most frequent saturated cell on the body mesh)
  const body = nodes.find((n) => n.name === 'body')!;
  const bg = kgeo(body.geo);
  const cnt = new Map<number, number>();
  for (let v = 0; v < bg.ci.length; v++) {
    const [r, g, b, cell] = bg.pal[bg.ci[v]];
    if (Math.max(r, g, b) - Math.min(r, g, b) < 40) continue;
    cnt.set(cell, (cnt.get(cell) || 0) + 1);
  }
  let best = -1, bn = 0;
  cnt.forEach((n, c) => (n > bn ? ((bn = n), (best = c)) : 0));
  const pr = (paint >> 16) & 255, pg = (paint >> 8) & 255, pb = paint & 255;
  // 3) world matrices: turn (+z -> +x) * fit scale * node (wheels: uniform k)
  const turn = new THREE.Matrix4().makeRotationY(Math.PI / 2);
  const fit = new THREE.Matrix4().makeScale(sx, sy, sz);
  const bodyParts: THREE.BufferGeometry[] = [];
  const lampParts: THREE.BufferGeometry[] = [];
  nodes.forEach((n, i) => {
    const g = kgeo(n.geo);
    const wheel = /wheel/i.test(n.name);
    const local = wheel ? new THREE.Matrix4().compose(tmpV.fromArray(n.t), tmpQ.fromArray(n.r), tmpS.set(k / sx, k / sy, k / sz)) : mats[i];
    const m = turn.clone().multiply(fit).multiply(local);
    const col = new Float32Array(g.ci.length * 3);
    for (let v = 0; v < g.ci.length; v++) {
      let [r, gg, b, cell] = g.pal[g.ci[v]];
      if (cell === best) {
        const l = (0.3 * r + 0.59 * gg + 0.11 * b) / 160;
        r = Math.min(255, pr * l);
        gg = Math.min(255, pg * l);
        b = Math.min(255, pb * l);
      }
      lin.setRGB(r / 255, gg / 255, b / 255, THREE.SRGBColorSpace);
      col[v * 3] = lin.r;
      col[v * 3 + 1] = lin.g;
      col[v * 3 + 2] = lin.b;
    }
    // split lamp triangles (glow) from the body
    const bodyIdx: number[] = [], lampIdx: number[] = [];
    for (let t = 0; t < g.idx.length; t += 3) {
      const a = g.idx[t], b2 = g.idx[t + 1], c = g.idx[t + 2];
      const lamp = !wheel && LAMP_CELLS.has(g.pal[g.ci[a]][3]) && LAMP_CELLS.has(g.pal[g.ci[b2]][3]) && LAMP_CELLS.has(g.pal[g.ci[c]][3]);
      (lamp ? lampIdx : bodyIdx).push(a, b2, c);
    }
    for (const [ix, out] of [[bodyIdx, bodyParts], [lampIdx, lampParts]] as const) {
      if (!ix.length) continue;
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(g.pos.slice(), 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(g.nrm.slice(), 3));
      geo.setAttribute('color', new THREE.BufferAttribute(col.slice(), 3));
      geo.setIndex(ix as number[]);
      geo.applyMatrix4(m);
      out.push(geo.toNonIndexed());
      geo.dispose();
    }
  });
  // 4) wheels on the road
  const all = new THREE.Box3();
  for (const g of [...bodyParts, ...lampParts]) {
    g.computeBoundingBox();
    all.union(g.boundingBox!);
  }
  for (const g of [...bodyParts, ...lampParts]) g.translate(0, -all.min.y, 0);
  return { bodyParts, lampParts };
}

/** column tops of a car body (the cat stands on the bonnet / roof / bed edge, is pushed out of taller columns) */
function carTops(parts: THREE.BufferGeometry[], hl: number, hw: number): Top[] {
  const N = 12;
  const ys = new Array(N).fill(-1);
  for (const g of parts) {
    const p = g.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(z) > hw * 0.8) continue; // mirrors
      const s = Math.min(N - 1, Math.max(0, Math.floor(((x + hl) / (2 * hl)) * N)));
      if (y > ys[s]) ys[s] = y;
    }
  }
  const tops: Top[] = [];
  for (let s = 0; s < N; s++) if (ys[s] > 0) tops.push({ x0: -hl + (s * 2 * hl) / N, x1: -hl + ((s + 1) * 2 * hl) / N, z0: -hw, z1: hw, y: ys[s] });
  return tops;
}

// ---- the mockup's motorbike (scratch/lowpoly/chars/vehicles.ts: motor(), MS = 1.12) ----
/** motor real size vs people (the mockup scales the bike, never the rider) */
const MS = 1.12;
const MOTOR_TYRE = 0xcfd8dc;
/** mockup coords: faces +z. Built 1:1, then turned to +x and scaled by MS. */
function mockMotor(km: Kit, L: Kit, color: number, kind: 'matic' | 'bebek', box?: number) {
  const bx = (w: number, h: number, d: number, c: number, x: number, y: number, z: number, rx = 0) => km.box(w, h, d, c, x, y, z, 0, rx);
  const wheel = (r: number, w: number, x: number, y: number, z: number, rim = MOTOR_TYRE) => {
    km.add(new THREE.CylinderGeometry(r, r, w, 10), 0x2b2b33, x, y, z, 0, 0, Math.PI / 2);
    km.add(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.01, 8), rim, x, y, z, 0, 0, Math.PI / 2);
  };
  wheel(0.26, 0.12, 0, 0.26, 0.66);
  wheel(0.26, 0.14, 0, 0.26, -0.62);
  bx(0.34, 0.34, 0.62, color, 0, 0.5, -0.3); // rear body
  bx(0.36, 0.12, 0.7, 0x222228, 0, 0.74, -0.32); // seat
  if (kind === 'matic') bx(0.3, 0.1, 0.36, 0x3a3a44, 0, 0.36, 0.18); // footboard
  else bx(0.14, 0.14, 0.5, color, 0, 0.5, 0.15);
  bx(0.34, 0.66, 0.16, color, 0, 0.66, 0.5, -0.25); // front shield
  bx(0.08, 0.5, 0.08, 0x9e9e9e, 0, 0.5, 0.68, -0.35); // fork
  bx(0.66, 0.06, 0.08, 0x2b2b33, 0, 1.02, 0.5); // handlebar
  L.box(0.22, 0.12, 0.08, 0xfff7c2, 0, 0.92, 0.6); // headlamp
  L.box(0.2, 0.06, 0.04, 0xe53935, 0, 0.58, -0.62); // tail lamp
  bx(0.1, 0.1, 0.12, 0x9e9e9e, 0.0, 0.26, 0.12); // engine
  if (box !== undefined) {
    bx(0.5, 0.42, 0.5, box, 0, 1.0, -0.62);
    bx(0.52, 0.06, 0.52, shade(box, 0.8), 0, 1.24, -0.62);
  }
}
/** mockup coords (+z forward) -> game (+x forward), scaled by MS */
const MOCK2GAME = new THREE.Matrix4().makeRotationY(Math.PI / 2).multiply(new THREE.Matrix4().makeScale(MS, MS, MS));

/** Build a vehicle facing +x, wheels on y = 0. Real metres; the people on board are never scaled. */
export function buildVehicle(s: VSpec): VehicleModel {
  const t = VTYPE[s.type];
  const k = new Kit();
  const L = new Kit();
  const c = s.color;
  const elec = s.engine === 'listrik';
  let exhaust: THREE.Vector3 | null = null;
  let poncho: THREE.Mesh | null = null;
  let tops: Top[] = [];
  let solidH = 0.9;
  const root = new THREE.Group();
  const people = new THREE.Group(); // skin meshes (shared, cached geometry)
  const heads: number[] = [];
  let roofIn = 99;

  if (t.kind === 'car') {
    // ---------- a Kenney Car Kit car, exactly as in the mockup (dark windows, nobody visible inside) ----------
    const hl = t.len / 2, hw = t.wid / 2;
    const { bodyParts, lampParts } = kenneyCarGeo(s.type, c);
    k.parts.push(...bodyParts);
    L.parts.push(...lampParts);
    tops = carTops(bodyParts, hl, hw);
    solidH = Math.min(...tops.map((x) => x.y));
    roofIn = Math.max(...tops.map((x) => x.y));
    if (!elec) exhaust = new THREE.Vector3(-hl - 0.1, 0.25, -hw + 0.3);
  } else {
    // ---------- the mockup's motorbike + Blocky rider(s) ----------
    const km = new Kit();
    const kind = t.id === 'bebek' ? 'bebek' : 'matic';
    const box = t.id === 'ojol' && !s.passenger ? 0x2e7d32 : undefined;
    const Lm = new Kit();
    mockMotor(km, Lm, c, kind, box);
    // side foot step for a passenger sitting menyamping (mockup: bx(g, 0.1, 0.05, 0.3, 0x3a3a44, -0.38, 0.36, -0.5))
    const pOut = s.passenger ? outfitOf(s.passenger, 'passenger') : null;
    const side = !!pOut && !pOut.kid && (pOut.bottom === 'gamis' || pOut.bottom === 'daster' || pOut.bottom === 'kain' || pOut.bottom === 'sarung');
    if (side) km.box(0.1, 0.05, 0.3, 0x3a3a44, -0.38, 0.36, -0.5);
    const bike = km.mesh().geometry.applyMatrix4(MOCK2GAME);
    k.parts.push(bike);
    L.parts.push(Lm.mesh().geometry.applyMatrix4(MOCK2GAME));
    // rider: mockup person at (0, 0.8 - 0.62/MS, -0.12) inside the MS group => seat surface 0.8*MS - 0.124
    const rSeat = 0.8 * MS - 0.62 + SEAT_RAW * ADULT;
    const rx = -0.12 * MS;
    const rOut = outfitOf(s.rider, t.id === 'ojol' ? 'ojol' : 'rider');
    heads.push(seat(k, people, rOut, 'mockMotor', s.rider.helmet, rx, rSeat, 0, Math.PI / 2));
    const hl = t.len / 2, hw = t.wid / 2;
    const barY = 1.05 * MS;
    const seatTop = 0.8 * MS;
    solidH = seatTop;
    tops.push({ x0: 0.35, x1: hl, z0: -hw, z1: hw, y: barY }); // front + handlebar
    let backX = rx - 0.26;
    if (s.passenger && pOut) {
      // mockup: passenger at (-0.02, 0.81 - 0.62/MS, -0.55), turned -PI/2 (menyamping) => game x -0.55*MS
      const px = -0.55 * MS;
      const pSeat = 0.81 * MS - 0.62 + SEAT_RAW * ADULT;
      const ph = side
        ? seat(k, people, pOut, 'mockSamping', s.passenger.helmet, px, pSeat, 0.02 * MS, 0)
        : seat(k, people, pOut, pOut.kid ? 'kidMotor' : 'mockMotor', pOut.kid ? 0xffeb3b : s.passenger.helmet, px + (pOut.kid ? 0.1 : 0), pSeat, 0, Math.PI / 2);
      heads.push(ph);
      tops.push({ x0: px - 0.24, x1: backX, z0: -hw, z1: hw, y: ph });
      backX = px - 0.24;
    }
    tops.push({ x0: backX, x1: 0.35, z0: -hw, z1: hw, y: heads[0] }); // rider
    if (box !== undefined) tops.push({ x0: -hl, x1: backX, z0: -hw, z1: hw, y: 1.27 * MS });
    else tops.push({ x0: -hl, x1: backX, z0: -hw, z1: hw, y: seatTop }); // free back seat: a cat seat!
    if (!elec) exhaust = new THREE.Vector3(-hl + 0.1, 0.34, -0.2);
    // rain poncho over the rider(s) (shown on rainy days)
    const pk = new Kit();
    const pc = pick([0x1e88e5, 0xfdd835, 0xe53935, 0x7e57c2], () => (s.color % 97) / 97);
    pk.box(0.46, 0.62, 0.62, pc, rx + 0.04, rSeat + 0.42, 0).box(0.82, 0.08, 0.7, pc, rx + 0.12, rSeat + 0.1, 0).box(0.3, 0.4, 0.66, pc, rx + 0.28, rSeat + 0.3, 0, 0, 0, -0.5);
    if (s.passenger) pk.box(0.44, 0.58, 0.6, pc, -0.55 * MS, rSeat + 0.4, 0);
    poncho = pk.mesh();
    poncho.visible = false;
  }
  const body = k.mesh(VMAT.body);
  const lamps = L.mesh(VMAT.lamp);
  body.add(people);
  root.add(body, lamps);
  if (poncho) body.add(poncho);
  return { root, body, lamps, glass: null, poncho, exhaust, tops, solidH, fit: { heads, roofIn } };
}

// ---------------- parked vehicles + street cart (scenery) ----------------
/** a solid column of a parked vehicle in its local frame (faces +x), from the ground up to y */
export interface ParkedCol { x0: number; x1: number; z0: number; z1: number; y: number }
export interface Parked { root: THREE.Group; cols: ParkedCol[] }

/** A parked Kenney Car Kit car exactly as the mockups build it (no driver, lamps unlit), facing +x, wheels on y = 0. */
export function buildParkedCar(type: string, color: number): Parked {
  const t = VTYPE[type];
  const { bodyParts, lampParts } = kenneyCarGeo(type, color);
  const tops = carTops(bodyParts, t.len / 2, t.wid / 2);
  const m = new THREE.Mesh(mergeGeometries([...bodyParts, ...lampParts]), VMAT.body);
  for (const g of [...bodyParts, ...lampParts]) g.dispose();
  const root = new THREE.Group();
  root.add(m);
  // merge neighbouring columns of (almost) the same height: fewer colliders, same shape
  const cols: ParkedCol[] = [];
  for (const c of tops) {
    const l = cols[cols.length - 1];
    if (l && Math.abs(l.y - c.y) < 0.08) { l.x1 = c.x1; l.y = Math.max(l.y, c.y); } else cols.push({ ...c });
  }
  return { root, cols };
}

/** A parked motorbike (the mockup's motor(), no rider), facing +x. */
export function buildParkedMotor(color: number, kind: 'matic' | 'bebek'): Parked {
  const km = new Kit(), L = new Kit();
  mockMotor(km, L, color, kind);
  km.parts.push(...L.parts);
  L.parts = [];
  const m = km.mesh();
  m.geometry.applyMatrix4(MOCK2GAME);
  const root = new THREE.Group();
  root.add(m);
  return { root, cols: [{ x0: -0.75 * MS, x1: 0.75 * MS, z0: -0.2, z1: 0.2, y: 0.8 * MS }] };
}

/** Gerobak bakso from the approved vehicles mockup (scratch lowpoly/chars/vehicles.ts gerobakBakso), 1:1.
 *  Mockup frame: pushed along +z, handles at -z. Returned turned to face +x. */
export function buildGerobak(): Parked {
  const k = new Kit();
  const bx = (w: number, h: number, d: number, c: number, x: number, y: number, z: number) => k.box(w, h, d, c, x, y, z);
  const wheel = (r: number, w: number, x: number, y: number, z: number, rim = 0xcfd8dc) => {
    k.add(new THREE.CylinderGeometry(r, r, w, 10), 0x2b2b33, x, y, z, 0, 0, Math.PI / 2);
    k.add(new THREE.CylinderGeometry(r * 0.5, r * 0.5, w + 0.01, 8), rim, x, y, z, 0, 0, Math.PI / 2);
  };
  wheel(0.3, 0.07, 0.46, 0.3, 0.05, 0xe0e0e0); wheel(0.3, 0.07, -0.46, 0.3, 0.05, 0xe0e0e0);
  bx(0.04, 0.04, 0.96, 0x9e9e9e, 0, 0.3, 0.05); // axle
  k.box(0.04, 0.04, 0.96, 0x9e9e9e, 0, 0.3, 0.05, Math.PI / 2);
  bx(0.8, 0.55, 1.7, 0x1e88e5, 0, 0.72, 0.05); // lemari
  bx(0.82, 0.05, 1.72, 0xeeeeee, 0, 1.0, 0.05); // meja atas
  bx(0.04, 0.4, 1.4, 0xbbdefb, 0.41, 0.74, 0.05); bx(0.04, 0.4, 1.4, 0xbbdefb, -0.41, 0.74, 0.05); // kaca samping
  // etalase kaca di depan: mie, bakso, mangkok
  bx(0.76, 0.42, 0.7, 0xe3f2fd, 0, 1.24, 0.45);
  for (let i = 0; i < 4; i++) k.add(new THREE.SphereGeometry(0.06, 6, 4), 0x8d6e63, -0.2 + i * 0.13, 1.1, 0.45);
  for (let i = 0; i < 3; i++) bx(0.16, 0.08, 0.16, 0xfff3e0, -0.22 + i * 0.22, 1.32, 0.3);
  // dandang (panci besar) di belakang
  k.add(new THREE.CylinderGeometry(0.24, 0.24, 0.42, 10), 0xb0bec5, 0, 1.24, -0.42);
  k.add(new THREE.CylinderGeometry(0.08, 0.26, 0.08, 10), 0x90a4ae, 0, 1.49, -0.42);
  // tiang + atap
  for (const x of [-0.38, 0.38]) for (const z of [-0.75, 0.85]) bx(0.05, 0.85, 0.05, 0x8d6e63, x, 1.45, z);
  bx(1.0, 0.06, 1.95, 0xe53935, 0, 1.9, 0.05);
  // pegangan dorong di belakang + kaki penyangga depan
  for (const x of [-0.3, 0.3]) bx(0.05, 0.05, 0.5, 0x8d6e63, x, 0.7, -1.02);
  bx(0.66, 0.05, 0.05, 0x8d6e63, 0, 0.7, -1.26);
  bx(0.06, 0.44, 0.06, 0x8d6e63, 0, 0.22, 0.82);
  const g = new THREE.Group();
  g.add(k.mesh());
  // tulisan BAKSO di kedua sisi + depan
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const c = cv.getContext('2d')!;
  c.fillStyle = '#fff'; c.fillRect(0, 0, 256, 64); c.fillStyle = '#c62828'; c.font = 'bold 46px sans-serif'; c.textAlign = 'center'; c.fillText('BAKSO', 128, 49);
  const st = new THREE.CanvasTexture(cv); st.colorSpace = THREE.SRGBColorSpace;
  const sm = new THREE.MeshLambertMaterial({ map: st });
  const pl = (w: number, h: number) => new THREE.PlaneGeometry(w, h);
  const sg: THREE.BufferGeometry[] = [];
  sg.push(pl(1.0, 0.25).rotateY(Math.PI / 2).translate(0.43, 0.58, 0.05));
  sg.push(pl(1.0, 0.25).rotateY(-Math.PI / 2).translate(-0.43, 0.58, 0.05));
  sg.push(pl(0.9, 0.22).translate(0, 1.8, 1.03));
  g.add(new THREE.Mesh(mergeGeometries(sg), sm));
  for (const q of sg) q.dispose();
  const root = new THREE.Group();
  g.rotation.y = Math.PI / 2; // mockup +z -> game +x
  root.add(g);
  // cart body (lemari + etalase); the roof poles/awning are see-through for the cat
  return { root, cols: [{ x0: -0.8, x1: 0.9, z0: -0.42, z1: 0.42, y: 1.03 }, { x0: 0.1, x1: 0.8, z0: -0.38, z1: 0.38, y: 1.45 }] };
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
