// Traffic ("Lalu lintas"): random cars & motorbikes drive through the kompleks street.
//
// Vehicles drive THROUGH the kompleks: they come from far down one of the outside
// roads (the main road past the east gate, with a boom barrier, or the cross road past
// the west end), drive along the street on the left-hand lane (Indonesia drives on the
// left), leave at the other end and vanish far down the road, out of sight. Every vehicle is random: type, paint, engine (sound +
// exhaust smoke), driver, passenger. Kid-safe by design: vehicles always brake for
// the cat and for people, honk "tin tin!", and never hit anyone.
//
// The cat can jump on a car (bonnet, roof, pickup bed) and ride along: that is the
// "numpang" mischief. Moving solids (vehicles, the road roller) are "movers": the
// static physics doesn't know them, so this file resolves the cat against them.
import * as THREE from 'three';
import { ctx, clamp, rand, pick } from '../ctx';
import { L, tr, type Pair } from '../i18n';
import { sfx } from '../audio';
import { buildVehicle, randomSpec, VTYPE, ENGINE_NAME, VMAT, type VSpec, type VehicleModel, type Top } from '../entities/vehicles';
import { buildBoomBarrier } from '../entities/vehicles';
import { doMischief } from './mischief';
import { blobShadow } from '../entities/cat';
import { PUDDLES } from './weather';
import type { Human } from '../entities/npc';

const P = (id: string, en: string): Pair => ({ id, en });

const LINES = {
  honk: P('TIN TIN!', 'BEEP BEEP!'),
  catRoad: [P('Pus, minggir dong!', 'Kitty, move aside please!'), P('Awas, ada kucing lewat!', 'Careful, a cat crossing!'), P('Hati-hati di jalan, Pus!', 'Be careful on the road, kitty!')],
  rider: [P('Lho? Ada kucing numpang!', 'Huh? A cat hitching a ride!'), P('Wah, penumpang berbulu!', 'Wow, a furry passenger!'), P('Pus, mau ikut ke mana?', 'Kitty, where are you going?')],
  exit: P('Turun dulu, Pus! Kucing nggak boleh ikut keluar.', "Hop off, kitty! Cats can't come outside."),
  bump: P('Eh, hampir! Hati-hati, Pus!', 'Whoa, close one! Careful, kitty!'),
  people: P('Silakan, lewat dulu.', 'Go ahead, after you.'),
};

// ---------------- movers (moving solids the cat can bump into or stand on) ----------------
export interface Mover {
  x: number;
  z: number;
  yaw: number; // root.rotation.y: local +x = world (cos yaw, -sin yaw)
  px: number;
  pz: number;
  pyaw: number;
  hl: number; // half length (local x)
  hw: number; // half width (local z)
  solidH: number; // height of the solid part when no top covers the spot
  tops: Top[];
  v: number;
  /** the cat bumped into it; front = in front of a moving mover */
  onBump?: (front: boolean) => void;
}

const toLocal = (m: Mover, x: number, z: number) => {
  const dx = x - m.x, dz = z - m.z;
  const c = Math.cos(m.yaw), s = Math.sin(m.yaw);
  return [dx * c - dz * s, dx * s + dz * c];
};
const toWorld = (m: Mover, lx: number, lz: number) => {
  const c = Math.cos(m.yaw), s = Math.sin(m.yaw);
  return [m.x + lx * c + lz * s, m.z - lx * s + lz * c];
};

// ---------------- paths ----------------
const STEP = 0.3;
/** Dense polyline with cumulative length and a speed limit per point. */
class Path {
  xs: Float32Array;
  zs: Float32Array;
  ss: Float32Array;
  vm: Float32Array;
  len: number;
  /** s of the warung stop (eastbound), -1 = none */
  stopS = -1;
  constructor(pb: PB) {
    const n = pb.xs.length;
    this.xs = Float32Array.from(pb.xs);
    this.zs = Float32Array.from(pb.zs);
    this.vm = Float32Array.from(pb.vm);
    this.ss = new Float32Array(n);
    for (let i = 1; i < n; i++) this.ss[i] = this.ss[i - 1] + Math.hypot(this.xs[i] - this.xs[i - 1], this.zs[i] - this.zs[i - 1]);
    this.len = this.ss[n - 1];
    if (pb.stopX !== null) {
      for (let i = 1; i < n; i++)
        if (this.xs[i - 1] < pb.stopX && this.xs[i] >= pb.stopX && this.zs[i] < 0) {
          this.stopS = this.ss[i];
          break;
        }
    }
  }
  /** index of the last point with ss <= s (hint = previous index, paths are walked forward) */
  idx(s: number, hint = 0) {
    let i = Math.max(0, Math.min(hint, this.ss.length - 2));
    if (this.ss[i] > s) i = 0;
    while (i < this.ss.length - 2 && this.ss[i + 1] <= s) i++;
    return i;
  }
  pose(s: number, hint: number, out: { x: number; z: number; yaw: number; i: number }) {
    const i = this.idx(s, hint);
    const j = i + 1;
    const seg = this.ss[j] - this.ss[i] || 1;
    const k = clamp((s - this.ss[i]) / seg, 0, 1);
    out.x = this.xs[i] + (this.xs[j] - this.xs[i]) * k;
    out.z = this.zs[i] + (this.zs[j] - this.zs[i]) * k;
    // heading from a short look-ahead (smooth through the point spacing)
    const a = Math.max(0, i - 1), b = Math.min(this.ss.length - 1, j + 2);
    out.yaw = Math.atan2(-(this.zs[b] - this.zs[a]), this.xs[b] - this.xs[a]);
    out.i = i;
    return out;
  }
}

