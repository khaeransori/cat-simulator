// Vehicle & road-works models ("Kendaraan & proyek jalan").
// Every vehicle is built from boxes merged into ONE vertex-coloured mesh (+ one small
// mesh for the lamps), so a car or motorbike costs only ~2 draw calls on a phone.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Pair } from '../i18n';

const P = (id: string, en: string): Pair => ({ id, en });

/** Shared materials: body parts use vertex colours, lamps are unlit (they "glow"). */
export const VMAT = {
  body: new THREE.MeshLambertMaterial({ vertexColors: true }),
  lamp: new THREE.MeshBasicMaterial({ vertexColors: true }),
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

// ---------------- random vehicle specs ----------------
export type Engine = 'bensin' | 'diesel' | 'listrik' | '2tak' | '4tak';
export type VKind = 'car' | 'motor';

export interface VTypeDef {
  id: string;
  kind: VKind;
  name: Pair;
  len: number; // along x (driving direction)
  wid: number;
  h: number;
  engines: Engine[];
  speed: [number, number]; // m/s cruising
  colors?: number[]; // fixed palette (taxi, angkot)
}

export const VTYPES: VTypeDef[] = [
  { id: 'sedan', kind: 'car', name: P('Sedan', 'Sedan'), len: 4.2, wid: 1.7, h: 1.4, engines: ['bensin', 'bensin', 'listrik'], speed: [6.5, 8.5] },
  { id: 'citycar', kind: 'car', name: P('Mobil Mungil', 'City Car'), len: 3.5, wid: 1.6, h: 1.5, engines: ['bensin', 'listrik', 'listrik'], speed: [6, 8] },
  { id: 'mpv', kind: 'car', name: P('Mobil Keluarga', 'Family Van'), len: 4.4, wid: 1.75, h: 1.75, engines: ['bensin', 'diesel', 'listrik'], speed: [6, 7.5] },
  { id: 'pickup', kind: 'car', name: P('Mobil Bak', 'Pickup'), len: 4.6, wid: 1.7, h: 1.6, engines: ['diesel', 'diesel', 'bensin'], speed: [5.5, 7] },
  { id: 'angkot', kind: 'car', name: P('Angkot', 'Minibus'), len: 4.0, wid: 1.65, h: 1.85, engines: ['bensin', 'diesel'], speed: [5.5, 7], colors: [0x2e9e4f, 0x1e88e5, 0xf9a825, 0xe53935] },
  { id: 'taksi', kind: 'car', name: P('Taksi', 'Taxi'), len: 4.2, wid: 1.7, h: 1.45, engines: ['bensin', 'listrik'], speed: [6.5, 8], colors: [0x3f8fd6] },
  { id: 'bebek', kind: 'motor', name: P('Motor Bebek', 'Moped'), len: 1.9, wid: 0.7, h: 1.6, engines: ['4tak', '4tak', '2tak'], speed: [6.5, 9] },
  { id: 'matic', kind: 'motor', name: P('Motor Matic', 'Scooter'), len: 1.85, wid: 0.72, h: 1.6, engines: ['4tak', 'listrik'], speed: [6, 8.5] },
  { id: 'sport', kind: 'motor', name: P('Motor Sport', 'Sport Bike'), len: 2.0, wid: 0.75, h: 1.55, engines: ['4tak', '2tak'], speed: [7.5, 10] },
  { id: 'ojol', kind: 'motor', name: P('Ojek Online', 'Ride-share Bike'), len: 1.85, wid: 0.72, h: 1.6, engines: ['4tak', 'listrik'], speed: [6.5, 9], colors: [0x1b5e20, 0x2e7d32] },
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

export interface VSpec {
  type: string;
  kind: VKind;
  color: number;
  engine: Engine;
  speed: number;
  /** motorbikes: rider shirt/helmet, maybe a passenger; cars: driver */
  rider: { shirt: number; helmet: number; skin: number };
  passenger: { shirt: number; helmet: number; skin: number } | null;
  cargo: number; // pickup cargo kind (0..2)
}

const pick = <T,>(a: T[], r: () => number) => a[Math.floor(r() * a.length) % a.length];

/** A random vehicle: type, paint, engine, driver... (kind forces car / motor). */
export function randomSpec(r: () => number = Math.random, kind?: VKind): VSpec {
  const pool = kind ? VTYPES.filter((t) => t.kind === kind) : VTYPES;
  const t = pick(pool, r);
  const person = () => ({ shirt: pick(SHIRTS, r), helmet: pick(HELMETS, r), skin: pick(SKINS, r) });
  const rider = person();
  if (t.id === 'ojol') rider.helmet = rider.shirt = 0x2e7d32;
  return {
    type: t.id,
    kind: t.kind,
    color: pick(t.colors || PAINT, r),
    engine: pick(t.engines, r),
    speed: t.speed[0] + r() * (t.speed[1] - t.speed[0]),
    rider,
    passenger: t.kind === 'motor' && t.id !== 'sport' && r() < 0.35 ? person() : null,
    cargo: Math.floor(r() * 3),
  };
}

const GLASS = 0x9fd3f0;
const TYRE = 0x262626;
const RIM = 0xb0bec5;
const DARK = 0x37474f;
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
  /** rain ponchos on motorbike riders (toggled by the weather) */
  poncho: THREE.Mesh | null;
  /** front-local x of the exhaust pipe (smoke puffs), or null for electric */
  exhaust: THREE.Vector3 | null;
}

/** Build a vehicle facing +x, wheels on y = 0. */
export function buildVehicle(s: VSpec): VehicleModel {
  const t = VTYPE[s.type];
  const k = new Kit();
  const L = new Kit();
  const c = s.color;
  const trim = c === 0xf5f5f5 ? 0x90a4ae : 0xf5f5f5;
  const elec = s.engine === 'listrik';
  let exhaust: THREE.Vector3 | null = null;
  let poncho: THREE.Mesh | null = null;
  const tops: Top[] = [];
  let solidH = 0.9;

  if (t.kind === 'car') {
    const hl = t.len / 2, hw = t.wid / 2;
    const wheelR = t.id === 'citycar' ? 0.3 : 0.34;
    const y0 = wheelR * 0.9; // body bottom
    const tall = t.id === 'mpv' || t.id === 'angkot';
    const belt = y0 + (tall ? 0.62 : 0.55); // top of the lower body
    solidH = belt;
    tops.push({ x0: -hl, x1: hl, z0: -hw, z1: hw, y: belt });
    // lower body
    k.box(t.len, belt - y0, t.wid, c, 0, (y0 + belt) / 2, 0);
    // bumpers
    k.box(0.12, 0.2, t.wid + 0.02, DARK, hl + 0.02, y0 + 0.12, 0);
    k.box(0.12, 0.2, t.wid + 0.02, DARK, -hl - 0.02, y0 + 0.12, 0);
    // cabin
    if (t.id === 'pickup') {
      const cx = hl - 1.35;
      tops.push({ x0: cx - 0.75, x1: cx + 0.75, z0: -hw + 0.04, z1: hw - 0.04, y: belt + 0.67 });
      k.box(1.5, 0.62, t.wid - 0.08, c, cx, belt + 0.31, 0);
      k.box(1.3, 0.48, t.wid - 0.04, GLASS, cx + 0.05, belt + 0.3, 0);
      k.box(1.52, 0.06, t.wid - 0.06, c, cx, belt + 0.64, 0);
      // open bed with low walls
      const bx0 = -hl + 0.05, bx1 = cx - 0.8;
      k.box(bx1 - bx0, 0.32, 0.06, c, (bx0 + bx1) / 2, belt + 0.16, hw - 0.03);
      k.box(bx1 - bx0, 0.32, 0.06, c, (bx0 + bx1) / 2, belt + 0.16, -hw + 0.03);
      k.box(0.06, 0.32, t.wid, c, bx0 + 0.03, belt + 0.16, 0);
      // cargo: water jugs / veggie crates / a sack of rice
      const mid = (bx0 + bx1) / 2;
      if (s.cargo === 0) for (const dz of [-0.4, 0.05, 0.5]) k.cyl(0.18, 0.5, 0x4fc3f7, mid + dz * 0.6, belt + 0.25, dz, true, 10).cyl(0.06, 0.08, 0x1565c0, mid + dz * 0.6, belt + 0.54, dz, true, 6);
      else if (s.cargo === 1) for (const [dx, dz, col] of [[-0.4, -0.35, 0x8bc34a], [0.35, 0.3, 0xff7043], [-0.3, 0.35, 0x8d6e63]] as const) k.box(0.55, 0.36, 0.5, 0xb48a5a, mid + dx, belt + 0.18, dz).box(0.5, 0.08, 0.45, col, mid + dx, belt + 0.38, dz);
      else k.box(0.9, 0.4, 0.7, 0xeeeeee, mid, belt + 0.2, 0).box(0.5, 0.02, 0.5, 0x43a047, mid, belt + 0.41, 0);
    } else {
      const roofH = tall ? 0.85 : t.id === 'citycar' ? 0.7 : 0.6;
      const front = t.id === 'sedan' || t.id === 'taksi' ? 1.0 : t.id === 'citycar' ? 0.55 : 0.5; // bonnet length
      const back = t.id === 'sedan' || t.id === 'taksi' ? 0.7 : 0.12;
      const cx0 = -hl + back, cx1 = hl - front;
      const cw = t.wid - 0.1;
      tops.push({ x0: cx0, x1: cx1, z0: -cw / 2, z1: cw / 2, y: belt + roofH + 0.07 });
      k.box(cx1 - cx0, roofH, cw, GLASS, (cx0 + cx1) / 2, belt + roofH / 2, 0);
      // pillars + roof
      k.box(cx1 - cx0 + 0.02, 0.07, cw + 0.02, c, (cx0 + cx1) / 2, belt + roofH + 0.03, 0);
      for (const x of [cx0 + 0.05, (cx0 + cx1) / 2, cx1 - 0.05]) for (const z of [cw / 2, -cw / 2]) k.box(0.1, roofH, 0.05, c, x, belt + roofH / 2, z);
      if (t.id === 'angkot') {
        // stripe + route board + open side door
        k.box(t.len + 0.01, 0.12, t.wid + 0.02, 0xffffff, 0, belt - 0.12, 0);
        k.box(1.0, 0.22, 0.04, 0xffffff, cx1 - 0.7, belt + roofH + 0.2, 0);
        k.box(0.9, 0.12, 0.05, 0x263238, cx1 - 0.7, belt + roofH + 0.2, 0);
      }
      if (t.id === 'taksi') k.box(0.5, 0.16, 0.3, 0xfff59d, (cx0 + cx1) / 2, belt + roofH + 0.15, 0);
      if (t.id === 'mpv') {
        // roof rails
        for (const z of [cw / 2 - 0.08, -cw / 2 + 0.08]) k.box(cx1 - cx0 - 0.4, 0.05, 0.05, DARK, (cx0 + cx1) / 2, belt + roofH + 0.1, z);
      }
      // driver: head + shoulders behind the windscreen (the cars drive on the left: right-hand drive)
      k.box(0.36, 0.3, 0.42, s.rider.shirt, cx1 - 0.55, belt + 0.12, 0.33);
      k.box(0.26, 0.26, 0.26, s.rider.skin, cx1 - 0.55, belt + 0.4, 0.33);
      k.box(0.28, 0.08, 0.28, 0x2a1c14, cx1 - 0.55, belt + 0.55, 0.33);
    }
    // side trim line + door handles
    k.box(t.len * 0.86, 0.04, t.wid + 0.01, trim, 0, belt - 0.05, 0);
    // electric: a little blue badge on the doors (and no exhaust)
    if (elec) for (const z of [hw + 0.006, -hw - 0.006]) k.box(0.28, 0.12, 0.012, 0x00b0ff, 0.15, (y0 + belt) / 2, z);
    else exhaust = new THREE.Vector3(-hl - 0.08, y0 + 0.06, -hw + 0.3);
    if (exhaust) k.box(0.22, 0.09, 0.09, 0x9e9e9e, -hl - 0.02, y0 + 0.06, -hw + 0.3);
    // wheels
    for (const x of [hl - 0.75, -hl + 0.75]) for (const z of [hw - 0.12, -hw + 0.12]) k.cyl(wheelR, 0.24, TYRE, x, wheelR, z).cyl(wheelR * 0.5, 0.26, RIM, x, wheelR, z, false, 8);
    // plates
    for (const x of [hl + 0.09, -hl - 0.09]) k.box(0.02, 0.12, 0.42, 0x111111, x, y0 + 0.3, 0).box(0.025, 0.07, 0.36, 0xfafafa, x, y0 + 0.3, 0);
    // lamps
    for (const z of [hw - 0.25, -hw + 0.25]) {
      L.box(0.05, 0.14, 0.32, HEAD, hl + 0.005, belt - 0.16, z);
      L.box(0.05, 0.12, 0.26, TAIL, -hl - 0.005, belt - 0.14, z);
    }
  } else {
    // ---------- motorbike ----------
    const hl = t.len / 2;
    const wr = t.id === 'matic' || t.id === 'ojol' ? 0.27 : 0.3;
    const sport = t.id === 'sport';
    // wheels
    for (const x of [hl - wr, -hl + wr]) k.cyl(wr, 0.12, TYRE, x, wr, 0).cyl(wr * 0.55, 0.14, RIM, x, wr, 0, false, 8);
    if (t.id === 'matic' || t.id === 'ojol') {
      // scooter: low deck, front shield, body under the seat
      k.box(0.7, 0.12, 0.42, DARK, 0.15, 0.36, 0);
      k.box(0.18, 0.75, 0.46, c, hl - 0.48, 0.66, 0, 0, 0, -0.25);
      k.box(0.8, 0.36, 0.48, c, -0.4, 0.62, 0);
      k.box(0.7, 0.1, 0.36, 0x212121, -0.38, 0.85, 0);
    } else if (t.id === 'bebek') {
      k.box(0.9, 0.14, 0.2, c, 0.15, 0.6, 0, 0, 0, 0.35);
      k.box(0.25, 0.5, 0.42, c, hl - 0.48, 0.66, 0, 0, 0, -0.3);
      k.box(0.8, 0.32, 0.36, c, -0.35, 0.62, 0);
      k.box(0.7, 0.1, 0.32, 0x212121, -0.35, 0.83, 0);
      k.box(0.45, 0.22, 0.24, 0x616161, 0.0, 0.42, 0);
    } else {
      // sport: tank + fairing + raised tail
      k.box(0.65, 0.3, 0.42, c, 0.25, 0.78, 0);
      k.box(0.4, 0.5, 0.46, c, hl - 0.45, 0.7, 0, 0, 0, -0.5);
      k.box(0.55, 0.16, 0.3, 0x212121, -0.3, 0.86, 0);
      k.box(0.5, 0.2, 0.26, c, -0.6, 0.92, 0, 0, 0, 0.25);
      k.box(0.5, 0.32, 0.3, 0x616161, 0.05, 0.45, 0);
    }
    // fork + handlebar
    k.box(0.06, 0.62, 0.06, 0x9e9e9e, hl - wr - 0.02, 0.62, 0.12, 0, 0, -0.35).box(0.06, 0.62, 0.06, 0x9e9e9e, hl - wr - 0.02, 0.62, -0.12, 0, 0, -0.35);
    k.box(0.06, 0.05, 0.62, 0x212121, hl - 0.52, 1.0, 0);
    if (t.id === 'ojol') k.box(0.42, 0.42, 0.42, 0x2e7d32, -hl + 0.2, 1.08, 0).box(0.43, 0.08, 0.43, 0xffffff, -hl + 0.2, 1.1, 0);
    if (!elec) {
      exhaust = new THREE.Vector3(-hl + 0.05, 0.32, -0.2);
      k.box(0.6, 0.1, 0.1, 0x9e9e9e, -0.25, 0.32, -0.2);
    } else k.box(0.2, 0.08, 0.02, 0x00b0ff, -0.4, 0.62, 0.25);
    // rider (sits on the seat, hands on the bar)
    const rider = (p: { shirt: number; helmet: number; skin: number }, x: number, lean: number) => {
      k.box(0.34, 0.24, 0.4, 0x37474f, x, 0.95, 0); // hips
      k.box(0.5, 0.12, 0.12, 0x37474f, x + 0.25, 0.85, 0.16).box(0.5, 0.12, 0.12, 0x37474f, x + 0.25, 0.85, -0.16); // thighs
      k.box(0.12, 0.42, 0.12, 0x37474f, x + 0.48, 0.62, 0.17).box(0.12, 0.42, 0.12, 0x37474f, x + 0.48, 0.62, -0.17); // shins
      k.box(0.3, 0.52, 0.44, p.shirt, x + 0.06 + lean * 0.2, 1.33, 0, 0, 0, -lean);
      k.box(0.24, 0.24, 0.24, p.skin, x + 0.1 + lean * 0.35, 1.68, 0);
      k.box(0.34, 0.3, 0.32, p.helmet, x + 0.08 + lean * 0.35, 1.76, 0);
      k.box(0.06, 0.12, 0.26, 0x263238, x + 0.25 + lean * 0.35, 1.72, 0); // visor
    };
    const rx = sport ? -0.15 : -0.3;
    const hw = t.wid / 2;
    const seatY = sport ? 0.94 : 0.9;
    solidH = seatY;
    tops.push({ x0: hl - 0.75, x1: hl, z0: -hw, z1: hw, y: 1.05 }); // front + handlebar
    tops.push({ x0: rx - 0.2, x1: hl - 0.75, z0: -hw, z1: hw, y: 1.9 }); // rider
    if (s.passenger) {
      tops.push({ x0: rx - 0.65, x1: rx - 0.2, z0: -hw, z1: hw, y: 1.9 });
      tops.push({ x0: -hl, x1: rx - 0.65, z0: -hw, z1: hw, y: seatY });
    } else tops.push({ x0: -hl, x1: rx - 0.2, z0: -hw, z1: hw, y: seatY }); // free back seat: a cat seat!
    rider(s.rider, rx, sport ? 0.55 : 0.2);
    // arms to the bar
    k.box(0.5, 0.1, 0.1, s.rider.shirt, rx + 0.42, 1.25, 0.24, 0, 0, sport ? 0.2 : 0.35).box(0.5, 0.1, 0.1, s.rider.shirt, rx + 0.42, 1.25, -0.24, 0, 0, sport ? 0.2 : 0.35);
    if (s.passenger) rider(s.passenger, rx - 0.45, 0.05);
    // rain poncho over the rider(s) (shown on rainy days)
    const pk = new Kit();
    const pc = pick([0x1e88e5, 0xfdd835, 0xe53935, 0x7e57c2], () => (s.color % 97) / 97);
    pk.box(0.5, 0.6, 0.6, pc, rx + 0.08, 1.3, 0).box(0.75, 0.08, 0.66, pc, rx + 0.1, 1.0, 0);
    if (s.passenger) pk.box(0.46, 0.58, 0.58, pc, rx - 0.38, 1.3, 0);
    poncho = pk.mesh();
    poncho.visible = false;
    // lamps: head lamp + tail lamp
    L.box(0.06, 0.12, 0.16, HEAD, hl - 0.38, 0.92, 0);
    L.box(0.05, 0.08, 0.14, TAIL, -hl + 0.06, sport ? 0.95 : 0.78, 0);
  }
  const root = new THREE.Group();
  const body = k.mesh(VMAT.body);
  const lamps = L.mesh(VMAT.lamp);
  root.add(body, lamps);
  if (poncho) root.add(poncho);
  return { root, body, lamps, poncho, exhaust, tops, solidH };
}

// ---------------- road-works machines ----------------
export interface Excavator {
  root: THREE.Group;
  cab: THREE.Group; // turns (yaw)
  boom: THREE.Group; // pitch at the cab pivot
  stick: THREE.Group; // pitch at the boom tip
  bucket: THREE.Group; // pitch at the stick tip
  bucketTip: THREE.Object3D; // the bucket's mouth (where the cat sits)
  operator: THREE.Mesh;
}

/** Yellow excavator facing +x. Joint angles: boom.rotation.z, stick.rotation.z, bucket.rotation.z. */
export function buildExcavator(): Excavator {
  const Y = 0xfbc02d, YD = 0xf9a825;
  const root = new THREE.Group();
  const base = new Kit();
  // tracks
  for (const z of [0.85, -0.85]) {
    base.box(3.0, 0.62, 0.55, 0x2b2b2b, 0, 0.31, z);
    for (let x = -1.25; x <= 1.26; x += 0.5) base.cyl(0.18, 0.57, 0x555555, x, 0.24, z, false, 8);
  }
  base.box(1.6, 0.3, 1.2, 0x424242, 0, 0.7, 0);
  root.add(base.mesh());
  const cab = new THREE.Group();
  cab.position.y = 0.85;
  root.add(cab);
  const ck = new Kit();
  ck.box(2.4, 0.75, 1.9, Y, -0.35, 0.38, 0); // house
  ck.box(0.9, 0.7, 1.9, YD, -1.2, 0.35, 0); // counterweight
  ck.box(1.0, 1.05, 0.9, Y, 0.35, 1.25, 0.45); // cabin
  ck.box(0.86, 0.75, 0.92, GLASS, 0.4, 1.32, 0.45);
  ck.box(1.04, 0.06, 0.94, YD, 0.35, 1.8, 0.45);
  ck.box(0.7, 0.12, 0.7, 0x424242, -0.6, 0.82, -0.4); // engine hood
  ck.cyl(0.07, 0.6, 0x616161, -0.85, 1.05, -0.55, true, 6); // exhaust stack
  ck.box(0.04, 0.3, 0.6, 0x212121, -1.66, 0.4, 0); // stripes on counterweight
  cab.add(ck.mesh());
  // operator inside the cabin
  const ok = new Kit();
  ok.box(0.3, 0.36, 0.4, 0xff8f00, 0, 0, 0).box(0.24, 0.24, 0.24, 0xc68e5f, 0.02, 0.3, 0).box(0.3, 0.12, 0.3, 0xfdd835, 0.02, 0.46, 0);
  const operator = ok.mesh();
  operator.position.set(0.3, 1.1, 0.45);
  cab.add(operator);
  // boom (pivot at the front of the house)
  const boom = new THREE.Group();
  boom.position.set(0.7, 0.6, -0.25);
  cab.add(boom);
  const bk = new Kit();
  bk.box(2.9, 0.34, 0.36, Y, 1.45, 0, 0);
  bk.box(1.5, 0.12, 0.12, 0xbdbdbd, 0.9, -0.28, 0, 0, 0, 0.18);
  boom.add(bk.mesh());
  const stick = new THREE.Group();
  stick.position.set(2.9, 0, 0);
  boom.add(stick);
  const sk = new Kit();
  sk.box(2.0, 0.28, 0.3, YD, 1.0, 0, 0);
  sk.box(1.0, 0.1, 0.1, 0xbdbdbd, 0.6, 0.22, 0);
  stick.add(sk.mesh());
  const bucket = new THREE.Group();
  bucket.position.set(2.0, 0, 0);
  stick.add(bucket);
  const kk = new Kit();
  // open scoop: back plate + bottom + sides + teeth (opens towards +x when rotation.z = 0)
  kk.box(0.1, 0.62, 0.8, 0x424242, 0, -0.31, 0);
  kk.box(0.6, 0.08, 0.8, 0x424242, 0.28, -0.62, 0);
  kk.box(0.6, 0.55, 0.06, 0x424242, 0.28, -0.35, 0.4).box(0.6, 0.55, 0.06, 0x424242, 0.28, -0.35, -0.4);
  for (const z of [-0.3, -0.1, 0.1, 0.3]) kk.box(0.14, 0.06, 0.08, 0xbdbdbd, 0.62, -0.62, z);
  bucket.add(kk.mesh());
  const bucketTip = new THREE.Object3D();
  bucketTip.position.set(0.3, -0.5, 0);
  bucket.add(bucketTip);
  return { root, cab, boom, stick, bucket, bucketTip, operator };
}

/** Road roller ("mesin penggilas"), facing +x. drums[] spin while it drives. */
export function buildRoller() {
  const Y = 0xfbc02d;
  const root = new THREE.Group();
  const k = new Kit();
  k.box(1.6, 0.75, 1.4, Y, -0.4, 1.0, 0);
  k.box(0.9, 0.12, 1.5, 0x424242, -0.5, 1.44, 0);
  // canopy
  for (const [x, z] of [[-0.9, 0.6], [-0.9, -0.6], [0.0, 0.6], [0.0, -0.6]]) k.box(0.07, 1.0, 0.07, 0x424242, x, 1.95, z);
  k.box(1.1, 0.07, 1.4, Y, -0.45, 2.47, 0);
  // seat + driver
  k.box(0.4, 0.12, 0.4, 0x212121, -0.45, 1.56, 0);
  k.box(0.32, 0.4, 0.42, 0xff8f00, -0.45, 1.82, 0).box(0.24, 0.24, 0.24, 0xb87a4b, -0.42, 2.12, 0).box(0.3, 0.12, 0.3, 0xfdd835, -0.42, 2.28, 0);
  // frame to the front drum
  k.box(0.9, 0.3, 0.12, Y, 0.65, 0.95, 0.68).box(0.9, 0.3, 0.12, Y, 0.65, 0.95, -0.68);
  root.add(k.mesh());
  const drums: THREE.Mesh[] = [];
  for (const [x, r, w] of [[1.05, 0.55, 1.4], [-1.05, 0.5, 1.3]] as const) {
    const d = new Kit();
    d.cyl(r, w, 0x9e9e9e, 0, 0, 0, false, 16).box(r * 1.9, 0.06, w + 0.02, 0x757575, 0, 0, 0);
    const m = d.mesh();
    m.position.set(x, r, 0);
    root.add(m);
    drums.push(m);
  }
  return { root, drums };
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
