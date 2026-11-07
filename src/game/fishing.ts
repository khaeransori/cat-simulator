import * as THREE from 'three';
import { ctx, rand, clamp } from '../ctx';
import { input } from '../input';
import { sfx } from '../audio';
import { L, tr, type Pair } from '../i18n';
import { mbox, StaticBuilder } from '../world/builder';
import { fishMesh, signTex } from '../world/map';
import { addCoins } from './mischief';
import { writeSave } from '../save';

const P = (id: string, en: string): Pair => ({ id, en });

export interface FishDef {
  id: string;
  name: Pair;
  icon: string;
  color: number;
  scale: number;
  w: number; // weight in its spot's table (emas: 0, it has its own chance)
  coins: number;
  spot: string; // SpotDef.id it lives in (album groups by this)
  cm: [number, number]; // random size range per catch
  rare?: boolean; // shiny + banner, harder to reel
  junk?: boolean; // not a fish (any-fish quests skip it)
  hard?: boolean; // narrower green zone (lele-like)
  mesh?: 'boot' | 'sandal' | 'crab' | 'frog';
}
export const FISH: FishDef[] = [
  // kolam taman (order of the first 5 is kept: old saves + pickFish use FISH[4] = emas)
  { id: 'kecil', name: P('Ikan Kecil', 'Little Fish'), icon: '🐟', color: 0x90a4ae, scale: 0.7, w: 45, coins: 2, spot: 'kolam', cm: [5, 12] },
  { id: 'mas', name: P('Ikan Mas', 'Carp'), icon: '🐠', color: 0xff8f00, scale: 1.0, w: 30, coins: 2, spot: 'kolam', cm: [15, 35] },
  { id: 'lele', name: P('Ikan Lele', 'Catfish'), icon: '🐡', color: 0x5d4037, scale: 1.15, w: 16, coins: 3, spot: 'kolam', cm: [20, 45], hard: true },
  { id: 'sepatu', name: P('Sepatu Bekas', 'Old Boot'), icon: '👢', color: 0x6d4c41, scale: 1, w: 7, coins: 0, spot: 'kolam', cm: [24, 30], junk: true, mesh: 'boot' },
  { id: 'emas', name: P('Ikan Emas Legendaris', 'Legendary Golden Fish'), icon: '✨', color: 0xffd54f, scale: 1.3, w: 0, coins: 10, spot: 'kolam', cm: [40, 60], rare: true },
  // got di jalan kompleks
  { id: 'cupang', name: P('Ikan Cupang', 'Betta Fish'), icon: '🐠', color: 0xd81b60, scale: 0.6, w: 42, coins: 2, spot: 'got', cm: [4, 7] },
  { id: 'berudu', name: P('Berudu', 'Tadpole'), icon: '🐸', color: 0x4e5b31, scale: 0.45, w: 34, coins: 2, spot: 'got', cm: [2, 5], mesh: 'frog' },
  { id: 'sandalJepit', name: P('Sandal Jepit', 'Flip-flop'), icon: '🩴', color: 0x26a69a, scale: 1, w: 20, coins: 0, spot: 'got', cm: [20, 26], junk: true, mesh: 'sandal' },
  { id: 'cupangRaja', name: P('Cupang Raja Pelangi', 'Rainbow King Betta'), icon: '👑', color: 0x7c4dff, scale: 0.8, w: 4, coins: 12, spot: 'got', cm: [7, 11], rare: true },
  // bak besar di Pasar Ikan
  { id: 'nila', name: P('Ikan Nila', 'Tilapia'), icon: '🐟', color: 0x78909c, scale: 1.0, w: 38, coins: 3, spot: 'bak', cm: [15, 30] },
  { id: 'belut', name: P('Belut', 'Eel'), icon: '🐍', color: 0x6d5a2e, scale: 1.0, w: 32, coins: 3, spot: 'bak', cm: [30, 60], hard: true },
  { id: 'kepiting', name: P('Kepiting Kecil', 'Little Crab'), icon: '🦀', color: 0xe64a19, scale: 1.0, w: 26, coins: 3, spot: 'bak', cm: [6, 14], mesh: 'crab' },
  { id: 'udangBiru', name: P('Udang Biru Ajaib', 'Magic Blue Prawn'), icon: '🦐', color: 0x1e88e5, scale: 0.9, w: 4, coins: 12, spot: 'bak', cm: [12, 20], rare: true },
  // tong air hujan di atap
  { id: 'koi', name: P('Ikan Koi', 'Koi'), icon: '🎏', color: 0xf4511e, scale: 1.0, w: 50, coins: 3, spot: 'tong', cm: [20, 40] },
  { id: 'guppy', name: P('Ikan Guppy', 'Guppy'), icon: '🐟', color: 0x26c6da, scale: 0.5, w: 46, coins: 2, spot: 'tong', cm: [3, 6] },
  { id: 'koiPelangi', name: P('Koi Pelangi', 'Rainbow Koi'), icon: '🌈', color: 0xff80ab, scale: 1.2, w: 4, coins: 15, spot: 'tong', cm: [35, 55], rare: true },
];
export const FBY: Record<string, FishDef> = Object.fromEntries(FISH.map((f) => [f.id, f]));

