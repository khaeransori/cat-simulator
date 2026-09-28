import * as THREE from 'three';
import { ctx, damp, angleLerp, rand, clamp, pick } from '../ctx';
import { DogModel, PigeonModel } from './animals';
import { CatModel, newAnim } from './catModel';
import { blobShadow } from './cat';
import { Human, NPC_LINES } from './npc';
import { sfx } from '../audio';
import { L, type Pair } from '../i18n';
import { glyphTex } from '../fx/particles';
import { mbox } from '../world/builder';

const P = (id: string, en: string): Pair => ({ id, en });

// ---------------- Dog (Bleki) ----------------
export class Dog {
  model = new DogModel();
  x = 0;
  z = 0;
  yaw = 0;
  state: 'sleep' | 'alert' | 'bark' | 'chase' | 'return' = 'sleep';
  stateT = 0;
  barkT = 0;
  lastSeen = -99;
  shadow = blobShadow(1.2);
  yard: { x0: number; z0: number; x1: number; z1: number };
  bed: THREE.Vector3;

  constructor() {
    this.yard = ctx.world.dogYard;
    this.bed = ctx.world.pts.dogBed;
    ctx.scene.add(this.model.root);
    ctx.scene.add(this.shadow);
    this.reset();
  }

  reset() {
    this.x = this.bed.x;
    this.z = this.bed.z;
    this.yaw = Math.PI * 0.8;
    this.state = 'sleep';
  }

  poke() {
    this.state = 'bark';
    this.stateT = 0;
    this.lastSeen = ctx.time;
  }

  bark() {
    sfx.bark();
    ctx.bubbles.say(this.model.root, L(pick([P('GUK! GUK!', 'WOOF! WOOF!'), P('GUK GUK GUK!', 'WOOF WOOF!'), P('GRRR... GUK!', 'GRRR... WOOF!')])), { ttl: 1, y: 1.4, kind: 'shout', key: 'dog' });
    ctx.npcHear?.(this.x, this.z, 12);
  }

  update(dt: number) {
    const cb = ctx.cat.body;
    const y = this.yard;
    this.stateT += dt;
    const catInYard = cb.x > y.x0 && cb.x < y.x1 && cb.z > y.z0 && cb.z < y.z1 && cb.y < 1.5;
    const nearFence = cb.z > -6.5 && cb.z < -3.2 && cb.x > y.x0 - 1 && cb.x < y.x1 + 1 && !catInYard;
    const playing = ctx.mode === 'play';
    if (playing && (catInYard || nearFence) && ctx.cat.state !== 'cut') this.lastSeen = ctx.time;
    let run = 0;
    let tx = this.x, tz = this.z;
    let barking = false;
    if (playing && catInYard && this.state !== 'chase') {
      this.state = 'chase';
      this.stateT = 0;
    }
    switch (this.state) {
      case 'sleep':
        if (playing && nearFence && Math.hypot(cb.x - this.x, cb.z - this.z) < 9) {
          this.state = 'alert';
          this.stateT = 0;
        }
        break;
      case 'alert':
      case 'bark':
        tx = clamp(cb.x, y.x0 + 0.5, y.x1 - 0.5);
        tz = y.z1 - 0.7;
        barking = Math.hypot(tx - this.x, tz - this.z) < 1.2 || this.state === 'bark';
        if (ctx.time - this.lastSeen > (this.state === 'bark' ? 4 : 2.5)) {
          this.state = 'return';
          this.stateT = 0;
        }
        break;
      case 'chase':
        tx = cb.x;
        tz = cb.z;
        barking = true;
        if (!catInYard && this.stateT > 0.5) {
          this.state = 'alert';
          this.stateT = 0;
        }
        if (catInYard && Math.hypot(cb.x - this.x, cb.z - this.z) < 0.9 && ctx.cat.state === 'free') {
          // launch the cat back over the fence toward the street
          ctx.cat.knock(cb.x, cb.z - 3, 0, 9.5);
          ctx.cat.body.vz = 5.2;
          ctx.cat.body.vx = 0;
          this.bark();
        }
        break;
      case 'return':
        tx = this.bed.x;
        tz = this.bed.z;
        if (Math.hypot(tx - this.x, tz - this.z) < 0.3) {
          this.state = 'sleep';
          this.yaw = Math.PI * 0.8;
        }
        if (playing && nearFence) {
          this.state = 'alert';
          this.stateT = 0;
        }
        break;
    }
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (this.state !== 'sleep' && d > 0.3) {
      const sp = this.state === 'return' ? 2 : 5.4;
      this.x += (dx / d) * Math.min(d, sp * dt);
      this.z += (dz / d) * Math.min(d, sp * dt);
      this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-10 * dt));
      run = sp > 3 ? 1 : 0.5;
    } else if (this.state !== 'sleep') {
      this.yaw = angleLerp(this.yaw, Math.atan2(cb.x - this.x, cb.z - this.z), 1 - Math.exp(-8 * dt));
    }
    this.x = clamp(this.x, y.x0 + 0.5, y.x1 - 0.5);
    this.z = clamp(this.z, y.z0 + 0.5, y.z1 - 0.5);
    if (barking) {
      this.barkT -= dt;
      if (this.barkT < 0) {
        this.barkT = this.state === 'bark' ? 0.7 : 1.1;
        this.bark();
      }
    }
    if (this.state === 'sleep' && Math.random() < dt * 0.5) ctx.fx.zzz(this.x, 0.9, this.z);
    this.model.update(dt, { run, sleep: this.state === 'sleep', bark: barking && run < 0.6 });
    this.model.root.position.set(this.x, 0, this.z);
    this.model.root.rotation.y = this.yaw;
    this.shadow.position.set(this.x, 0.02, this.z);
  }
}