class PB {
  xs: number[] = [];
  zs: number[] = [];
  vm: number[] = [];
  stopX: number | null = null;
  at(x: number, z: number, vm = 99) {
    this.xs.push(x);
    this.zs.push(z);
    this.vm.push(vm);
    return this;
  }
  get lx() {
    return this.xs[this.xs.length - 1];
  }
  get lz() {
    return this.zs[this.zs.length - 1];
  }
  lineTo(x: number, z: number, vm = 99) {
    const x0 = this.lx, z0 = this.lz;
    const n = Math.max(1, Math.ceil(Math.hypot(x - x0, z - z0) / STEP));
    for (let i = 1; i <= n; i++) this.at(x0 + ((x - x0) * i) / n, z0 + ((z - z0) * i) / n, vm);
    return this;
  }
  arc(cx: number, cz: number, r: number, a0: number, a1: number, vm: number) {
    const n = Math.max(2, Math.ceil((Math.abs(a1 - a0) * r) / STEP));
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      this.at(cx + r * Math.cos(a), cz + r * Math.sin(a), vm);
    }
    return this;
  }
  /** along the street from the current x to x1, lane z = zf(x), speed limit vf(x) */
  road(x1: number, zf: (x: number) => number, vf: (x: number) => number) {
    const x0 = this.lx;
    const n = Math.max(1, Math.ceil(Math.abs(x1 - x0) / STEP));
    for (let i = 1; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n;
      this.at(x, zf(x), vf(x));
    }
    return this;
  }
}

/** 1 inside [a, b], easing to 0 over `ramp` metres outside */
const bump = (x: number, a: number, b: number, ramp: number) => {
  const d = x < a ? a - x : x > b ? x - b : 0;
  if (d >= ramp) return 0;
  const k = 1 - d / ramp;
  return k * k * (3 - 2 * k);
};

export const LANE = 1.7;
/** road works lane closure (eastbound lane), see roadworks.ts */
export const WORKS = { x0: 40.5, x1: 56.6, seg0: 35.5, seg1: 62.5 };
const GATE_X = 65; // boom barrier
const zWest = (x: number) => LANE - 0.6 * bump(x, -41.6, -38.4, 3.2); // around the street cart
const zEast = (works: boolean) => (x: number) => -LANE + 1.35 * bump(x, -34.6, -29.6, 3.6) + (works ? 2 * LANE * bump(x, WORKS.x0, WORKS.x1, 4.5) : 0);
const vStreet = (works: boolean) => (x: number) => (x > 58 || x < -84 ? 3.6 : works && x > WORKS.seg0 && x < WORKS.seg1 ? 3.6 : 99);
/** where trips start and end: far down the outside roads, out of sight (and culled) */
const FAR = 78;
/** outside road lanes (left-hand traffic): east main road x 78.4..89.6, west cross road x -101.6..-94.4 */
const EX_S = 82.3, EX_N = 85.7; // east road: at 82.3 heading -z, at 85.7 heading +z
const WX_N = -96.3, WX_S = -99.7; // west road: at -96.3 heading +z, at -99.7 heading -z

/**
 * One trip through the kompleks.
 * westbound = in through the east gate, out at the west end; else the other way.
 * a / b = which way along the outside road the vehicle comes from / leaves to.
 */