/**
 * Fishing spots. Each one is a SpotDef: where the cat sits, where the bobber lands,
 * which area it belongs to and when it is available. Its fish table is every FISH with
 * the same `spot` id (weights = FishDef.w, one `rare` per spot).
 * To add a spot (e.g. the river 'sungai'): add one entry here (seat/water as raw
 * coordinates or a world.pts name) plus its fish in FISH with `spot: 'sungai'`,
 * optionally a `build` for the props; the interactable, album group, badges, quest
 * fish and the guide arrow (target 'spot_sungai') all pick it up automatically.
 */
export interface SpotDef {
  id: string;
  name: Pair;
  icon: string;
  area: string; // mischief/area key (AREA_KEY)
  seat: THREE.Vector3 | string; // where the cat sits (world.pts name or position)
  water: THREE.Vector3 | string; // bobber centre (y = water surface)
  yaw: number; // cat/camera facing while fishing
  spread?: number; // random bobber offset sideways
  r?: number; // interact radius
  target: string; // quest target name (Quests.targetPoint)
  unlocked: () => boolean;
  build?: (S: StaticBuilder) => void; // static props for this spot (merged into one mesh)
}
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
const RY = 3.6; // rooftop height (map.ts)
export const SPOTS: SpotDef[] = [
  { id: 'kolam', name: P('Kolam Taman', 'Park Pond'), icon: '🪷', area: 'taman', seat: 'dock', water: V(-21.15, 0.05, 25), yaw: -Math.PI / 2, spread: 0.4, r: 1.3, target: 'dock', unlocked: () => true },
  {
    id: 'got', name: P('Got Jalan', 'Street Drain'), icon: '🕳️', area: 'jalan', seat: V(-4, 0.15, 4.25), water: V(-4, 0.03, 2.95), yaw: Math.PI, spread: 0.3, r: 1.1, target: 'spot_got', unlocked: () => true,
    build: (S) => {
      // open drain section by the curb: concrete rim, dark water, a bit of grate
      S.mm(-5.0, 0, 2.45, -3.0, 0.08, 2.6, 0x9e9a90, { collide: false });
      S.mm(-5.0, 0, 3.3, -3.0, 0.08, 3.45, 0x9e9a90, { collide: false });
      S.mm(-5.15, 0, 2.45, -5.0, 0.08, 3.45, 0x9e9a90, { collide: false });
      S.mm(-3.0, 0, 2.45, -2.85, 0.08, 3.45, 0x9e9a90, { collide: false });
      S.mm(-5.0, 0, 2.6, -3.0, 0.03, 3.3, 0x3d6b6e, { collide: false });
      for (let x = -4.95; x < -4.45; x += 0.12) S.mm(x, 0.03, 2.6, x + 0.05, 0.07, 3.3, 0x37474f, { collide: false });
      for (let x = -3.5; x < -3.0; x += 0.12) S.mm(x, 0.03, 2.6, x + 0.05, 0.07, 3.3, 0x37474f, { collide: false });
      S.mm(-4.3, 0.03, 2.75, -4.12, 0.06, 2.9, 0x6aa84f, { collide: false }); // little weed
    },
  },
  {
    id: 'bak', name: P('Bak Pasar Ikan', 'Market Fish Tub'), icon: '🛁', area: 'pasar', seat: V(26, 0, 30.55), water: V(26, 0.46, 31.95), yaw: 0, spread: 0.45, r: 1.2, target: 'spot_bak', unlocked: () => !!ctx.save.unlocked.pasar,
    build: (S) => {
      // big blue tub on short legs
      S.mm(24.9, 0, 31.2, 27.1, 0.42, 32.7, 0x1e88e5);
      S.mm(24.9, 0.42, 31.2, 27.1, 0.62, 32.7, 0, { visible: false }); // collider up to the rim
      S.mm(25.0, 0.42, 31.3, 27.0, 0.48, 32.6, 0x4fc3f7, { collide: false }); // water
      S.mm(24.85, 0.42, 31.15, 27.15, 0.62, 31.3, 0x0d47a1, { collide: false });
      S.mm(24.85, 0.42, 32.6, 27.15, 0.62, 32.75, 0x0d47a1, { collide: false });
      S.mm(24.85, 0.42, 31.15, 25.0, 0.62, 32.75, 0x0d47a1, { collide: false });
      S.mm(27.0, 0.42, 31.15, 27.15, 0.62, 32.75, 0x0d47a1, { collide: false });
      for (const [x, z] of [[25.6, 31.7], [26.5, 32.2]]) S.mm(x, 0.485, z, x + 0.3, 0.49, z + 0.12, 0x37474f, { collide: false }); // fish shadows
      S.box(27.6, 0, 32.2, 0.5, 0.4, 0.5, 0xf5f5f5, { top: 0xe0e0e0 }); // small bucket
    },
  },
  {
    id: 'tong', name: P('Tong Air Hujan', 'Rain Barrel'), icon: '🛢️', area: 'atap', seat: V(25.5, RY, -23.0), water: V(25.5, RY + 0.54, -24.55), yaw: Math.PI, spread: 0.3, r: 1.2, target: 'spot_tong', unlocked: () => !!ctx.save.unlocked.atap,
    build: (S) => {
      // wide low rain barrel with a gutter pipe
      S.mm(24.6, RY, -25.35, 26.4, RY + 0.5, -23.75, 0x43a047);
      S.mm(24.6, RY + 0.5, -25.35, 26.4, RY + 0.7, -23.75, 0, { visible: false });
      S.mm(24.7, RY + 0.5, -25.25, 26.3, RY + 0.56, -23.85, 0x5ab4e6, { collide: false }); // water
      S.mm(24.6, RY + 0.5, -25.35, 26.4, RY + 0.7, -25.2, 0x2e7d32, { collide: false });
      S.mm(24.6, RY + 0.5, -23.9, 26.4, RY + 0.7, -23.75, 0x2e7d32, { collide: false });
      S.mm(24.6, RY + 0.5, -25.35, 24.75, RY + 0.7, -23.75, 0x2e7d32, { collide: false });
      S.mm(26.25, RY + 0.5, -25.35, 26.4, RY + 0.7, -23.75, 0x2e7d32, { collide: false });
      S.mm(25.2, RY + 0.555, -24.9, 25.5, RY + 0.56, -24.78, 0xff7043, { collide: false }); // koi shadow
      S.mm(24.55, RY + 0.25, -25.4, 26.45, RY + 0.33, -23.7, 0x1b5e20, { collide: false });
      S.mm(25.3, RY + 0.65, -25.55, 25.5, RY + 1.9, -25.35, 0x9e9e9e, { collide: false });
      S.mm(25.3, RY + 1.7, -25.35, 25.5, RY + 1.9, -24.9, 0x9e9e9e, { collide: false });
      S.mm(26.6, RY, -24.9, 27.1, RY + 0.3, -24.4, 0x8d6e63, { top: 0xa1887f }); // little stool
    },
  },
];
export const SPOT_BY: Record<string, SpotDef> = Object.fromEntries(SPOTS.map((s) => [s.id, s]));
export const spotFish = (id: string) => FISH.filter((f) => f.spot === id);
export const spotOf = (fishId: string) => SPOT_BY[FBY[fishId]?.spot ?? 'kolam'];
export const isJunk = (fishId: string) => !!FBY[fishId]?.junk;
const pt = (p: THREE.Vector3 | string) => (typeof p === 'string' ? ctx.world.pts[p] : p);
export const spotSeat = (s: SpotDef) => pt(s.seat);

