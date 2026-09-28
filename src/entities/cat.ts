import * as THREE from 'three';
import { ctx, clamp, damp, angleLerp, rand } from '../ctx';
import { CatModel, newAnim, type CatAnim } from './catModel';
import type { Body } from '../world/physics';
import { input } from '../input';
import { sfx } from '../audio';
import { tr } from '../i18n';

export type CatState = 'free' | 'sleep' | 'fish' | 'act' | 'knock' | 'hugged' | 'cut';

export function blobShadow(size = 0.7) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 4, 32, 32, 30);
  gr.addColorStop(0, 'rgba(0,0,0,0.42)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2;
  m.renderOrder = 1;
  return m;
}

export class Cat {
  model = new CatModel();
  body: Body = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, r: 0.22, h: 0.55, onGround: true, stepH: 0.26, climbH: 0.5, g: 18 };
  yaw = 0;
  anim: CatAnim = newAnim();
  state: CatState = 'free';
  stateT = 0;
  actKind = '';
  onActDone: (() => void) | null = null;
  carrying: { id: string; obj: THREE.Object3D } | null = null;
  lastSafe = new THREE.Vector3();
  coyote = 0;
  jumpBuf = 0;
  shadow = blobShadow(0.75);
  dizzy = 0;
  dizzyStars: THREE.Sprite[] = [];
  sleepZ = 0;
  sleepCb: (() => void) | null = null;
  sleepCbT = 0;
  lastMischiefT = -99;
  lastMischiefPos = new THREE.Vector3();
  speed01 = 0;
  airTime = 0;
  hugger: any = null;

  constructor(scene: THREE.Scene) {
    scene.add(this.model.root);
    scene.add(this.shadow);
  }

  get pos() {
    return this.model.root.position;
  }

  place(p: THREE.Vector3, yaw: number) {
    this.body.x = p.x;
    this.body.y = p.y;
    this.body.z = p.z;
    this.body.vx = this.body.vy = this.body.vz = 0;
    this.yaw = yaw;
    this.lastSafe.copy(p);
    this.syncModel();
  }

  syncModel() {
    this.model.root.position.set(this.body.x, this.body.y, this.body.z);
    this.model.root.rotation.y = this.yaw;
  }

  forward() {
    return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
  }

  setState(s: CatState) {
    this.state = s;
    this.stateT = 0;
    if (s !== 'sleep') this.sleepCb = null;
  }

  // brief locked action (paw, scratch, dig, eat)
  doAction(kind: string, dur: number, done?: () => void) {
    this.setState('act');
    this.actKind = kind;
    this.stateT = dur;
    this.onActDone = done || null;
    this.body.vx = this.body.vz = 0;
  }

  sleepAt(p: THREE.Vector3, yaw: number, cb?: () => void, cbDelay = 1.5) {
    this.place(p, yaw);
    this.setState('sleep');
    this.sleepCb = cb || null;
    this.sleepCbT = cbDelay;
    sfx.purr();
  }

  knock(fromX: number, fromZ: number, power = 5, up = 4.5) {
    const dx = this.body.x - fromX, dz = this.body.z - fromZ;
    const l = Math.hypot(dx, dz) || 1;
    this.setState('knock');
    this.stateT = 0.7;
    this.body.vx = (dx / l) * power;
    this.body.vz = (dz / l) * power;
    this.body.vy = up;
    this.body.onGround = false;
    this.dizzy = 1.6;
    sfx.meow(1.35, 0.35);
    ctx.fx.stars(this.body.x, this.body.y + 0.7, this.body.z, 6);
  }

  meow() {
    const pitch = 0.9 + Math.random() * 0.25;
    sfx.meow(pitch);
    ctx.bubbles.say(this.model.root, tr('meow') + '!', { ttl: 1.2, y: 0.95, kind: 'emote', key: 'catmeow' });
    ctx.onMeow?.();
  }

  update(dt: number) {
    const b = this.body;
    const a = this.anim;
    this.stateT += dt;
    const controllable = this.state === 'free' && ctx.mode === 'play' && !ctx.paused && !ctx.dialogOpen;
    let ix = 0, iy = 0;
    if (controllable) {
      ix = input.mx;
      iy = input.my;
    }
    const mag = Math.min(1, Math.hypot(ix, iy));
    // camera-relative direction
    const cy = ctx.camRig ? ctx.camRig.yaw : 0;
    const fx = Math.sin(cy), fz = Math.cos(cy);
    const rx = -Math.cos(cy), rz = Math.sin(cy);
    let dx = fx * iy + rx * ix, dz = fz * iy + rz * ix;
    const dl = Math.hypot(dx, dz);
    if (dl > 0.001) {
      dx /= dl;
      dz /= dl;
    }
    const RUN = 4.9;
    const sp = mag < 0.6 ? mag * 2.4 : 1.45 + (mag - 0.6) / 0.4 * (RUN - 1.45);
    const tx = dx * (mag > 0 ? sp : 0), tz = dz * (mag > 0 ? sp : 0);

    if (this.state === 'free') {
      const k = b.onGround ? 14 : 5;
      b.vx = damp(b.vx, tx, k, dt);
      b.vz = damp(b.vz, tz, k, dt);
      if (mag > 0.05) this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-14 * dt));
      // jump (with coyote time + input buffer)
      if (b.onGround) this.coyote = 0.12;
      else this.coyote -= dt;
      if (controllable && input.jump) this.jumpBuf = 0.15;
      else this.jumpBuf -= dt;
      if (this.jumpBuf > 0 && this.coyote > 0) {
        b.vy = 7.0;
        b.onGround = false;
        this.coyote = 0;
        this.jumpBuf = 0;
        sfx.jump();
      }
      if (controllable && input.meow) this.meow();
    } else if (this.state === 'act') {
      b.vx = damp(b.vx, 0, 10, dt);
      b.vz = damp(b.vz, 0, 10, dt);
      this.stateT -= 2 * dt; // stateT counts down for act
      if (this.stateT <= 0) {
        this.state = 'free';
        this.actKind = '';
        const cb = this.onActDone;
        this.onActDone = null;
        cb?.();
      }
    } else if (this.state === 'sleep') {
      b.vx = b.vz = 0;
      this.sleepZ -= dt;
      if (this.sleepZ < 0) {
        this.sleepZ = 1.1;
        ctx.fx.zzz(b.x + Math.sin(this.yaw) * 0.25, b.y + 0.6, b.z + Math.cos(this.yaw) * 0.25);
      }
      if (this.sleepCb) {
        this.sleepCbT -= dt;
        if (this.sleepCbT <= 0) {
          const cb = this.sleepCb;
          this.sleepCb = null;
          cb();
        }
      }
      // wake up by moving
      if (ctx.mode === 'play' && !ctx.paused && !ctx.dialogOpen && (Math.hypot(input.mx, input.my) > 0.3 || input.jump) && this.stateT > 0.6) {
        this.setState('free');
        if (input.jump) {
          b.vy = 6;
          b.onGround = false;
        }
      }
    } else if (this.state === 'knock') {
      if (b.onGround && this.stateT > 0.25) {
        b.vx = damp(b.vx, 0, 8, dt);
        b.vz = damp(b.vz, 0, 8, dt);
      }
      if (this.stateT > 0.9) this.setState('free');
    } else if (this.state === 'hugged' || this.state === 'cut' || this.state === 'fish') {
      b.vx = b.vz = 0;
    }

    if (this.state !== 'hugged' && this.state !== 'fish' && !(this.state === 'cut' && ctx.cutFreeze)) {
      if (this.state === 'sleep') {
        b.vy = 0;
      } else {
        const wasAir = !b.onGround;
        ctx.world.phys.move(b, dt);
        if (b.landed && wasAir && this.airTime > 0.25) {
          sfx.land();
          ctx.fx.burst(b.x, b.y + 0.02, b.z, 0xe8e0d0, 4, { speed: 1, up: 1, size: 0.05, life: 0.4, floor: b.y });
        }
      }
    }
    this.airTime = b.onGround ? 0 : this.airTime + dt;
    // water check
    for (const w of ctx.world.water) {
      if (b.x > w.x0 && b.x < w.x1 && b.z > w.z0 && b.z < w.z1 && b.y < 0.12 && this.state !== 'hugged') {
        sfx.splash(true);
        ctx.fx.burst(b.x, 0.1, b.z, 0x8fd3ff, 16, { speed: 2.5, up: 4, size: 0.08, life: 0.8, floor: 0.05 });
        ctx.bubbles.say(this.model.root, tr('splashNo'), { ttl: 2, y: 1.0, kind: 'emote', key: 'catwater' });
        sfx.meow(1.4);
        this.place(this.lastSafe, this.yaw + Math.PI);
        b.vy = 4;
        b.onGround = false;
        this.dizzy = 0.8;
        break;
      }
    }
    if (b.onGround && this.state === 'free' && b.y >= 0.12) this.lastSafe.set(b.x, b.y, b.z);
    else if (b.onGround && this.state === 'free') {
      let inW = false;
      for (const w of ctx.world.water) if (b.x > w.x0 - 0.6 && b.x < w.x1 + 0.6 && b.z > w.z0 - 0.6 && b.z < w.z1 + 0.6) inW = true;
      if (!inW) this.lastSafe.set(b.x, b.y, b.z);
    }
    // fell out of the world? (safety)
    if (b.y < -5) this.place(ctx.world.pts.homeInside, 0);

    this.syncModel();
    // animation state
    const hs = Math.hypot(b.vx, b.vz);
    this.speed01 = clamp(hs / 4.9, 0, 1);
    a.speed = this.state === 'free' || this.state === 'knock' ? this.speed01 * 1.1 : 0;
    a.air = !b.onGround && this.state !== 'sleep' && this.state !== 'hugged' && this.airTime > 0.06;
    a.sleep = damp(a.sleep, this.state === 'sleep' ? 1 : 0, 8, dt);
    a.sit = damp(a.sit, this.state === 'fish' || (this.state === 'cut' && ctx.catSit) ? 1 : 0, 8, dt);
    a.scratch = this.state === 'act' && this.actKind === 'scratch';
    a.dig = this.state === 'act' && this.actKind === 'dig';
    a.eat = this.state === 'act' && this.actKind === 'eat';
    a.paw = this.state === 'act' && this.actKind === 'paw' ? clamp(1 - this.stateT / 0.35, 0, 1) : 0;
    a.hugged = this.state === 'hugged';
    a.earsDown = damp(a.earsDown, this.dizzy > 0 || ctx.catEarsDown ? 1 : 0, 6, dt);
    a.happy = damp(a.happy, ctx.catHappy ? 1 : 0, 6, dt);
    this.model.update(dt, a);

    // dizzy stars orbit
    if (this.dizzy > 0) {
      this.dizzy -= dt;
      if (Math.random() < dt * 6) ctx.fx.glyph(b.x + rand(-0.2, 0.2), b.y + 0.85, b.z + rand(-0.2, 0.2), '★', '#ffd84a', { vy: 0.2, life: 0.6, scale: 0.18 });
    }
    // blob shadow
    const g = ctx.world.phys.groundAt(b.x, b.z, 0.1, b.y + 0.05);
    this.shadow.position.set(b.x, g + 0.02, b.z);
    const h = Math.max(0, b.y - g);
    const s = clamp(1 - h * 0.25, 0.4, 1);
    this.shadow.scale.set(s, s, s);
    this.shadow.visible = this.state !== 'hugged';
  }
}

