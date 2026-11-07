// Road works ("Proyek jalan"): a temporary project on the east part of the street.
//
// A project starts on a random day and runs through stages, one per day:
//   gali  - cones close the eastbound lane, the excavator digs up the old asphalt
//   aspal - fresh soft black asphalt, the road roller rolls it flat (paw prints!)
//   baru  - 2 days of smooth new asphalt (with any paw prints the cat left, forever cute)
// then the street is back to normal until the next project.
// Traffic shares the westbound lane one direction at a time while the lane is closed.
//
// Mischief: ride the excavator bucket (ekskavator), stamp paw prints in the fresh
// asphalt (cap_kaki). The foreman (Pak Mandor) shoos the cat like the neighbours do.
import * as THREE from 'three';
import { ctx, clamp, rand, damp } from '../ctx';
import { L, tr, type Pair } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { doMischief } from './mischief';
import { buildExcavator, buildRoller, coneMesh, Kit, type Excavator } from '../entities/vehicles';
import { WORKS, LANE, type Mover } from './traffic';
import { signTex } from '../world/map';
import type { AABB } from '../world/builder';
import type { Human } from '../entities/npc';

const P = (id: string, en: string): Pair => ({ id, en });

export type WorksStage = '' | 'gali' | 'aspal' | 'baru';
export const WORKS_STAGES: WorksStage[] = ['gali', 'aspal', 'baru', 'baru'];
/** first day a project may start */
export const WORKS_FIRST_DAY = 3;

// the patch of road being repaired (eastbound lane)
const HOLE = { x0: 48.2, x1: 55.4, z0: -3.25, z1: -0.45 };
const EXC = { x: 45.4, z: -2.15 }; // excavator (tracks along x, digs towards +x)
const PILE = { x: 42.2, z: -2.2 };
const PRINTS_MAX = 28;

const LINES = {
  op: [P('Wah, ada kucing mau ikut kerja!', 'Oh, a cat wants to help out!'), P('Pegangan, Pus! Kita naik!', 'Hold on, kitty! Going up!')],
  opDown: P('Sudah ya, Pus. Turun dulu!', "That's it, kitty. Down you go!"),
  mandor: [P('Hati-hati, ada perbaikan jalan!', 'Careful, road works!'), P('Ayo, pelan-pelan saja!', 'Nice and slow now!'), P('Sebentar lagi jalannya mulus!', 'The road will be smooth soon!')],
  aspal: P('Waduh! Aspalnya masih basah!', 'Oh no! The asphalt is still wet!'),
  rest: P('Istirahat dulu ah...', 'Time for a little break...'),
  roller: P('Pus, minggir dulu ya!', 'Kitty, step aside please!'),
};

export class RoadWorks {
  stage: WorksStage = '';
  group = new THREE.Group();
  exc: Excavator;
  roller: { root: THREE.Group; drums: THREE.Mesh[] };
  rollerMover: Mover;
  cones: THREE.InstancedMesh;
  coneSpots: { x: number; z: number; fall: number; dir: number; t: number }[] = [];
  signs: THREE.Group = new THREE.Group();
  hole: THREE.Group = new THREE.Group();
  pile: THREE.Mesh;
  fresh: THREE.Mesh;
  newPatch: THREE.Mesh;
  prints: THREE.InstancedMesh;
  printN = 0;
  printT = 0;
  printSteps = 0;
  cols: AABB[] = [];
  mandor: Human | null = null;
  // excavator animation
  cyc = 0;
  phase = 'dig';
  restT = 0;
  restMode = false;
  /** bucket ride: 0 = none, 1 = up, 2 = hold, 3 = down */
  rideK = 0;
  rideT = 0;
  rideDone = false;
  ang = { cab: 0, boom: 0.3, stick: -1.6, bucket: -0.6 };
  goal = { cab: 0, boom: 0.3, stick: -1.6, bucket: -0.6 };
  sndT = 0;
  // roller
  rollX = HOLE.x0 + 1;
  rollDir = 1;
  rollWait = 0;
  rollBumpT = 0;
  private v = new THREE.Vector3();
  bucketPos = new THREE.Vector3();
  private m4 = new THREE.Matrix4();
  private q = new THREE.Quaternion();