// ---------------- Pigeons ----------------
interface Bird {
  m: PigeonModel;
  hx: number;
  hz: number;
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  yaw: number;
  t: number;
  tx: number;
  tz: number;
}
export class Flock {
  birds: Bird[] = [];
  center: THREE.Vector3;
  state: 'ground' | 'fly' | 'away' | 'return' = 'ground';
  t = 0;
  mischiefId: string;

  constructor(center: THREE.Vector3, n: number, mischiefId: string) {
    this.center = center.clone();
    this.mischiefId = mischiefId;
    for (let i = 0; i < n; i++) {
      const m = new PigeonModel();
      const a = (i / n) * Math.PI * 2;
      const r = 0.6 + Math.random() * 0.8;
      const b: Bird = { m, hx: center.x + Math.cos(a) * r, hz: center.z + Math.sin(a) * r, x: 0, y: center.y, z: 0, vx: 0, vy: 0, vz: 0, yaw: rand(0, 6), t: rand(0, 3), tx: 0, tz: 0 };
      b.x = b.tx = b.hx;
      b.z = b.tz = b.hz;
      ctx.scene.add(m.root);
      this.birds.push(b);
    }
  }

  reset() {
    this.state = 'ground';
    for (const b of this.birds) {
      b.x = b.tx = b.hx;
      b.z = b.tz = b.hz;
      b.y = this.center.y;
      b.m.root.visible = true;
    }
  }

  scare() {
    if (this.state !== 'ground') return false;
    this.state = 'fly';
    this.t = 0;
    sfx.flap();
    for (const b of this.birds) {
      const a = Math.atan2(b.z - this.center.z, b.x - this.center.x) + rand(-0.4, 0.4);
      b.vx = Math.cos(a) * rand(2.5, 4);
      b.vz = Math.sin(a) * rand(2.5, 4);
      b.vy = rand(3, 5);
    }
    ctx.fx.burst(this.center.x, this.center.y + 0.3, this.center.z, 0xdddddd, 8, { speed: 1.5, up: 2, size: 0.05, g: 2, life: 1.2 });
    return true;
  }