// Close third-person camera that follows behind the cat.
export class CameraRig {
  cam: THREE.PerspectiveCamera;
  yaw = 0;
  pitch = 0.3;
  effPitch = 0.3;
  dist = 2.5;
  curDist = 2.5;
  target = new THREE.Vector3();
  override: { pos: THREE.Vector3; look: THREE.Vector3 } | null = null;
  shake = 0;
  private tmp = new THREE.Vector3();

  constructor(cam: THREE.PerspectiveCamera) {
    this.cam = cam;
  }

  snap(cat: Cat) {
    this.yaw = cat.yaw;
    this.target.set(cat.body.x, cat.body.y + 0.5, cat.body.z);
    this.curDist = this.dist;
    this.update(0.016, cat, true);
  }

  update(dt: number, cat: Cat, instant = false) {
    if (this.override) {
      const k = instant ? 1 : 1 - Math.exp(-3 * dt);
      this.cam.position.lerp(this.override.pos, k);
      this.tmp.copy(this.override.look);
      this.cam.lookAt(this.tmp);
      return;
    }
    const b = cat.body;
    const canCam = ctx.mode === 'play' && !ctx.paused;
    if (canCam) {
      this.yaw -= input.camDX * 0.0065;
      this.pitch = clamp(this.pitch + input.camDY * 0.004, -0.2, 1.15);
    }
    const now = performance.now() / 1000;
    const userRecent = now - input.camTouchT < 1.6 || input.camId !== -1;
    // auto-follow behind the cat while it moves
    if (!userRecent && cat.state === 'free' && cat.speed01 > 0.25 && Math.hypot(input.mx, input.my) > 0.1) {
      const back = Math.abs(input.my) > 0.2 && input.my < 0 ? 0.4 : 2.2; // don't spin when walking toward camera
      this.yaw = angleLerp(this.yaw, cat.yaw, 1 - Math.exp(-back * cat.speed01 * dt));
    }
    // being hugged: look at the kid from the front
    let dist = this.dist;
    if (cat.state === 'hugged' && cat.hugger) {
      this.yaw = angleLerp(this.yaw, cat.hugger.yaw + Math.PI, 1 - Math.exp(-4 * dt));
      dist = 3.4;
    }
    // follow target (smooth y so jumps don't jerk)
    const ty = b.y + (cat.state === 'sleep' ? 0.35 : 0.5);
    const kx = instant ? 1 : 1 - Math.exp(-18 * dt);
    const ky = instant ? 1 : 1 - Math.exp(-(b.onGround ? 10 : 4) * dt);
    this.target.x += (b.x - this.target.x) * kx;
    this.target.z += (b.z - this.target.z) * kx;
    this.target.y += (ty - this.target.y) * ky;
    // if the view behind the cat is blocked, try looking from higher up first
    const phys = ctx.world.phys;
    const tryPitch = (p: number) => {
      const cp = Math.cos(p), sp = Math.sin(p);
      const dx = -Math.sin(this.yaw) * cp, dy = sp, dz = -Math.cos(this.yaw) * cp;
      return { p, dx, dy, dz, hit: phys.raycast(this.target.x, this.target.y, this.target.z, dx, dy, dz, dist + 0.3, true) };
    };
    let best = tryPitch(this.pitch);
    if (best.hit < 1.6) {
      for (const extra of [0.3, 0.55, 0.8]) {
        const c = tryPitch(Math.min(1.25, this.pitch + extra));
        if (c.hit > best.hit + 0.3) best = c;
        if (c.hit >= 1.9) break;
      }
    }
    const wantP = best.p;
    this.effPitch = instant ? wantP : this.effPitch + (wantP - this.effPitch) * (1 - Math.exp(-5 * dt));
    const cp = Math.cos(this.effPitch), sp = Math.sin(this.effPitch);
    const dx = -Math.sin(this.yaw) * cp, dy = sp, dz = -Math.cos(this.yaw) * cp;
    // camera collision
    const hit = phys.raycast(this.target.x, this.target.y, this.target.z, dx, dy, dz, dist + 0.3, true);
    const want = Math.max(0.5, Math.min(dist, hit - 0.25));
    if (want < this.curDist || instant) this.curDist = want;
    else this.curDist += (want - this.curDist) * (1 - Math.exp(-3 * dt));
    let px = this.target.x + dx * this.curDist, py = this.target.y + dy * this.curDist, pz = this.target.z + dz * this.curDist;
    const g = ctx.world.phys.groundAt(px, pz, 0.05, py + 0.2);
    if (py < g + 0.15) py = g + 0.15;
    if (this.shake > 0) {
      this.shake -= dt;
      px += (Math.random() - 0.5) * this.shake * 0.2;
      py += (Math.random() - 0.5) * this.shake * 0.2;
    }
    this.cam.position.set(px, py, pz);
    this.tmp.set(this.target.x, this.target.y + 0.12, this.target.z);
    this.cam.lookAt(this.tmp);
  }
}