/** Fish a quest can ask for: from spots the player can reach, no legendary/rare ones. */
export function fishAvailable(): FishDef[] {
  return FISH.filter((f) => f.id !== 'emas' && !f.rare && SPOT_BY[f.spot]?.unlocked());
}

export class Fishing {
  active = false;
  phase: 'wait' | 'bite' | 'reel' | 'result' = 'wait';
  t = 0;
  waitFor = 2;
  marker = 0;
  dir = 1;
  zoneC = 0.5;
  zoneW = 0.28;
  speed = 1;
  hooked: FishDef | null = null;
  rod = new THREE.Group();
  tip = new THREE.Object3D();
  bobber = new THREE.Group();
  bobberBase = new THREE.Vector3();
  line: THREE.Line;
  flying: { obj: THREE.Object3D; t: number; from: THREE.Vector3; to: THREE.Vector3 } | null = null;
  exitReq = false;
  spot: SpotDef = SPOTS[0];

  constructor() {
    const stick = mbox(0.035, 0.035, 1.3, 0x8d6e63, 0, 0, 0.65);
    this.rod.add(stick);
    this.tip.position.set(0, 0, 1.3);
    this.rod.add(this.tip);
    this.rod.add(mbox(0.08, 0.08, 0.08, 0x455a64, 0, -0.04, 0.2));
    this.bobber.add(mbox(0.1, 0.07, 0.1, 0xffffff, 0, 0.035, 0));
    this.bobber.add(mbox(0.1, 0.07, 0.1, 0xe53935, 0, 0.105, 0));
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0xffffff }));
    this.line.frustumCulled = false;
    ctx.scene.add(this.bobber, this.line);
    this.bobber.visible = this.line.visible = false;

    // spot props are merged into one extra static mesh; their colliders join the shared physics
    const S = new StaticBuilder();
    for (const sp of SPOTS) {
      sp.build?.(S);
      if (sp.id !== 'kolam') this.signPost(sp);
    }
    if (S.pos.length) {
      ctx.scene.add(S.build(new THREE.MeshLambertMaterial({ vertexColors: true })));
      for (const c of S.colliders) ctx.world.phys.add(c);
    }
    for (const sp of SPOTS)
      ctx.interact.add({
        id: sp.id === 'kolam' ? 'fishing' : 'fishing_' + sp.id,
        label: 'a_fish',
        icon: '🎣',
        pos: spotSeat(sp),
        r: sp.r ?? 1.2,
        yTol: 0.45,
        enabled: () => !ctx.cat.carrying && sp.unlocked(),
        act: () => this.start(sp),
      });
  }

  // little 🎣 board beside a spot so kids can find it (hidden while the spot is locked)
  signPost(sp: SpotDef) {
    const seat = spotSeat(sp);
    const fx = Math.sin(sp.yaw), fz = Math.cos(sp.yaw);
    const g = new THREE.Group();
    g.add(mbox(0.07, 0.8, 0.07, 0x6d4c41, 0, 0.4, 0));
    const tex = signTex(['🎣'], '#fff4d6', '#22304a', 128, 128, 84);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.42), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide }));
    m.position.set(0, 0.95, 0);
    g.add(m);
    g.position.set(seat.x + fz * 1.3 + fx * 0.2, seat.y, seat.z - fx * 1.3 + fz * 0.2);
    g.rotation.y = sp.yaw;
    ctx.scene.add(g);
    g.visible = sp.unlocked();
    ctx.world.anim.push(() => (g.visible = sp.unlocked()));
  }

  start(sp: SpotDef = SPOTS[0]) {
    const cat = ctx.cat;
    this.spot = sp;
    const seat = spotSeat(sp);
    const wp = typeof sp.water === 'string' ? ctx.world.pts[sp.water] : sp.water;
    cat.place(seat, sp.yaw);
    cat.setState('fish');
    this.active = true;
    this.exitReq = false;
    cat.model.inner.add(this.rod);
    this.rod.position.set(0.12, 0.35, 0.3);
    this.rod.rotation.set(-0.9, 0, 0);
    // random offset sideways (perpendicular to the facing)
    const side = rand(-1, 1) * (sp.spread ?? 0.3);
    this.bobberBase.set(wp.x + Math.cos(sp.yaw) * side, wp.y, wp.z - Math.sin(sp.yaw) * side);
    this.bobber.position.copy(this.bobberBase);
    this.bobber.visible = this.line.visible = true;
    sfx.plop();
    ctx.fx.burst(this.bobberBase.x, this.bobberBase.y + 0.05, this.bobberBase.z, 0x8fd3ff, 5, { speed: 0.8, up: 1.5, size: 0.05, life: 0.5, floor: this.bobberBase.y });
    this.beginWait();
    ctx.ui.fishing(true);
    // swing the camera to look over the water
    ctx.camRig.yaw = sp.yaw;
    ctx.camRig.pitch = sp.id === 'kolam' ? 0.35 : 0.55;
  }

  beginWait() {
    this.phase = 'wait';
    this.t = 0;
    this.waitFor = rand(1.8, 4.2);
    this.hooked = null;
    ctx.ui.fishStatus(tr('fishWait'), false);
  }

  pickFish(): FishDef {
    const sp = this.spot;
    if (sp.id === 'kolam') {
      // the legendary golden fish lives only in the pond (own chance, not in the table)
      const goldQ = ctx.quests.isGoldQuest();
      const goldChance = goldQ ? 0.35 : ctx.save.quest.idx > 4 ? 0.06 : 0;
      if (Math.random() < goldChance) return FBY.emas;
    }
    const pool = spotFish(sp.id).filter((f) => f.w > 0);
    let r = Math.random() * pool.reduce((a, f) => a + f.w, 0);
    for (const f of pool) {
      r -= f.w;
      if (r <= 0) return f;
    }
    return pool[0];
  }

  stop() {
    if (!this.active) return;
    this.active = false;
    this.rod.parent?.remove(this.rod);
    this.bobber.visible = this.line.visible = false;
    ctx.cat.setState('free');
    ctx.ui.fishing(false);
  }

  update(dt: number) {
    // flying caught fish
    if (this.flying) {
      const f = this.flying;
      f.t += dt;
      const k = clamp(f.t / 0.7, 0, 1);
      f.obj.position.lerpVectors(f.from, f.to, k);
      f.obj.position.y += Math.sin(k * Math.PI) * 1.6;
      f.obj.rotation.z += dt * 12;
      if (k >= 1) {
        ctx.scene.remove(f.obj);
        this.flying = null;
        ctx.fx.sparkle(f.to.x, f.to.y + 0.3, f.to.z, 5);
      }
    }
    if (!this.active) return;
    if (ctx.paused || ctx.dialogOpen) return;
    const cat = ctx.cat;
    if (cat.state !== 'fish') {
      this.stop();
      return;
    }
    if (this.exitReq || Math.hypot(input.mx, input.my) > 0.6 || input.jump || ctx.mode !== 'play') {
      this.stop();
      return;
    }
    const tap = input.act;
    this.t += dt;
    const bob = this.bobber.position;
    // line
    const tp = new THREE.Vector3();
    this.tip.getWorldPosition(tp);
    const pos = this.line.geometry.attributes.position as THREE.BufferAttribute;
    pos.setXYZ(0, tp.x, tp.y, tp.z);
    pos.setXYZ(1, bob.x, bob.y + 0.1, bob.z);
    pos.needsUpdate = true;

    switch (this.phase) {
      case 'wait':
        bob.y = this.bobberBase.y + Math.sin(this.t * 3) * 0.015;
        if (Math.random() < dt * 1.5) bob.x = this.bobberBase.x + rand(-0.03, 0.03);
        if (tap) {
          ctx.ui.fishStatus(tr('fishEarly'), false);
          sfx.plop();
          this.t = 0;
          this.waitFor = rand(2, 4);
          break;
        }
        if (this.t > this.waitFor) {
          this.phase = 'bite';
          this.t = 0;
          this.hooked = this.pickFish();
          sfx.bite();
          ctx.fx.burst(bob.x, this.bobberBase.y + 0.05, bob.z, 0x8fd3ff, 8, { speed: 1.2, up: 2, size: 0.05, life: 0.6, floor: this.bobberBase.y });
          ctx.fx.glyph(bob.x, this.bobberBase.y + 0.75, bob.z, '!', '#ffd84a', { vy: 0.5, life: 0.8, scale: 0.5 });
          ctx.ui.fishStatus(tr('fishBite'), true);
          try {
            navigator.vibrate?.(60);
          } catch (e) {}
        }
        break;
      case 'bite': {
        bob.y = this.bobberBase.y - 0.12 + Math.sin(this.t * 30) * 0.04;
        const hk = this.hooked!;
        const window = hk.id === 'emas' ? 0.75 : hk.rare ? 0.85 : 1.1;
        if (tap) {
          this.phase = 'reel';
          this.t = 0;
          this.marker = 0;
          this.dir = 1;
          const gold = hk.id === 'emas';
          this.zoneW = gold ? 0.13 : hk.rare ? 0.17 : hk.hard ? 0.22 : 0.3;
          this.speed = gold ? 1.7 : hk.rare ? 1.45 : hk.hard ? 1.25 : 0.95;
          this.zoneC = rand(0.25 + this.zoneW / 2, 0.95 - this.zoneW / 2);
          sfx.reel();
          ctx.ui.fishStatus(tr('fishReel'), true);
        } else if (this.t > window) {
          ctx.ui.fishStatus(tr('fishMissed'), false);
          this.phase = 'result';
          this.t = 0;
        }
        break;
      }
      case 'reel': {
        bob.y = this.bobberBase.y - 0.1 + Math.sin(this.t * 20) * 0.05;
        bob.x = this.bobberBase.x + Math.sin(this.t * 7) * 0.2;
        this.marker += this.dir * this.speed * dt;
        if (this.marker > 1) {
          this.marker = 1;
          this.dir = -1;
        }
        if (this.marker < 0) {
          this.marker = 0;
          this.dir = 1;
        }
        ctx.ui.fishBar(this.zoneC, this.zoneW, this.marker);
        if (tap) {
          const ok = Math.abs(this.marker - this.zoneC) <= this.zoneW / 2 + 0.02;
          if (ok) this.caught(this.hooked!);
          else {
            sfx.wahwah();
            ctx.ui.fishStatus(tr('fishLost'), false);
            ctx.fx.burst(bob.x, this.bobberBase.y + 0.05, bob.z, 0x8fd3ff, 10, { speed: 1.5, up: 2.5, size: 0.06, life: 0.6, floor: this.bobberBase.y });
          }
          this.phase = 'result';
          this.t = 0;
        }
        if (this.t > 8) {
          ctx.ui.fishStatus(tr('fishLost'), false);
          this.phase = 'result';
          this.t = 0;
        }
        break;
      }
      case 'result':
        bob.y = this.bobberBase.y;
        bob.x = this.bobberBase.x;
        if (this.t > 1.4) this.beginWait();
        break;
    }
  }

  /** Random size for a catch (cm, 1 decimal); big ones are a bit rarer. */
  rollSize(f: FishDef) {
    const [a, b] = f.cm;
    const k = Math.pow(Math.random(), 1.6);
    return Math.round((a + (b - a) * k) * 10) / 10;
  }

  catchMesh(f: FishDef): THREE.Object3D {
    const g = new THREE.Group();
    switch (f.mesh) {
      case 'boot':
        g.add(mbox(0.2, 0.3, 0.14, f.color, 0, 0.15, 0));
        g.add(mbox(0.34, 0.12, 0.16, f.color, 0.07, 0.03, 0));
        return g;
      case 'sandal':
        g.add(mbox(0.36, 0.04, 0.15, f.color, 0, 0, 0));
        g.add(mbox(0.03, 0.05, 0.12, 0xffffff, 0.08, 0.04, 0));
        g.add(mbox(0.12, 0.05, 0.03, 0xffffff, 0.02, 0.04, 0.04));
        g.add(mbox(0.12, 0.05, 0.03, 0xffffff, 0.02, 0.04, -0.04));
        return g;
      case 'crab':
        g.add(mbox(0.26, 0.1, 0.2, f.color, 0, 0, 0));
        for (const sz of [1, -1]) {
          g.add(mbox(0.08, 0.06, 0.06, f.color, 0.17, 0.02, 0.11 * sz));
          for (const x of [-0.08, 0, 0.08]) g.add(mbox(0.03, 0.03, 0.1, 0xbf360c, x, -0.04, 0.13 * sz));
          g.add(mbox(0.03, 0.05, 0.03, 0x111111, 0.1, 0.07, 0.04 * sz));
        }
        return g;
      case 'frog':
        g.add(mbox(0.16, 0.1, 0.13, f.color, 0, 0, 0));
        g.add(mbox(0.16, 0.03, 0.04, f.color, -0.14, 0, 0));
        g.add(mbox(0.03, 0.03, 0.03, 0x111111, 0.07, 0.04, 0.04));
        g.add(mbox(0.03, 0.03, 0.03, 0x111111, 0.07, 0.04, -0.04));
        return g;
    }
    return fishMesh(f.color, f.scale);
  }

  caught(f: FishDef, cm = this.rollSize(f)) {
    const cat = ctx.cat;
    const s = ctx.save;
    const first = !s.fish[f.id];
    s.fish[f.id] = (s.fish[f.id] || 0) + 1;
    s.stats.fishTotal++;
    const best = s.fishBest[f.id] || 0;
    const record = !first && best > 0 && cm > best;
    if (cm > best) s.fishBest[f.id] = cm;
    const obj = this.catchMesh(f);
    if (f.rare) {
      const gold = f.id === 'emas';
      obj.traverse((o: any) => o.material && (o.material = new THREE.MeshLambertMaterial({ color: gold ? 0xffd54f : o.material.color, emissive: gold ? 0x5a4200 : 0x3a2a55 })));
    }
    ctx.scene.add(obj);
    const from = this.active ? this.bobber.position.clone() : new THREE.Vector3(cat.body.x, cat.body.y + 0.2, cat.body.z + 1);
    const to = new THREE.Vector3(cat.body.x + 0.4, cat.body.y + 0.3, cat.body.z + 0.5);
    obj.position.copy(from);
    this.flying = { obj, t: 0, from, to };
    ctx.fx.burst(from.x, from.y + 0.05, from.z, 0x8fd3ff, 14, { speed: 2, up: 3.5, size: 0.07, life: 0.8, floor: from.y });
    sfx.splash();
    if (f.junk) sfx.wahwah();
    else if (f.rare) sfx.fanfare();
    else sfx.jingle();
    if (f.rare) {
      // shiny ✨: sparkles at the water and stars around the cat
      ctx.fx.sparkle(from.x, from.y + 0.4, from.z, 12);
      ctx.fx.stars(to.x, to.y + 0.4, to.z, 8);
      sfx.sparkle();
    }
    const size = `${cm} cm`;
    ctx.ui.fishStatus(tr('fishGot', { fish: L(f.name) }) + (f.junk ? '' : `  ${size}`), true);
    if (first && f.rare) ctx.ui.banner('✨' + f.icon, tr('rareFish'), `${L(f.name)} · ${size}`, f.coins);
    else if (first) ctx.ui.banner(f.icon, tr('fishGot', { fish: '' }).replace('!', '').trim(), L(f.name) + (f.junk ? '' : ' · ' + size), f.coins);
    else ctx.ui.toast((f.rare ? '✨ ' : '') + `${f.icon} ${L(f.name)}` + (f.junk ? '' : ` ${size}`) + (f.coins ? `  +${f.coins}` : ''));
    if (record) ctx.after(1.0, () => ctx.ui.toast(`📏 ${tr('newRecord')} ${f.icon} ${size}`));
    if (f.coins) addCoins(f.coins);
    ctx.catHappy = true;
    ctx.after(1.5, () => (ctx.catHappy = false));
    ctx.quests.onFish(f.id); // quests decide whether junk counts
    ctx.album?.onFish(f, first);
    writeSave(s);
  }
}