  update(dt: number) {
    this.t += dt;
    const cb = ctx.cat.body;
    for (const b of this.birds) {
      if (this.state === 'ground') {
        b.t -= dt;
        if (b.t < 0) {
          b.t = rand(1, 3);
          b.tx = b.hx + rand(-0.5, 0.5);
          b.tz = b.hz + rand(-0.5, 0.5);
        }
        const dx = b.tx - b.x, dz = b.tz - b.z;
        const d = Math.hypot(dx, dz);
        if (d > 0.05) {
          b.x += (dx / d) * Math.min(d, 0.5 * dt);
          b.z += (dz / d) * Math.min(d, 0.5 * dt);
          b.yaw = Math.atan2(dx, dz);
        }
        b.y = this.center.y + Math.abs(Math.sin(ctx.time * 8 + b.hx)) * (d > 0.05 ? 0.03 : 0);
        b.m.update(dt, false);
        // running through the flock scares it
        if (ctx.mode === 'play' && ctx.cat.speed01 > 0.55 && Math.hypot(cb.x - b.x, cb.z - b.z) < 1.1 && Math.abs(cb.y - b.y) < 0.8) {
          if (this.scare()) ctx.onFlockScared?.(this);
        }
      } else if (this.state === 'fly') {
        b.vy += 3 * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        b.z += b.vz * dt;
        b.yaw = Math.atan2(b.vx, b.vz);
        b.m.update(dt, true);
        if (this.t > 3.5) b.m.root.visible = false;
      } else if (this.state === 'return') {
        const k = clamp(this.t / 3, 0, 1);
        b.x = b.hx + (1 - k) * 8;
        b.z = b.hz + (1 - k) * 4;
        b.y = this.center.y + (1 - k) * (1 - k) * 10;
        b.yaw = Math.atan2(-8, -4);
        b.m.root.visible = true;
        b.m.update(dt, k < 1);
      }
      b.m.root.position.set(b.x, b.y, b.z);
      b.m.root.rotation.y = b.yaw;
    }
    if (this.state === 'fly' && this.t > 3.5) {
      this.state = 'away';
      this.t = 0;
    }
    if (this.state === 'away' && this.t > 25) {
      this.state = 'return';
      this.t = 0;
      sfx.coo();
    }
    if (this.state === 'return' && this.t > 3) {
      this.state = 'ground';
      for (const b of this.birds) {
        b.x = b.hx;
        b.z = b.hz;
      }
    }
  }
}

// ---------------- Lisa (quest-giver cat) ----------------
export class Lisa {
  model = new CatModel();
  anim = newAnim();
  mark: THREE.Sprite;
  pos: THREE.Vector3;
  baseYaw = Math.PI / 2;
  yaw = Math.PI / 2;
  shadow = blobShadow(0.7);

  constructor() {
    this.pos = ctx.world.pts.lisa.clone();
    this.model.setLook({ fur: 'putih', pattern: 'calico', eyes: 'biruMata', head: 'pita', face: 'none', neck: 'lonceng', back: 'none' });
    this.model.root.position.copy(this.pos);
    ctx.scene.add(this.model.root);
    this.mark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTex('!', '#ffd84a'), transparent: true, depthTest: false }));
    this.mark.scale.set(0.45, 0.45, 0.45);
    this.mark.renderOrder = 10;
    ctx.scene.add(this.mark);
    this.shadow.position.set(this.pos.x, this.pos.y + 0.01, this.pos.z);
    ctx.scene.add(this.shadow);
    this.anim.sit = 1;
  }

  update(dt: number) {
    const cb = ctx.cat.body;
    const d = Math.hypot(cb.x - this.pos.x, cb.z - this.pos.z);
    const want = d < 7 ? Math.atan2(cb.x - this.pos.x, cb.z - this.pos.z) : this.baseYaw;
    this.yaw = angleLerp(this.yaw, want, 1 - Math.exp(-3 * dt));
    this.model.root.rotation.y = this.yaw;
    this.anim.happy = ctx.lisaHappy ? 1 : 0;
    this.model.update(dt, this.anim);
    const q = ctx.quests;
    const g = q ? q.lisaMark() : '';
    this.mark.visible = !!g;
    if (g) {
      (this.mark.material as THREE.SpriteMaterial).map = glyphTex(g, g === '?' ? '#7ad3ff' : '#ffd84a');
      this.mark.position.set(this.pos.x, this.pos.y + 1.15 + Math.sin(ctx.time * 4) * 0.08, this.pos.z);
    }
  }
}

// ---------------- Kids with a ball ----------------
export class Kids {
  a: Human;
  b: Human;
  ball: THREE.Mesh;
  ballState: 'atA' | 'atB' | 'fly' | 'cat' | 'ground' = 'atA';
  ballT = 0;
  from = new THREE.Vector3();
  to = new THREE.Vector3();
  mode: 'play' | 'chase' | 'hug' | 'fetch' = 'play';
  chaser: Human | null = null;
  modeT = 0;
  cool = 5;
  seeT = 0;
  shadow = blobShadow(0.35);