function makePath(works: boolean, westbound: boolean, a: boolean, b: boolean, warung: boolean) {
  const pb = new PB();
  const H = Math.PI / 2, PI = Math.PI;
  if (westbound) {
    // in from the main road (from the south = left turn, from the north = right turn)
    if (a) pb.at(EX_S, FAR, 7).lineTo(EX_S, LANE + 2.5, 7).arc(EX_S - 2.5, LANE + 2.5, 2.5, 0, -H, 3);
    else pb.at(EX_N, -FAR, 7).lineTo(EX_N, LANE - 4, 7).arc(EX_N - 4, LANE - 4, 4, 0, H, 3.6);
    // along the street (westbound lane z = +LANE), out onto the cross road
    if (b) pb.road(WX_N + 2.5, zWest, vStreet(works)).arc(WX_N + 2.5, LANE + 2.5, 2.5, -H, -PI, 3).lineTo(WX_N, FAR, 7);
    else pb.road(WX_S + 4, zWest, vStreet(works)).arc(WX_S + 4, LANE - 4, 4, H, PI, 3.6).lineTo(WX_S, -FAR, 7);
  } else {
    // in from the cross road (from the south = left turn, from the north = right turn)
    if (a) pb.at(WX_N, -FAR, 7).lineTo(WX_N, -LANE - 2.5, 7).arc(WX_N + 2.5, -LANE - 2.5, 2.5, PI, H, 3);
    else pb.at(WX_S, FAR, 7).lineTo(WX_S, -LANE + 4, 7).arc(WX_S + 4, -LANE + 4, 4, PI, 1.5 * PI, 3.6);
    if (warung) pb.stopX = -56;
    // along the street (eastbound lane z = -LANE), out through the gate onto the main road
    if (b) pb.road(EX_S - 2.5, zEast(works), vStreet(works)).arc(EX_S - 2.5, -LANE - 2.5, 2.5, H, 0, 3).lineTo(EX_S, -FAR, 7);
    else pb.road(EX_N - 4, zEast(works), vStreet(works)).arc(EX_N - 4, -LANE + 4, 4, -H, 0, 3.6).lineTo(EX_N, FAR, 7);
  }
  return new Path(pb);
}

// ---------------- vehicle ----------------
const ACC = 2.6; // m/s²
const BRAKE = 7; // m/s² (actual)
const PLAN = 4.5; // m/s² (used for planning: brakes early and gently)
let NEXT_ID = 1;

export class Vehicle implements Mover {
  id = NEXT_ID++;
  spec: VSpec;
  model: VehicleModel;
  root: THREE.Group;
  path: Path;
  s = 0;
  v = 0;
  cruise: number;
  x = 0;
  z = 0;
  yaw = 0;
  px = 0;
  pz = 0;
  pyaw = 0;
  hl: number;
  hw: number;
  solidH: number;
  tops: Top[];
  pi = 0;
  motor: boolean;
  shadow: THREE.Mesh;
  pool: THREE.Mesh;
  // behaviour
  waitT = 0; // stopped at the warung
  stopS: number;
  blockT = 0; // stopped for the cat
  honkT = 0;
  honks = 0;
  bumpT = 0;
  inSeg = false;
  dir: 1 | -1 = -1; // +1 heading east, -1 west (in the street)
  sndT = rand(0, 0.4);
  smokeT = rand(0, 1);
  wetT = 0;
  riderSaid = false;
  exitT = 0;
  done = false;
  private tmp = { x: 0, z: 0, yaw: 0, i: 0 };

  constructor(spec: VSpec, path: Path) {
    this.spec = spec;
    const t = VTYPE[spec.type];
    this.motor = t.kind === 'motor';
    this.model = buildVehicle(spec);
    this.root = this.model.root;
    this.hl = t.len / 2;
    this.hw = t.wid / 2;
    this.tops = this.model.tops;
    this.solidH = this.model.solidH;
    this.path = path;
    this.stopS = path.stopS;
    this.cruise = spec.speed;
    this.shadow = blobShadow(1);
    this.shadow.scale.set(t.len * 1.15, t.wid * 1.5, 1);
    this.shadow.position.y = 0.025;
    this.root.add(this.shadow);
    this.pool = new THREE.Mesh(Traffic.poolGeo, Traffic.poolMat);
    this.pool.position.set(this.hl + (this.motor ? 1.6 : 2.4), 0.035, 0);
    this.pool.scale.set(this.motor ? 0.6 : 1, 1, this.motor ? 0.5 : 1);
    this.pool.renderOrder = 2;
    this.root.add(this.pool);
    this.model.body.rotation.order = 'YXZ';
    ctx.scene.add(this.root);
  }

  place(s: number) {
    this.s = s;
    this.path.pose(s, 0, this.tmp);
    this.x = this.px = this.tmp.x;
    this.z = this.pz = this.tmp.z;
    this.yaw = this.pyaw = this.tmp.yaw;
    this.pi = this.tmp.i;
    if (this.stopS >= 0 && s > this.stopS - 5) this.stopS = -1;
    this.sync();
  }

  sync() {
    this.root.position.set(this.x, 0, this.z);
    this.root.rotation.y = this.yaw;
  }

  /** world point in local vehicle space */
  local(x: number, z: number) {
    return toLocal(this, x, z);
  }

  say(p: Pair | Pair[], ttl = 2, kind: 'speech' | 'shout' = 'speech') {
    const line = Array.isArray(p) ? pick(p) : p;
    ctx.bubbles.say(this.root, L(line), { ttl, y: (this.motor ? 1.9 : 1.6) + 0.5, kind, key: 'veh-' + this.id });
  }