  constructor() {
    const scene = ctx.scene as THREE.Scene;
    scene.add(this.group);
    // ---- excavator ----
    this.exc = buildExcavator();
    this.exc.root.position.set(EXC.x, 0, EXC.z);
    this.group.add(this.exc.root);
    // ---- road roller (a mover: the cat can bump into it or climb on) ----
    this.roller = buildRoller();
    this.group.add(this.roller.root);
    this.rollerMover = {
      x: 0, z: -1.85, yaw: 0, px: 0, pz: 0, pyaw: 0, hl: 1.6, hw: 0.75, solidH: 1.1, v: 0,
      tops: [
        { x0: -1.6, x1: -0.55, z0: -0.7, z1: 0.7, y: 1.5 }, // engine / seat deck
        { x0: 0.45, x1: 1.6, z0: -0.7, z1: 0.7, y: 1.1 }, // front drum
        { x0: -0.55, x1: 0.45, z0: -0.7, z1: 0.7, y: 1.1 },
      ],
      onBump: () => {
        this.rollBumpT = 1.6;
        ctx.bubbles.say(this.roller.root, L(LINES.roller), { ttl: 2, y: 2.9, kind: 'speech', key: 'roller' });
      },
    };
    // ---- cones (one instanced mesh, each can topple) ----
    const cm = coneMesh();
    const spots: [number, number][] = [];
    for (let x = WORKS.x0; x <= WORKS.x1 + 0.01; x += 1.8) spots.push([x, -0.2]);
    for (let i = 1; i <= 3; i++) spots.push([WORKS.x0 - i * 1.15, -0.2 - i * 0.85], [WORKS.x1 + i * 1.15, -0.2 - i * 0.85]);
    this.cones = new THREE.InstancedMesh(cm.geometry, cm.material as THREE.Material, spots.length);
    this.coneSpots = spots.map(([x, z]) => ({ x, z, fall: 0, dir: 1, t: 0 }));
    this.group.add(this.cones);
    // ---- signs: "hati-hati ada perbaikan jalan" boards at both ends ----
    const tex = signTex(['HATI-HATI!', 'ADA PERBAIKAN JALAN'], '#ff8f00', '#1b1b1b', 512, 256, 62);
    for (const [x, ry] of [[WORKS.x0 - 4.4, -Math.PI / 2], [WORKS.x1 + 4.4, Math.PI / 2]] as const) {
      const g = new THREE.Group();
      const k = new Kit();
      k.box(0.08, 1.0, 0.08, 0x616161, 0, 0.5, -0.45).box(0.08, 1.0, 0.08, 0x616161, 0, 0.5, 0.45);
      for (let i = 0; i < 4; i++) k.box(0.05, 0.16, 0.3, i % 2 ? 0xffffff : 0xe53935, 0.02, 0.18, -0.45 + i * 0.3);
      g.add(k.mesh());
      const board = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.6), new THREE.MeshBasicMaterial({ map: tex }));
      board.position.set(0.05, 1.25, 0);
      board.rotation.y = Math.PI / 2;
      const back = board.clone();
      back.rotation.y = -Math.PI / 2;
      back.position.x = -0.05;
      g.add(board, back);
      g.position.set(x, 0.15, -4.15);
      g.rotation.y = ry + Math.PI / 2;
      this.signs.add(g);
    }
    this.group.add(this.signs);
    // ---- the dug hole: dark soil, broken edges, a few chunks ----
    const hk = new Kit();
    const hx = (HOLE.x0 + HOLE.x1) / 2, hz = (HOLE.z0 + HOLE.z1) / 2;
    hk.box(HOLE.x1 - HOLE.x0, 0.02, HOLE.z1 - HOLE.z0, 0x6d5039, hx, 0.012, hz);
    for (let i = 0; i < 9; i++) hk.box(rand(0.3, 0.7), 0.06, rand(0.25, 0.5), 0x3e4248, rand(HOLE.x0 + 0.3, HOLE.x1 - 0.3), 0.04, rand(HOLE.z0 + 0.3, HOLE.z1 - 0.3), rand(0, 3));
    for (let x = HOLE.x0; x < HOLE.x1; x += 0.55) hk.box(0.5, 0.05, 0.14, 0x2f3236, x + 0.25, 0.03, HOLE.z1 + 0.04, rand(-0.2, 0.2));
    this.hole.add(hk.mesh());
    this.group.add(this.hole);
    // rubble pile (a few rough boxes)
    const pk = new Kit();
    for (let i = 0; i < 14; i++) pk.box(rand(0.3, 0.6), rand(0.15, 0.35), rand(0.3, 0.6), i % 3 ? 0x41454b : 0x6d5039, PILE.x + rand(-0.7, 0.7), rand(0.1, 0.5) * (1 - i / 20), PILE.z + rand(-0.6, 0.6), rand(0, 3), rand(-0.3, 0.3));
    this.pile = pk.mesh();
    this.group.add(this.pile);
    // fresh asphalt (glossy, still soft)
    this.fresh = new THREE.Mesh(new THREE.BoxGeometry(HOLE.x1 - HOLE.x0, 0.02, HOLE.z1 - HOLE.z0), new THREE.MeshPhongMaterial({ color: 0x17191c, shininess: 70, specular: 0x555555 }));
    this.fresh.position.set(hx, 0.016, hz);
    this.group.add(this.fresh);
    // new smooth patch (the days after)
    this.newPatch = new THREE.Mesh(new THREE.BoxGeometry(HOLE.x1 - HOLE.x0, 0.006, HOLE.z1 - HOLE.z0), new THREE.MeshLambertMaterial({ color: 0x33363b }));
    this.newPatch.position.set(hx, 0.015, hz);
    scene.add(this.newPatch);
    // paw prints (instanced, shown on fresh and new asphalt)
    const pc = document.createElement('canvas');
    pc.width = pc.height = 64;
    const g2 = pc.getContext('2d')!;
    g2.fillStyle = 'rgba(120,124,130,0.9)';
    const dot = (x: number, y: number, r: number) => {
      g2.beginPath();
      g2.ellipse(x, y, r, r * 1.15, 0, 0, Math.PI * 2);
      g2.fill();
    };
    dot(32, 40, 13);
    dot(17, 22, 6);
    dot(27, 14, 6);
    dot(38, 14, 6);
    dot(48, 22, 6);
    const ptex = new THREE.CanvasTexture(pc);
    ptex.colorSpace = THREE.SRGBColorSpace;
    this.prints = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.2, 0.2).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: ptex, transparent: true, depthWrite: false }), PRINTS_MAX);
    this.prints.count = 0;
    this.prints.renderOrder = 2;
    scene.add(this.prints);
    // ---- colliders (off unless the machines are out) ----
    const S = ctx.world.phys;
    const box = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tag: string): AABB => {
      const a: AABB = { minX: x0, minY: y0, minZ: z0, maxX: x1, maxY: y1, maxZ: z1, cam: false, off: true, tag };
      S.add(a);
      this.cols.push(a);
      return a;
    };
    // tracks (low: the cat hops on them) + the house on top
    box(EXC.x - 1.5, 0, EXC.z + 0.57, EXC.x + 1.5, 0.62, EXC.z + 1.13, 'exc');
    box(EXC.x - 1.5, 0, EXC.z - 1.13, EXC.x + 1.5, 0.62, EXC.z - 0.57, 'exc');
    box(EXC.x - 0.8, 0, EXC.z - 0.57, EXC.x + 0.8, 0.85, EXC.z + 0.57, 'exc');
    box(EXC.x - 1.55, 0.85, EXC.z - 0.95, EXC.x + 1.55, 1.62, EXC.z + 0.95, 'exc');
    // signs (so nobody walks through the posts)
    for (const s of this.signs.children) box(s.position.x - 0.12, 0, s.position.z - 0.55, s.position.x + 0.12, 1.7, s.position.z + 0.55, 'sign');
    // cat wall inside the closed lane? no: the cat is welcome (that's the fun), people walk around the cones.
    this.applyStage('');
    // interaction: hop into the resting bucket
    ctx.interact.add({
      id: 'ekskavator',
      mischief: 'ekskavator',
      label: 'a_ride',
      icon: '🚜',
      pos: this.bucketPos,
      r: 1.1,
      yTol: 1.0,
      enabled: () => this.canRide(),
      act: () => this.startRide(),
    });
  }

  // ---------------- schedule ----------------
  /** Which stage is today (n = day number)? Rolls a new project once per day. */
  stageFor(n: number): WorksStage {
    const f = ctx.forceWorks as WorksStage | 'none' | undefined;
    if (f === 'none') return '';
    if (f) return f;
    const w = ctx.save.works;
    if (w.start > 0) {
      const k = n - w.start;
      if (k >= 0 && k < WORKS_STAGES.length) return WORKS_STAGES[k];
    }
    if (w.rolled !== n) {
      w.rolled = n;
      const fresh = !ctx.save.mischief.ekskavator || !ctx.save.mischief.cap_kaki;
      const since = n - (w.start + WORKS_STAGES.length);
      const can = n >= WORKS_FIRST_DAY && (w.start === 0 || since >= 2);
      if (can && Math.random() < (fresh ? 0.45 : 0.28)) {
        w.start = n;
        w.prints = [];
        writeSave(ctx.save);
        return 'gali';
      }
      writeSave(ctx.save);
    }
    return '';
  }

  /** set up today's road (called by Day.resetWorld after the weather) */
  setup(n: number, weather: string) {
    this.applyStage(this.stageFor(n), weather);
  }

  get lane() {
    return this.stage === 'gali' || this.stage === 'aspal';
  }

  applyStage(st: WorksStage, weather = 'cerah') {
    this.stage = st;
    const work = this.lane;
    const night = weather === 'malam';
    this.group.visible = work;
    this.exc.root.visible = work;
    this.hole.visible = st === 'gali';
    this.pile.visible = st === 'gali';
    this.fresh.visible = st === 'aspal';
    this.roller.root.visible = st === 'aspal';
    this.newPatch.visible = st === 'baru';
    for (const c of this.cols) c.off = !work;
    // excavator: digging (gali), parked at the west end with the bucket down (aspal)
    this.cyc = rand(0, 3);
    this.phase = 'dig';
    this.restT = rand(18, 30);
    this.restMode = st === 'aspal' || night;
    this.rideK = 0;
    this.rideDone = false;
    this.exc.operator.visible = !night;
    Object.assign(this.ang, { cab: 0, boom: 0.6, stick: -1.5, bucket: 0.6 });
    if (this.restMode) Object.assign(this.ang, this.restPose());
    Object.assign(this.goal, this.ang);
    this.pose();
    // cones back up
    for (const c of this.coneSpots) {
      c.fall = 0;
      c.t = 0;
    }
    this.updCones();
    // roller
    this.rollX = HOLE.x0 + 1.2;
    this.rollDir = 1;
    this.rollWait = 0;
    const R = this.rollerMover;
    R.x = R.px = this.rollX;
    R.z = R.pz = -1.85;
    R.v = 0;
    this.roller.root.position.set(R.x, 0, R.z);
    const T = ctx.traffic;
    if (T) {
      T.movers = st === 'aspal' ? [R] : [];
      T.works = work;
    }
    // prints: fresh day starts clean, the "new road" days show the saved ones
    this.printN = 0;
    this.printSteps = 0;
    if (st === 'baru') for (const p of (ctx.save.works.prints || []) as number[][]) this.addPrint(p[0], p[1], p[2], false);
    this.prints.count = this.printN;
    this.prints.instanceMatrix.needsUpdate = true;
    // the foreman
    const m = this.mandor;
    if (m) {
      m.active = work && !night;
      m.reset();
    }
  }

  private restPose() {
    // bucket flat on the road next to the cones (abs bucket angle ~0)
    return { cab: -0.5, boom: 0.42, stick: -2.2, bucket: 1.78 };
  }

  // ---------------- excavator ----------------
  private pose() {
    const e = this.exc;
    e.cab.rotation.y = this.ang.cab;
    e.boom.rotation.z = this.ang.boom;
    e.stick.rotation.z = this.ang.stick;
    e.bucket.rotation.z = this.ang.bucket;
    e.root.updateMatrixWorld(true);
    e.bucketTip.getWorldPosition(this.bucketPos);
  }

  canRide() {
    if (!this.lane || this.rideK || !this.exc.operator.visible || ctx.cat.carrying) return false;
    if (!(this.phase === 'rest' || this.restMode)) return false;
    return this.bucketPos.y < 0.6 && Math.abs(Math.atan2(Math.sin(this.ang.cab - this.goal.cab), Math.cos(this.ang.cab - this.goal.cab))) < 0.05;
  }

  startRide() {
    const cat = ctx.cat;
    this.rideK = 1;
    this.rideT = 0;
    cat.setState('ride');
    cat.body.vx = cat.body.vz = cat.body.vy = 0;
    ctx.bubbles.say(this.exc.operator, L(LINES.op[0]), { ttl: 2.2, y: 0.9, kind: 'speech', key: 'operator' });
    sfx.meow(1.2);
    // lift the cat up high, bucket kept level (bucket = -(boom + stick))
    this.goal = { cab: 0.3, boom: 0.9, stick: -1.2, bucket: 0.3 };
  }

  private updRide(dt: number) {
    const cat = ctx.cat;
    this.rideT += dt;
    if (cat.state !== 'ride') {
      // something else took over (day end, menus)
      this.rideK = 0;
      this.goal = this.restPose();
      return;
    }
    if (this.rideK === 1 && this.rideT > 3) {
      this.rideK = 2;
      this.rideT = 0;
      if (!this.rideDone) {
        this.rideDone = true;
        doMischief('ekskavator');
      }
      ctx.bubbles.say(this.exc.operator, L(LINES.op[1]), { ttl: 2, y: 0.9, kind: 'speech', key: 'operator' });
    } else if (this.rideK === 2 && this.rideT > 2.2) {
      this.rideK = 3;
      this.rideT = 0;
      this.goal = this.restPose();
      ctx.bubbles.say(this.exc.operator, L(LINES.opDown), { ttl: 2, y: 0.9, kind: 'speech', key: 'operator' });
    } else if (this.rideK === 3 && this.rideT > 2.6) {
      this.rideK = 0;
      // hop out towards the open side
      const b = cat.body;
      cat.setState('free');
      b.vy = 4.5;
      b.vx = 0;
      b.vz = 1.6;
      b.onGround = false;
      cat.yaw = 0;
      if (!this.restMode) this.restT = 2;
      return;
    }
    // sit in the bucket
    const p = this.bucketPos;
    cat.body.x = p.x;
    cat.body.y = p.y - 0.12;
    cat.body.z = p.z;
    cat.yaw = this.ang.cab + Math.PI / 2;
    cat.syncModel();
  }

  private updExcavator(dt: number, playing: boolean) {
    if (this.rideK) this.updRide(dt);
    else if (this.restMode) this.goal = this.restPose();
    else {
      // dig cycle: reach into the hole, scoop, lift, swing to the pile, dump, swing back
      this.cyc += dt;
      const C = this.cyc;
      if (this.phase === 'rest') {
        this.goal = this.restPose();
        const catNear = Math.hypot(ctx.cat.body.x - this.bucketPos.x, ctx.cat.body.z - this.bucketPos.z) < 4;
        if (catNear && C > 10) this.cyc = 10;
        if (C > 14) {
          this.phase = 'dig';
          this.cyc = 0;
          this.restT = rand(22, 34);
        }
      } else {
        const T = 11;
        const k = C % T;
        if (k < 2.2) this.goal = { cab: 0, boom: 0.1, stick: -1.0, bucket: 0.6 }; // reach out and down into the hole
        else if (k < 3.6) this.goal = { cab: 0, boom: 0.2, stick: -1.75, bucket: 1.9 }; // drag in + curl: scoop
        else if (k < 5.2) this.goal = { cab: 0, boom: 0.75, stick: -1.6, bucket: 1.6 }; // lift
        else if (k < 7.4) this.goal = { cab: Math.PI, boom: 0.7, stick: -1.6, bucket: 1.6 }; // swing to the pile
        else if (k < 8.6) this.goal = { cab: Math.PI, boom: 0.6, stick: -1.5, bucket: -0.6 }; // dump
        else this.goal = { cab: 0, boom: 0.6, stick: -1.5, bucket: 0.6 }; // swing back
        const kp = (C - dt) % T;
        if (kp < 7.4 && k >= 7.4) {
          // rubble falls out of the bucket onto the pile
          const p = this.bucketPos;
          ctx.fx.burst(p.x, p.y, p.z, 0x41454b, 8, { speed: 1.2, up: 0.5, size: 0.12, life: 0.9, floor: 0.2, spread: 0.3 });
          const d = Math.hypot(ctx.cat.body.x - p.x, ctx.cat.body.z - p.z);
          if (playing) sfx.rubble(clamp(1.3 - d / 18, 0, 1));
        }
        if (kp < 2.2 && k >= 2.2 && playing) {
          const d = Math.hypot(ctx.cat.body.x - this.bucketPos.x, ctx.cat.body.z - this.bucketPos.z);
          sfx.rubble(clamp(1 - d / 18, 0, 0.7));
        }
        // a break now and then: the bucket rests on the road (time to hop in!)
        this.restT -= dt;
        if (this.restT <= 0 && k > 8.8) {
          this.phase = 'rest';
          this.cyc = 0;
          if (playing && Math.hypot(ctx.cat.body.x - EXC.x, ctx.cat.body.z - EXC.z) < 16) ctx.bubbles.say(this.exc.operator, L(LINES.rest), { ttl: 2.2, y: 0.9, kind: 'speech', key: 'operator' });
        }
      }
    }
    // joints follow their goals smoothly (the cab turns the short way)
    const A = this.ang, G = this.goal;
    const sp = this.rideK ? 1.4 : 2.2;
    let dc = G.cab - A.cab;
    while (dc > Math.PI) dc -= Math.PI * 2;
    while (dc < -Math.PI) dc += Math.PI * 2;
    A.cab += clamp(dc, -0.9 * dt, 0.9 * dt);
    A.cab = Math.atan2(Math.sin(A.cab), Math.cos(A.cab)); // keep it in -pi..pi
    A.boom = damp(A.boom, G.boom, sp, dt);
    A.stick = damp(A.stick, G.stick, sp, dt);
    A.bucket = damp(A.bucket, G.bucket, sp * 1.3, dt);
    this.pose();
    // engine rumble + exhaust puffs
    this.sndT -= dt;
    if (this.sndT <= 0 && this.exc.operator.visible) {
      this.sndT = 0.8;
      const d = Math.hypot(ctx.cat.body.x - EXC.x, ctx.cat.body.z - EXC.z);
      if (playing && d < 26) sfx.digger((1 - d / 26) * (this.phase === 'rest' && !this.rideK ? 0.35 : 0.8));
      if (d < 45) {
        const c = Math.cos(A.cab), s = Math.sin(A.cab);
        const lx = -0.85, lz = -0.55;
        ctx.fx.burst(EXC.x + lx * c + lz * s, 2.2, EXC.z - lx * s + lz * c, 0x707070, 1, { speed: 0.3, up: 0.7, size: 0.1, life: 1.1, g: -0.5, spread: 0.05 });
      }
    }
  }

  // ---------------- roller ----------------
  private updRoller(dt: number, playing: boolean) {
    const R = this.rollerMover;
    R.px = R.x;
    R.pz = R.z;
    R.pyaw = R.yaw;
    const x0 = HOLE.x0 + 1.1, x1 = HOLE.x1 - 1.1;
    let v = 0.85 * this.rollDir;
    if (this.rollWait > 0) {
      this.rollWait -= dt;
      v = 0;
    }
    if (this.rollBumpT > 0) {
      this.rollBumpT -= dt;
      v = 0;
    }
    // the cat in front: wait (it always stops for the cat)
    const cb = ctx.cat.body;
    const ahead = (cb.x - R.x) * this.rollDir;
    if (cb.y < 1.0 && ahead > 1.4 && ahead < 3.2 && Math.abs(cb.z - R.z) < 1.1) v = 0;
    R.v = Math.abs(v);
    R.x += v * dt;
    if (R.x > x1 || R.x < x0) {
      R.x = clamp(R.x, x0, x1);
      this.rollDir = -this.rollDir as 1 | -1;
      this.rollWait = 1.2;
    }
    R.yaw = 0;
    this.roller.root.position.set(R.x, 0, R.z);
    for (const d of this.roller.drums) d.rotation.z -= (v * dt) / 0.52;
    if (playing && v !== 0 && Math.random() < dt * 1.2) {
      const d = Math.hypot(cb.x - R.x, cb.z - R.z);
      if (d < 20) sfx.engine('diesel', (1 - d / 20) * 0.5, 0.4);
    }
  }

  // ---------------- paw prints ----------------
  addPrint(x: number, z: number, yaw: number, save = true) {
    if (this.printN >= PRINTS_MAX) return;
    this.q.setFromAxisAngle(this.v.set(0, 1, 0), yaw);
    this.m4.compose(this.v.set(x, 0.03, z), this.q, new THREE.Vector3(1, 1, 1));
    this.prints.setMatrixAt(this.printN++, this.m4);
    this.prints.count = this.printN;
    this.prints.instanceMatrix.needsUpdate = true;
    if (save) {
      const w = ctx.save.works;
      (w.prints ||= []).push([+x.toFixed(2), +z.toFixed(2), +yaw.toFixed(2)]);
      if (w.prints.length > PRINTS_MAX) w.prints.length = PRINTS_MAX;
    }
  }

  private updPrints(dt: number, playing: boolean) {
    const cat = ctx.cat;
    const b = cat.body;
    if (this.stage !== 'aspal' || !playing || cat.state !== 'free') return;
    const on = b.onGround && b.y < 0.15 && b.x > HOLE.x0 && b.x < HOLE.x1 && b.z > HOLE.z0 && b.z < HOLE.z1;
    if (!on) return;
    this.printT -= dt;
    const moving = Math.hypot(b.vx, b.vz) > 0.6;
    if (this.printT <= 0 && moving) {
      this.printT = 0.28;
      const side = this.printSteps % 2 ? 0.07 : -0.07;
      const c = Math.cos(cat.yaw), s = Math.sin(cat.yaw);
      this.addPrint(b.x + c * side, b.z - s * side, cat.yaw);
      this.printSteps++;
      if (this.printSteps === 1) {
        sfx.squish();
        ctx.bubbles.say(cat.model.root, tr('pawWet'), { ttl: 1.6, y: 1, kind: 'emote', key: 'catpaw' });
      } else if (this.printSteps % 3 === 0) sfx.squish();
      if (this.printSteps === 5) {
        doMischief('cap_kaki');
        writeSave(ctx.save);
        if (this.mandor?.active && Math.hypot(this.mandor.body.x - b.x, this.mandor.body.z - b.z) < 12) this.mandor.say(LINES.aspal, 2, 'shout');
      }
    }
  }

  // ---------------- cones ----------------
  private lastCat = { x: 0, z: 0 };
  private updCones(dt = 0) {
    const cb = ctx.cat.body;
    let any = false;
    // distance from the cone to the cat's path this frame (big steps on slow phones)
    const ax = this.lastCat.x, az = this.lastCat.z;
    const sx = cb.x - ax, sz = cb.z - az, sl = sx * sx + sz * sz;
    const segD = (x: number, z: number) => {
      const k = sl > 1e-6 ? clamp(((x - ax) * sx + (z - az) * sz) / sl, 0, 1) : 1;
      return Math.hypot(ax + sx * k - x, az + sz * k - z);
    };
    const fast = dt > 0 && sl < 4 && Math.sqrt(sl) / dt > 1.1;
    this.lastCat.x = cb.x;
    this.lastCat.z = cb.z;
    this.coneSpots.forEach((c, i) => {
      if (fast && c.fall === 0 && cb.y < 0.5 && segD(c.x, c.z) < 0.36) {
        c.fall = 0.001;
        c.dir = Math.atan2(sx, sz);
        sfx.cone();
      }
      if (c.fall > 0 && c.fall < 1) {
        c.fall = Math.min(1, c.fall + dt * 4);
        any = true;
      }
      // a fallen cone stands back up after a while (the foreman fixes it)
      if (c.fall >= 1) {
        c.t += dt;
        if (c.t > 14) {
          c.fall = 0;
          c.t = 0;
        }
        any = true;
      }
      const tip = (c.fall * Math.PI) / 2;
      this.q.setFromEuler(new THREE.Euler(Math.cos(c.dir) * tip, 0, -Math.sin(c.dir) * tip, 'YXZ'));
      this.m4.compose(this.v.set(c.x, c.fall > 0 ? 0.08 * c.fall : 0, c.z), this.q, new THREE.Vector3(1, 1, 1));
      this.cones.setMatrixAt(i, this.m4);
    });
    if (any || dt === 0) this.cones.instanceMatrix.needsUpdate = true;
  }

  update(dt: number) {
    if (!this.lane || dt <= 0) return;
    const playing = ctx.mode === 'play' && !ctx.paused;
    this.updExcavator(dt, playing);
    if (this.stage === 'aspal') {
      this.updRoller(dt, playing);
      this.updPrints(dt, playing);
    }
    this.updCones(dt);
    // the foreman says something now and then
    const m = this.mandor;
    if (m?.active && playing && Math.random() < dt * 0.05 && (m.state === 'patrol' || m.state === 'wait') && Math.hypot(ctx.cat.body.x - m.body.x, ctx.cat.body.z - m.body.z) < 12) m.say(LINES.mandor, 2.2);
    void LANE;
  }
}