  constructor(a: Human, b: Human) {
    this.a = a;
    this.b = b;
    a.state = b.state = 'script';
    const ball = new THREE.Group() as any;
    this.ball = mbox(0.3, 0.3, 0.3, 0xffffff) as any;
    const stripe = mbox(0.31, 0.1, 0.31, 0xe53935);
    this.ball.add(stripe);
    void ball;
    ctx.scene.add(this.ball);
    ctx.scene.add(this.shadow);
    this.reset();
  }

  spot(k: Human) {
    return k === this.a ? ctx.world.pts.kidA : ctx.world.pts.kidB;
  }

  reset() {
    for (const k of [this.a, this.b]) {
      k.reset();
      k.state = 'script';
    }
    this.mode = 'play';
    this.ballState = 'atA';
    this.ballT = 0;
    this.cool = 5;
    this.chaser = null;
    ctx.scene.add(this.ball);
    this.ball.rotation.set(0, 0, 0);
    this.ball.scale.setScalar(1);
    this.ball.visible = true;
    this.placeBallAt(this.a);
  }

  placeBallAt(k: Human) {
    const f = Math.sin(k.yaw), g = Math.cos(k.yaw);
    this.ball.position.set(k.body.x + f * 0.55, 0.15, k.body.z + g * 0.55);
  }

  ballGrabbable() {
    return this.ballState === 'atA' || this.ballState === 'atB' || this.ballState === 'ground';
  }

  grabBall() {
    this.ballState = 'cat';
    this.mode = 'chase';
    this.modeT = 0;
    this.chaser = null;
    this.a.say(NPC_LINES.kidBall, 2.2, 'shout');
    sfx.laugh();
  }

  droppedBall(p: THREE.Vector3) {
    this.ballState = 'ground';
    ctx.scene.add(this.ball);
    this.ball.position.set(p.x, p.y + 0.15, p.z);
    this.ball.rotation.set(0, 0, 0);
    this.ball.scale.setScalar(1);
    if (this.mode !== 'hug') {
      this.mode = 'fetch';
      this.modeT = 0;
    }
  }

  returnBall() {
    if (ctx.cat.carrying?.id === 'bola') ctx.cat.carrying = null;
    ctx.scene.add(this.ball);
    this.ball.rotation.set(0, 0, 0);
    this.ball.scale.setScalar(1);
    this.ballState = 'atA';
    this.placeBallAt(this.a);
  }

  kidMove(k: Human, tx: number, tz: number, sp: number, dt: number) {
    const d = k.moveToward(tx, tz, sp, dt);
    k.pose = d > 0.2 ? (sp > 2.5 ? 'walk' : 'walk') : 'idle';
    return d;
  }