  honk() {
    const d = Math.hypot(ctx.cat.body.x - this.x, ctx.cat.body.z - this.z);
    sfx.horn(this.motor, clamp(1.4 - d / 30, 0.3, 1));
    this.say(LINES.honk, 1.2, 'shout');
  }

  dispose() {
    ctx.scene.remove(this.root);
    ctx.bubbles.clear?.('veh-' + this.id);
    this.model.body.geometry.dispose();
    this.model.lamps.geometry.dispose();
    this.model.poncho?.geometry.dispose();
  }
}

// ---------------- traffic system ----------------
export class Traffic {
  static poolGeo: THREE.BufferGeometry;
  static poolMat: THREE.MeshBasicMaterial;
  vehicles: Vehicle[] = [];
  movers: Mover[] = []; // extra movers (road roller)
  spawnT = 2;
  /** the two junctions with the outside roads (east, west): one vehicle at a time each */
  junction: (Vehicle | null)[] = [null, null];
  /** direction of the next spawned vehicle */
  nextWest = Math.random() < 0.5;
  /** shared lane at the road works: who drives through it now (0 = nobody) */
  seg = { dir: 0 as -1 | 0 | 1, n: 0 };
  works = false;
  night = false;
  rain = false;
  barrier: { root: THREE.Group; arm: THREE.Group; lamp: THREE.Mesh };
  barrierA = 0;
  /** cat riding on a mover (null = not) */
  ride: Mover | null = null;
  rideDist = 0;
  rideDone = false;
  rideHintDone = false;
  gateToastT = 0;
  /** debug/test: number of times a vehicle had to brake for the cat */
  stats = { braked: 0, honks: 0, spawned: 0, bumps: 0, closest: 99 };
  enabled = true;

