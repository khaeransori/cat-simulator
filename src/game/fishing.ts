import * as THREE from 'three';
import { ctx, rand, clamp } from '../ctx';
import { input } from '../input';
import { sfx } from '../audio';
import { L, tr, type Pair } from '../i18n';
import { mbox } from '../world/builder';
import { fishMesh } from '../world/map';
import { addCoins } from './mischief';
import { writeSave } from '../save';

const P = (id: string, en: string): Pair => ({ id, en });

export interface FishDef {
  id: string;
  name: Pair;
  icon: string;
  color: number;
  scale: number;
  w: number;
  coins: number;
}
export const FISH: FishDef[] = [
  { id: 'kecil', name: P('Ikan Kecil', 'Little Fish'), icon: '🐟', color: 0x90a4ae, scale: 0.7, w: 45, coins: 2 },
  { id: 'mas', name: P('Ikan Mas', 'Carp'), icon: '🐠', color: 0xff8f00, scale: 1.0, w: 30, coins: 2 },
  { id: 'lele', name: P('Ikan Lele', 'Catfish'), icon: '🐡', color: 0x5d4037, scale: 1.15, w: 16, coins: 3 },
  { id: 'sepatu', name: P('Sepatu Bekas', 'Old Boot'), icon: '👢', color: 0x6d4c41, scale: 1, w: 7, coins: 0 },
  { id: 'emas', name: P('Ikan Emas Legendaris', 'Legendary Golden Fish'), icon: '✨', color: 0xffd54f, scale: 1.3, w: 0, coins: 10 },
];

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

    ctx.interact.add({
      id: 'fishing',
      label: 'a_fish',
      icon: '🎣',
      pos: ctx.world.pts.dock,
      r: 1.3,
      yTol: 0.4,
      enabled: () => !ctx.cat.carrying,
      act: () => this.start(),
    });
  }

  start() {
    const cat = ctx.cat;
    const W = ctx.world;
    cat.place(W.pts.dock, -Math.PI / 2);
    cat.setState('fish');
    this.active = true;
    this.exitReq = false;
    cat.model.inner.add(this.rod);
    this.rod.position.set(0.12, 0.35, 0.3);
    this.rod.rotation.set(-0.9, 0, 0);
    this.bobberBase.set(W.pts.dock.x - 2.7, 0.05, W.pts.dock.z + rand(-0.4, 0.4));
    this.bobber.position.copy(this.bobberBase);
    this.bobber.visible = this.line.visible = true;
    sfx.plop();
    ctx.fx.burst(this.bobberBase.x, 0.1, this.bobberBase.z, 0x8fd3ff, 5, { speed: 0.8, up: 1.5, size: 0.05, life: 0.5, floor: 0.05 });
    this.beginWait();
    ctx.ui.fishing(true);
    // swing the camera to look over the pond
    ctx.camRig.yaw = -Math.PI / 2;
    ctx.camRig.pitch = 0.35;
  }

  beginWait() {
    this.phase = 'wait';
    this.t = 0;
    this.waitFor = rand(1.8, 4.2);
    this.hooked = null;
    ctx.ui.fishStatus(tr('fishWait'), false);
  }

  pickFish(): FishDef {
    const goldQ = ctx.quests.isGoldQuest();
    const goldChance = goldQ ? 0.35 : ctx.save.quest.idx > 4 ? 0.06 : 0;
    if (Math.random() < goldChance) return FISH[4];
    const pool = FISH.filter((f) => f.w > 0);
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
          ctx.fx.burst(bob.x, 0.1, bob.z, 0x8fd3ff, 8, { speed: 1.2, up: 2, size: 0.05, life: 0.6, floor: 0.05 });
          ctx.fx.glyph(bob.x, 0.8, bob.z, '!', '#ffd84a', { vy: 0.5, life: 0.8, scale: 0.5 });
          ctx.ui.fishStatus(tr('fishBite'), true);
          try {
            navigator.vibrate?.(60);
          } catch (e) {}
        }
        break;
      case 'bite': {
        bob.y = this.bobberBase.y - 0.12 + Math.sin(this.t * 30) * 0.04;
        const window = this.hooked!.id === 'emas' ? 0.75 : 1.1;
        if (tap) {
          this.phase = 'reel';
          this.t = 0;
          this.marker = 0;
          this.dir = 1;
          const gold = this.hooked!.id === 'emas';
          this.zoneW = gold ? 0.13 : this.hooked!.id === 'lele' ? 0.22 : 0.3;
          this.speed = gold ? 1.7 : this.hooked!.id === 'lele' ? 1.25 : 0.95;
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
            ctx.fx.burst(bob.x, 0.1, bob.z, 0x8fd3ff, 10, { speed: 1.5, up: 2.5, size: 0.06, life: 0.6, floor: 0.05 });
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

  caught(f: FishDef) {
    const cat = ctx.cat;
    const s = ctx.save;
    const first = !s.fish[f.id];
    s.fish[f.id] = (s.fish[f.id] || 0) + 1;
    s.stats.fishTotal++;
    let obj: THREE.Object3D;
    if (f.id === 'sepatu') {
      obj = new THREE.Group();
      obj.add(mbox(0.2, 0.3, 0.14, f.color, 0, 0.15, 0));
      obj.add(mbox(0.34, 0.12, 0.16, f.color, 0.07, 0.03, 0));
    } else obj = fishMesh(f.color, f.scale);
    if (f.id === 'emas') obj.traverse((o: any) => o.material && (o.material = new THREE.MeshLambertMaterial({ color: 0xffd54f, emissive: 0x5a4200 })));
    ctx.scene.add(obj);
    const from = this.bobber.position.clone();
    const to = new THREE.Vector3(cat.body.x + 0.4, cat.body.y + 0.3, cat.body.z + 0.5);
    obj.position.copy(from);
    this.flying = { obj, t: 0, from, to };
    ctx.fx.burst(from.x, 0.1, from.z, 0x8fd3ff, 14, { speed: 2, up: 3.5, size: 0.07, life: 0.8, floor: 0.05 });
    sfx.splash();
    if (f.id === 'sepatu') sfx.wahwah();
    else if (f.id === 'emas') sfx.fanfare();
    else sfx.jingle();
    const name = `${f.icon} ${L(f.name)}`;
    ctx.ui.fishStatus(tr('fishGot', { fish: L(f.name) }), true);
    if (first) ctx.ui.banner(f.icon, tr('fishGot', { fish: '' }).replace('!', '').trim(), L(f.name), f.coins);
    else ctx.ui.toast(name + (f.coins ? `  +${f.coins}` : ''));
    if (f.coins) addCoins(f.coins);
    ctx.catHappy = true;
    ctx.after(1.5, () => (ctx.catHappy = false));
    if (f.id !== 'sepatu') ctx.quests.onFish(f.id);
    writeSave(s);
  }
}