  update(dt: number) {
    const cat = ctx.cat;
    const cb = cat.body;
    this.modeT += dt;
    this.cool -= dt;
    const inPark = cb.x > -30 && cb.x < 12 && cb.z > 5 && cb.z < 39;
    const playing = ctx.mode === 'play' && !ctx.dialogOpen;
    const carryingBall = cat.carrying?.id === 'bola';
    if (this.mode === 'play') {
      for (const k of [this.a, this.b]) {
        const s = this.spot(k);
        const d = this.kidMove(k, s.x, s.z, 2, dt);
        if (d < 0.3) {
          const other = k === this.a ? this.b : this.a;
          k.yaw = angleLerp(k.yaw, Math.atan2(other.body.x - k.body.x, other.body.z - k.body.z), 1 - Math.exp(-6 * dt));
        }
      }
      this.ballT += dt;
      if ((this.ballState === 'atA' || this.ballState === 'atB') && this.ballT > 1.6) {
        const kicker = this.ballState === 'atA' ? this.a : this.b;
        const recv = kicker === this.a ? this.b : this.a;
        this.from.copy(this.ball.position);
        const f = Math.sin(recv.yaw), g = Math.cos(recv.yaw);
        this.to.set(recv.body.x + f * 0.55, 0.15, recv.body.z + g * 0.55);
        this.ballState = 'fly';
        this.ballT = 0;
        kicker.pose = 'wave';
        sfx.thud(0.12);
        (this as any).recv = recv;
      }
      // spot the cat -> come to hug
      this.seeT -= dt;
      if (playing && this.seeT < 0 && this.cool < 0 && inPark && cat.state === 'free') {
        this.seeT = 1;
        for (const k of [this.a, this.b]) {
          if (Math.hypot(cb.x - k.body.x, cb.z - k.body.z) < 6 && Math.random() < 0.35) {
            this.mode = 'chase';
            this.modeT = 0;
            this.chaser = k;
            k.say(NPC_LINES.kidSee, 2);
            break;
          }
        }
      }
    }
    if (this.ballState === 'fly') {
      this.ballT += dt;
      const k = clamp(this.ballT / 1.1, 0, 1);
      this.ball.position.lerpVectors(this.from, this.to, k);
      this.ball.position.y = 0.15 + Math.sin(k * Math.PI) * 1.6;
      this.ball.rotation.x += dt * 10;
      if (k >= 1) {
        const recv = (this as any).recv as Human;
        this.ballState = recv === this.a ? 'atA' : 'atB';
        this.ballT = 0;
        sfx.thud(0.08);
      }
    }
    if (this.mode === 'chase') {
      const chasers = this.chaser ? [this.chaser] : [this.a, this.b];
      const reachable = cb.y < 0.7;
      let caught: Human | null = null;
      for (const k of chasers) {
        const d = this.kidMove(k, cb.x, cb.z, 3.3, dt);
        k.pose = 'hug';
        if (d < 0.95 && reachable && cat.state === 'free' && playing) caught = k;
        if (Math.random() < dt * 0.4) k.say(carryingBall ? NPC_LINES.kidBall : NPC_LINES.kidSee, 1.6);
      }
      if (caught) {
        this.mode = 'hug';
        this.modeT = 0;
        this.chaser = caught;
        if (carryingBall) {
          ctx.cat.carrying = null;
          this.returnBall();
        }
        cat.setState('hugged');
        cat.hugger = caught;
        caught.say(NPC_LINES.kidHug, 2);
        sfx.laugh();
        ctx.onHugged?.();
      } else if (this.modeT > 7 || !inPark || !playing) {
        this.mode = this.ballState === 'ground' ? 'fetch' : 'play';
        this.modeT = 0;
        this.cool = 8;
        if (this.ballState === 'cat' && !carryingBall) this.ballState = 'ground';
      }
    }
    if (this.mode === 'hug') {
      const k = this.chaser!;
      k.body.vx = k.body.vz = 0;
      k.pose = 'hug';
      const hp = new THREE.Vector3();
      k.model.holdSlot.getWorldPosition(hp);
      cat.body.x = hp.x;
      cat.body.y = hp.y - 0.3;
      cat.body.z = hp.z;
      cat.yaw = k.yaw + Math.PI;
      if (Math.random() < dt * 3) ctx.fx.hearts(hp.x, hp.y + 0.5, hp.z, 1);
      if (this.modeT > 1.9) {
        const f = Math.sin(k.yaw), g = Math.cos(k.yaw);
        cat.body.x = k.body.x + f * 0.9;
        cat.body.z = k.body.z + g * 0.9;
        cat.body.y = 0;
        cat.setState('free');
        cat.hugger = null;
        this.mode = this.ballState === 'ground' ? 'fetch' : 'play';
        this.modeT = 0;
        this.cool = 14;
      }
    }
    if (this.mode === 'fetch') {
      if (this.ballState === 'ground') {
        const k = this.a;
        const d = this.kidMove(k, this.ball.position.x, this.ball.position.z, 2.2, dt);
        this.kidMove(this.b, this.spot(this.b).x, this.spot(this.b).z, 2, dt);
        if (d < 0.6) {
          this.ballState = 'atA';
          this.mode = 'play';
          this.ballT = 0;
        }
        if (this.modeT > 20) {
          this.returnBall();
          this.mode = 'play';
        }
      } else {
        this.mode = 'play';
      }
    }
    if (this.mode === 'play' && (this.ballState === 'atA' || this.ballState === 'atB') && this.ballT > 0.2) {
      const k = this.ballState === 'atA' ? this.a : this.b;
      if (Math.hypot(k.body.x - this.spot(k).x, k.body.z - this.spot(k).z) < 0.4) this.placeBallAt(k);
    } else if (this.mode === 'play' && this.ballState === 'ground') {
      this.mode = 'fetch';
    }
    this.ball.visible = this.ballState !== 'cat';
    this.shadow.visible = this.ball.visible;
    this.shadow.position.set(this.ball.position.x, 0.02, this.ball.position.z);
    for (const k of [this.a, this.b]) k.update(dt);
  }
}