  constructor() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d')!;
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
    gr.addColorStop(0, 'rgba(255,236,170,0.55)');
    gr.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    Traffic.poolGeo = new THREE.PlaneGeometry(4, 2.6).rotateX(-Math.PI / 2);
    Traffic.poolMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    this.barrier = buildBoomBarrier();
    this.barrier.root.position.set(GATE_X, 0, -LANE * 2.15);
    ctx.scene.add(this.barrier.root);
  }

  get max() {
    return ctx.save?.settings?.quality === 'low' ? 3 : 4;
  }

  /** new day (or menu): clear the street, set conditions, put 1-2 vehicles on the road */
  reset(works: boolean, weather: string) {
    for (const v of this.vehicles) v.dispose();
    this.vehicles = [];
    this.seg.dir = 0;
    this.seg.n = 0;
    this.junction[0] = this.junction[1] = null;
    this.works = works;
    this.night = weather === 'malam';
    this.rain = weather === 'hujan';
    this.ride = null;
    this.rideDist = 0;
    this.rideDone = false;
    this.rideHintDone = false;
    this.barrierA = 0;
    VMAT.lamp.color.setScalar(this.night ? 1 : this.rain ? 0.9 : 0.72);
    this.spawnT = rand(3, 6);
    const n = Math.random() < 0.5 ? 1 : 2;
    const used: number[] = [];
    for (let i = 0; i < n; i++) {
      const v = this.spawn();
      if (!v) break;
      // somewhere along the street, away from the others and not inside the works lane
      for (let k = 0; k < 20; k++) {
        const s = rand(v.path.len * 0.12, v.path.len * 0.8);
        v.place(s);
        const inSeg = works && v.x > WORKS.seg0 - 3 && v.x < WORKS.seg1 + 3;
        if (!inSeg && Math.abs(v.x) < 84 && Math.abs(v.z) < 3 && used.every((u) => Math.abs(u - s) > 25)) {
          used.push(s);
          break;
        }
      }
      v.v = v.cruise * 0.6;
    }
  }

  /** a new random vehicle at the start of a random route (null when the street is full) */
  spawn(spec?: Partial<VSpec>, kind?: 'car' | 'motor') {
    if (this.vehicles.length >= this.max + 2) return null;
    const sp = { ...randomSpec(Math.random, kind), ...(spec || {}) } as VSpec;
    if (spec?.type) {
      const t = VTYPE[spec.type];
      sp.kind = t.kind;
      if (!spec.color && t.colors) sp.color = pick(t.colors);
      if (!spec.engine) sp.engine = pick(t.engines);
    }
    const west = this.nextWest;
    this.nextWest = Math.random() < 0.5;
    const path = makePath(this.works, west, Math.random() < 0.5, Math.random() < 0.5, Math.random() < 0.3);
    const v = new Vehicle(sp, path);
    v.place(0);
    if (v.model.poncho) v.model.poncho.visible = this.rain;
    v.pool.visible = this.night;
    this.vehicles.push(v);
    this.stats.spawned++;
    return v;
  }

  // ---------------- per frame ----------------
  update(dt: number) {
    if (!this.enabled || dt <= 0) return;
    const playing = ctx.mode === 'play' && !ctx.paused;
    for (const v of this.vehicles) {
      v.px = v.x;
      v.pz = v.z;
      v.pyaw = v.yaw;
    }
    // spawn
    this.spawnT -= dt;
    if (this.spawnT <= 0) {
      this.spawnT = rand(4, 13);
      if (this.vehicles.length < this.max) {
        // entry lanes free?
        const busy = this.vehicles.some((v) => v.s < 14 && Math.abs(v.path.xs[0] - (this.nextWest ? EX_S : WX_N)) < 8);
        if (!busy) this.spawn();
        else this.spawnT = 2;
      }
    }
    // barrier: lifts while a vehicle is near the gate
    const near = this.vehicles.some((v) => Math.abs(v.x - GATE_X) < 11 && Math.abs(v.z) < 5);
    this.barrierA = clamp(this.barrierA + (near ? 1.7 : -1.1) * dt, 0, 1.45);
    this.barrier.arm.rotation.x = -this.barrierA;
    (this.barrier.lamp.material as THREE.MeshBasicMaterial).color.setHex(near && Math.floor(ctx.time * 3) % 2 ? 0xffb300 : 0x6d4c00);

    for (const v of this.vehicles) this.drive(v, dt, playing);
    // finished trips
    for (let i = this.vehicles.length - 1; i >= 0; i--)
      if (this.vehicles[i].done) {
        const v = this.vehicles[i];
        if (v.inSeg) this.leaveSeg(v);
        if (this.ride === v) this.ride = null;
        for (let j = 0; j < 2; j++) if (this.junction[j] === v) this.junction[j] = null;
        v.dispose();
        this.vehicles.splice(i, 1);
      }
    // movers from other systems (road roller) are moved by their owners before this
    this.resolveCat(dt, playing);
    // distance culling (fog hides far ones anyway)
    // (cull where the fog is nearly opaque, so far-away vehicles fade out instead of popping)
    const cp = ctx.camera.position;
    const fog = ctx.scene.fog as THREE.Fog | null;
    const cull = fog ? Math.min(110, fog.far * 0.95) : 90;
    for (const v of this.vehicles) v.root.visible = (v.x - cp.x) ** 2 + (v.z - cp.z) ** 2 < cull * cull;
  }

  private enterSeg(v: Vehicle) {
    v.inSeg = true;
    this.seg.dir = v.dir;
    this.seg.n++;
  }
  private leaveSeg(v: Vehicle) {
    v.inSeg = false;
    this.seg.n = Math.max(0, this.seg.n - 1);
    if (!this.seg.n) this.seg.dir = 0;
  }

  private drive(v: Vehicle, dt: number, playing: boolean) {
    const cat = ctx.cat;
    const cb = cat.body;
    const path = v.path;
    // street direction from the heading (cos yaw > 0: east)
    v.dir = Math.cos(v.yaw) > 0 ? 1 : -1;
    let target = v.cruise * (this.rain ? 0.85 : 1);
    // path speed limits ahead (corners, gate, works)
    for (let k = 0; k <= 16; k += 1.5) {
      const i = path.idx(v.s + k, v.pi);
      const vm = path.vm[i];
      if (vm < 98) target = Math.min(target, Math.sqrt(vm * vm + 2 * PLAN * Math.max(0, k - v.hl)));
    }
    const stopAt = (gap: number) => {
      target = Math.min(target, gap <= 0.05 ? 0 : Math.sqrt(2 * PLAN * gap));
    };
    // follow the vehicle ahead
    for (const o of this.vehicles) {
      if (o === v) continue;
      const [lx, lz] = v.local(o.x, o.z);
      if (lx <= 0 || lx > 30 || Math.abs(lz) > 1.6) continue;
      if (Math.cos(o.yaw - v.yaw) < -0.5) continue; // oncoming (the works lane rule keeps them apart)
      const gap = lx - v.hl - o.hl - 1.8;
      target = Math.min(target, gap <= 0 ? Math.max(0, o.v - 0.5) : o.v + Math.sqrt(2 * PLAN * gap));
    }
    // the cat and people in front: always stop well before them
    let catBlocks = false;
    const riding = this.ride === v;
    const look = v.hl + 2.5 + (v.v * v.v) / (2 * PLAN);
    const consider = (x: number, y: number, z: number, isCat: boolean) => {
      if (y > 1.1) return;
      const [lx, lz] = v.local(x, z);
      if (lx < v.hl - 0.4 || lx > look + 1 || Math.abs(lz) > v.hw + 0.6) return;
      const gap = lx - v.hl - 1.1;
      stopAt(gap);
      if (isCat) {
        catBlocks = true;
        this.stats.closest = Math.min(this.stats.closest, Math.max(0, lx - v.hl));
      }
    };
    if (!riding && (cat.state !== 'hugged')) consider(cb.x, cb.y, cb.z, true);
    for (const h of ctx.npcs as Human[]) if (h.active) consider(h.body.x, h.body.y, h.body.z, false);
    const mama = ctx.day?.mama as Human | undefined;
    if (mama?.active) consider(mama.body.x, mama.body.y, mama.body.z, false);
    if (ctx.kids) for (const k of [ctx.kids.a, ctx.kids.b] as Human[]) if (k.active) consider(k.body.x, k.body.y, k.body.z, false);
    // stop for a moment at the warung
    if (v.stopS >= 0) {
      const gap = v.stopS - v.s;
      if (gap < -1) v.stopS = -1;
      else {
        stopAt(gap);
        if (gap < 0.4 && v.v < 0.3) {
          v.waitT = rand(3.5, 7);
          v.stopS = -1;
        }
      }
    }
    if (v.waitT > 0) {
      v.waitT -= dt;
      target = 0;
    }
    // boom barrier at the gate
    if (this.barrierA < 1.2) {
      const front = v.x + v.dir * v.hl;
      if (v.dir > 0 && front < GATE_X - 0.6 && Math.abs(v.z) < 4) stopAt(GATE_X - 0.9 - front);
      if (v.dir < 0 && front > GATE_X + 0.6 && Math.abs(v.z) < 4 && v.x < 79) stopAt(front - GATE_X - 0.9);
    }
    // the cat must not ride out of the kompleks (either end)
    if (riding && ((v.dir > 0 && v.x > 30) || (v.dir < 0 && v.x < -60))) {
      const gap = v.dir > 0 ? 58.5 - (v.x + v.hl) : v.x - v.hl - -83.5;
      stopAt(gap);
      if (gap < 1.5 && v.v < 0.3) {
        v.exitT += dt;
        if (v.exitT > 0.4 && v.exitT - dt <= 0.4) {
          v.honk();
          ctx.after(0.5, () => v.say(LINES.exit, 2.4));
        }
        if (v.exitT > 6 && cat.state === 'free') {
          // a gentle nudge off the back
          cat.knock(v.x + v.dir * v.hl, v.z, 3, 4);
          this.ride = null;
          v.exitT = 0;
        }
      }
    } else v.exitT = 0;
    // shared lane at the road works: one direction at a time
    if (this.works && !v.inSeg) {
      const front = v.x + v.dir * v.hl;
      const before = v.dir > 0 ? WORKS.seg0 - front : front - WORKS.seg1;
      const inStreet = Math.abs(v.z) < 4 && v.x > WORKS.seg0 - 30 && v.x < WORKS.seg1 + 30;
      if (inStreet && before > -0.5 && before < 2.5) {
        if (this.seg.dir === 0 || this.seg.dir === v.dir) this.enterSeg(v);
        else stopAt(before - 0.6);
      } else if (inStreet && before >= 2.5 && this.seg.dir !== 0 && this.seg.dir !== v.dir) stopAt(before - 0.6);
    }
    if (v.inSeg) {
      const rear = v.x - v.dir * v.hl;
      if ((v.dir > 0 && rear > WORKS.seg1) || (v.dir < 0 && rear < WORKS.seg0) || Math.abs(v.z) > 4) this.leaveSeg(v);
    }
    // junctions with the outside roads (in/out paths cross there): one at a time
    for (let j = 0; j < 2; j++) {
      const inJ = j === 0 ? (x: number, z: number) => x > 77.2 && x < 88.5 && z > -6.2 && z < 6.2 : (x: number, z: number) => x > -102.8 && x < -91.4 && z > -6.2 && z < 6.2;
      if (this.junction[j] === v && !inJ(v.x, v.z) && v.s > 20) this.junction[j] = null;
      if (this.junction[j] === v) continue;
      for (let k = 0; k <= 14; k += 0.5) {
        const i = path.idx(v.s + v.hl + k, v.pi);
        if (!inJ(path.xs[i], path.zs[i])) continue;
        const o = this.junction[j];
        if (o && o !== v && !o.done) stopAt(k - 0.6);
        else if (k < 2.5) this.junction[j] = v;
        break;
      }
    }
    if (v.bumpT > 0) {
      v.bumpT -= dt;
      target = 0;
    }
    // speed
    if (target > v.v) v.v = Math.min(target, v.v + ACC * dt);
    else v.v = Math.max(target, v.v - BRAKE * dt);
    if (target === 0 && v.v < 0.25) v.v = Math.max(0, v.v - BRAKE * dt);
    v.s += v.v * dt;
    if (v.s >= path.len - 0.5) {
      v.done = true;
      return;
    }
    path.pose(v.s, v.pi, (v as any).tmp);
    const t = (v as any).tmp;
    v.pi = t.i;
    v.x = t.x;
    v.z = t.z;
    v.yaw = t.yaw;
    // a little body roll/pitch for life: lean into turns (motorbikes), dip on braking
    const dyaw = Math.atan2(Math.sin(v.yaw - v.pyaw), Math.cos(v.yaw - v.pyaw)) / dt;
    if (v.motor) v.model.body.rotation.x = clamp(-dyaw * v.v * 0.06, -0.35, 0.35);
    v.sync();

    // honk at the cat (never at people: they just get a polite wave of a line)
    if (catBlocks && v.v < 0.3) {
      if (v.blockT === 0) this.stats.braked++;
      v.blockT += dt;
      v.honkT -= dt;
      if (v.blockT > 0.7 && v.honkT <= 0 && playing) {
        v.honk();
        this.stats.honks++;
        v.honkT = 3.2;
        v.honks++;
        if (v.honks === 2) ctx.after(0.6, () => v.say(LINES.catRoad, 2.2));
        if (!this.rideHintDone && !ctx.save.mischief.numpang && !v.motor) {
          this.rideHintDone = true;
          ctx.after(1.4, () => ctx.ui?.toast('💡 ' + tr('rideHint'), 3.4));
        }
      }
    } else {
      v.blockT = 0;
      v.honks = 0;
      v.honkT = Math.min(v.honkT, 0.2);
    }
    // the driver notices the furry passenger
    if (riding && !v.riderSaid && (this.rideDist > 10 || (v.v < 0.2 && this.rideDist > 3))) {
      v.riderSaid = true;
      v.say(LINES.rider, 2.4);
    }
    // engine sound & smoke
    const d = Math.hypot(cb.x - v.x, cb.z - v.z);
    v.sndT -= dt;
    if (v.sndT <= 0) {
      v.sndT = 0.42;
      if (playing && d < 24) {
        const k = 1 - d / 24;
        sfx.engine(v.spec.engine, k * k * (0.45 + 0.55 * clamp(v.v / 7, 0, 1)), 0.46);
      }
    }
    const ex = v.model.exhaust;
    v.smokeT -= dt;
    if (ex && v.smokeT <= 0 && d < 40) {
      const e = v.spec.engine;
      const accel = target > v.v + 0.3;
      v.smokeT = (e === 'diesel' ? 0.22 : e === '2tak' ? 0.3 : e === 'bensin' ? 0.9 : 1.3) * (accel ? 0.6 : 1) * rand(0.8, 1.3);
      const [wx, wz] = toWorld(v, ex.x, ex.z);
      const col = e === 'diesel' ? 0x5f5f5f : e === '2tak' ? 0xb8c4d6 : 0xd6d6d6;
      ctx.fx.burst(wx, ex.y, wz, col, 1, { speed: 0.35, up: 0.5, size: e === 'diesel' ? 0.1 : 0.07, life: 0.9, g: -0.6, spread: 0.05 });
    }
    // rain: splash through puddles
    if (this.rain && v.v > 2) {
      v.wetT -= dt;
      if (v.wetT <= 0) {
        v.wetT = 0.14;
        for (const [px, , pz, pr] of PUDDLES)
          if (Math.hypot(v.x - px, v.z - pz) < pr + v.hw * 0.6) {
            ctx.fx.burst(v.x, 0.05, v.z, 0x9fd3ff, 5, { speed: 2.4, up: 2.4, size: 0.06, life: 0.5, floor: 0.02, spread: v.hw });
            if (d < 12 && playing) sfx.puddle();
          }
      }
    }
  }

  /** the cat against moving solids: stand/ride on tops, get pushed out of the sides */
  private resolveCat(dt: number, playing: boolean) {
    const cat = ctx.cat;
    const b = cat.body;
    const st = cat.state;
    const all: Mover[] = [...this.vehicles, ...this.movers];
    // carry the riding cat with its mover (translation + turn)
    const r = this.ride;
    if (r && all.includes(r) && (st === 'free' || st === 'act' || st === 'knock')) {
      const dx = b.x - r.px, dz = b.z - r.pz;
      const c0 = Math.cos(r.pyaw), s0 = Math.sin(r.pyaw);
      const lx = dx * c0 - dz * s0, lz = dx * s0 + dz * c0;
      const [wx, wz] = toWorld(r, lx, lz);
      const moved = Math.hypot(wx - b.x, wz - b.z);
      b.x = wx;
      b.z = wz;
      cat.yaw += Math.atan2(Math.sin(r.yaw - r.pyaw), Math.cos(r.yaw - r.pyaw));
      if (r instanceof Vehicle) {
        this.rideDist += moved;
        if (this.rideDist > 3 && !this.rideDone) {
          this.rideDone = true;
          doMischief('numpang');
          const t = VTYPE[r.spec.type];
          ctx.after(1.6, () => ctx.ui?.toast(`${t.kind === 'motor' ? '🛵' : '🚗'} ${L(t.name)} · ${L(ENGINE_NAME[r.spec.engine])}`, 2.6));
        }
      }
    } else if (r) this.ride = null;
    if (st === 'hugged' || st === 'fish' || st === 'sleep' || (st === 'cut' && ctx.cutFreeze)) {
      this.ride = null;
      return;
    }
    let ridingNow: Mover | null = null;
    const R = b.r;
    for (const m of all) {
      let [lx, lz] = toLocal(m, b.x, b.z);
      if (Math.abs(lx) > m.hl + R + 0.4 || Math.abs(lz) > m.hw + R + 0.4) continue;
      const air = !b.onGround || b.vy > 0.1;
      const reach = air ? 0.55 : 0.27;
      // 1) stand on the highest column the cat can reach (centre over it)
      let top: Top | null = null;
      for (const t of m.tops) {
        const mg = air ? R : 0.06;
        if (lx < t.x0 - mg || lx > t.x1 + mg || lz < t.z0 - mg || lz > t.z1 + mg) continue;
        if (t.y > b.y + reach) continue;
        if (!top || t.y > top.y) top = t;
      }
      if (top && b.y <= top.y + 0.2 && b.vy <= 1.2) {
        lx = clamp(lx, top.x0 + 0.02, top.x1 - 0.02);
        lz = clamp(lz, top.z0 + 0.02, top.z1 - 0.02);
        b.y = top.y;
        b.vy = 0;
        b.onGround = true;
        cat.airTime = 0;
        ridingNow = m;
      }
      // 2) pushed out of columns taller than the cat (except one it is jumping onto)
      let front = false;
      for (const t of m.tops) {
        if (t.y <= b.y + 0.03) continue;
        if (air && t.y <= b.y + 0.55) continue;
        if (lx <= t.x0 - R || lx >= t.x1 + R || lz <= t.z0 - R || lz >= t.z1 + R) continue;
        const pl = lx - (t.x0 - R), pr = t.x1 + R - lx, pb = lz - (t.z0 - R), pf = t.z1 + R - lz;
        const mn = Math.min(pl, pr, pb, pf);
        if (mn === pr) {
          lx = t.x1 + R + 0.01;
          if (t.x1 >= m.hl - 0.05 && b.y < 0.3) front = true;
        } else if (mn === pl) lx = t.x0 - R - 0.01;
        else if (mn === pf) lz = t.z1 + R + 0.01;
        else lz = t.z0 - R - 0.01;
      }
      const [wx, wz] = toWorld(m, lx, lz);
      b.x = wx;
      b.z = wz;
      if (front && m.v > 0.4) {
        // a moving vehicle reached the cat: stop dead, nudge the cat aside (never hit)
        this.stats.bumps++;
        m.onBump?.(true);
        if (m instanceof Vehicle) {
          m.v = 0;
          m.bumpT = 1.2;
          if (playing) {
            m.honk();
            ctx.after(0.4, () => m.say(LINES.bump, 2));
          }
        }
        const [sx, sz] = toWorld(m, lx, Math.sign(lz || 1) * (m.hw + 0.9));
        b.vx = (sx - b.x) * 3;
        b.vz = (sz - b.z) * 3;
      }
    }
    if (ridingNow !== this.ride) {
      if (ridingNow) {
        this.rideDist = 0;
        this.rideDone = false;
        if (ridingNow instanceof Vehicle) ridingNow.riderSaid = false;
      }
      this.ride = ridingNow;
    }
    if (ridingNow || this.ride) {
      cat.syncModel();
      cat.shadow.position.set(b.x, b.y + 0.02, b.z);
      cat.shadow.scale.set(1, 1, 1);
    }
    // the gate: cats stay inside the kompleks (also when riding)
    if (b.x > 63.6 && Math.abs(b.z) < 4) {
      b.x = 63.6;
      if (this.ride) this.ride = null;
    }
    if (b.x < -87.6 && Math.abs(b.z) < 5) {
      b.x = -87.6;
      if (this.ride) this.ride = null;
    }
    this.gateToastT -= dt;
    if (playing && (b.x > 62.4 || b.x < -86.6) && Math.abs(b.z) < 3.6 && this.gateToastT <= 0) {
      this.gateToastT = 12;
      ctx.ui?.toast('🚧 ' + tr('gateNo'), 2.8);
    }
  }

  /** debug: a vehicle right in front of the cat, driving towards it */
  testCar(spec?: Partial<VSpec>, ahead = 18) {
    const v = this.spawn(spec || { type: 'sedan' }, 'car');
    if (!v) return null;
    const cb = ctx.cat.body;
    // the closest point of the path, then back off `ahead` metres
    let best = 0, bd = 1e9;
    for (let i = 0; i < v.path.xs.length; i += 2) {
      const d = (v.path.xs[i] - cb.x) ** 2 + (v.path.zs[i] - cb.z) ** 2;
      if (d < bd) (bd = d), (best = v.path.ss[i]);
    }
    v.place(Math.max(0, best - ahead));
    v.v = v.cruise;
    v.stopS = -1;
    return v;
  }
}
