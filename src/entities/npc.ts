import * as THREE from 'three';
import { ctx, damp, angleLerp, angleDiff, rand, pick, clamp } from '../ctx';
import { HumanModel, type HumanOpts, type HumanPose } from './humanModel';
import type { Body } from '../world/physics';
import { blobShadow } from './cat';
import { sfx } from '../audio';
import { L, type Pair } from '../i18n';

const P = (id: string, en: string): Pair => ({ id, en });

const LINES = {
  alert: [P('Heh! Kucing nakal!', 'Hey! Naughty cat!'), P('Eh eh eh!', 'Hey hey hey!'), P('Astaga!', 'Oh my!'), P('Waduh!', 'Oh no!')],
  shoo: [P('Hush! Hush!', 'Shoo! Shoo!'), P('Sana! Sana!', 'Go away!'), P('Husss!', 'Shoooo!')],
  gone: [P('Awas ya!', 'Watch it!'), P('Dasar kucing!', 'Silly cat!'), P('Huh, kabur...', 'Hmph, it ran...')],
  look: [P('Hm? Suara apa itu?', 'Hm? What was that?'), P('Ada apa ya?', "What's going on?")],
  kidSee: [P('Kucing lucu!', 'Cute kitty!'), P('Pus! Pus! Sini!', 'Here kitty kitty!'), P('Aku mau peluk!', 'I wanna hug it!')],
  kidBall: [P('Balikin bolanya!', 'Give our ball back!'), P('Hahaha! Kucingnya ambil bola!', 'Haha! The cat took the ball!')],
  kidHug: [P('Hihihi, lembut!', 'Hehe, so soft!'), P('Sayang kucing!', 'Love you kitty!')],
  sweep: [P('Nyapu dulu ah...', 'Time to sweep...'), P('Hmm hmm hmm~', 'Hmm hmm hmm~')],
  sell: [P('Ikan segar! Ikan segar!', 'Fresh fish! Fresh fish!'), P('Murah, murah!', 'Cheap, cheap!')],
  meow: [P('Eh, ada kucing.', 'Oh, a kitty.'), P('Meong juga!', 'Meow to you too!')],
};

export interface Owned {
  ids: string[];
}

export class Human {
  model: HumanModel;
  body: Body;
  yaw = 0;
  name: string;
  role: 'adult' | 'kid' | 'mama';
  voice: number;
  path: THREE.Vector3[] = [];
  pathI = 0;
  waitT = 0;
  state = 'patrol';
  stateT = 0;
  pose: HumanPose = 'idle';
  zone: { x0: number; z0: number; x1: number; z1: number };
  owns: string[] = [];
  range = 9;
  fov = 1.1; // half angle (rad)
  lookAt = new THREE.Vector3();
  lookT = 0;
  checkT = 0;
  shadow = blobShadow(1.1);
  jumpY = 0;
  idlePose: HumanPose = 'idle';
  idleLines: Pair[] = [];
  lineT = rand(6, 14);
  home: THREE.Vector3;
  speed = 1.7;
  chaseSpeed = 3.7;
  cooldown = 0;
  onCatch: ((h: Human) => void) | null = null;
  active = true;
  homeYaw = 0;
  goal: THREE.Vector3 | null = null;
  goalSpeed = 1.8;
  goalCb: (() => void) | null = null;

  walkTo(p: THREE.Vector3, speed = 1.8) {
    return new Promise<void>((res) => {
      this.goal = p.clone();
      this.goalSpeed = speed;
      this.goalCb = res;
    });
  }

  constructor(name: string, opts: HumanOpts, role: Human['role'], home: THREE.Vector3, zone: Human['zone'], voice = 1) {
    this.name = name;
    this.role = role;
    this.voice = voice;
    this.model = new HumanModel(opts);
    this.home = home.clone();
    this.zone = zone;
    const kid = role === 'kid';
    this.body = { x: home.x, y: home.y, z: home.z, vx: 0, vy: 0, vz: 0, r: kid ? 0.25 : 0.33, h: kid ? 1.4 : 2.2, onGround: true, stepH: 0.32, climbH: 0, g: 18 };
    ctx.scene.add(this.model.root);
    ctx.scene.add(this.shadow);
    if (kid) this.shadow.scale.set(0.7, 0.7, 0.7);
  }

  reset() {
    this.body.x = this.home.x;
    this.body.y = this.home.y;
    this.body.z = this.home.z;
    this.body.vx = this.body.vz = 0;
    this.state = 'patrol';
    this.stateT = 0;
    this.pathI = 0;
    this.waitT = rand(0, 2);
    this.cooldown = 0;
    this.model.setMouth('smile');
    this.sync();
  }

  sync() {
    this.model.root.position.set(this.body.x, this.body.y + this.jumpY, this.body.z);
    this.model.root.rotation.y = this.yaw;
    this.shadow.position.set(this.body.x, this.body.y + 0.02, this.body.z);
  }

  say(p: Pair | Pair[], ttl = 2.2, kind: 'speech' | 'shout' = 'speech') {
    const line = Array.isArray(p) ? pick(p) : p;
    const txt = L(line);
    ctx.bubbles.say(this.model.root, txt, { ttl, y: this.model.height + 0.5, kind, key: 'npc-' + this.name });
    for (let i = 0; i < Math.min(8, txt.length / 3); i++) setTimeout(() => sfx.voice(this.voice), i * 70);
  }

  canSee(tx: number, ty: number, tz: number) {
    const b = this.body;
    const dx = tx - b.x, dz = tz - b.z;
    const d = Math.hypot(dx, dz);
    if (d > this.range) return false;
    if (d > 1.5) {
      const ang = Math.atan2(dx, dz);
      if (Math.abs(angleDiff(this.yaw, ang)) > this.fov) return false;
    }
    const eye = b.y + this.model.height * 0.85;
    return ctx.world.phys.lineOfSight(b.x, eye, b.z, tx, ty + 0.3, tz);
  }

  catSuspicious() {
    const cat = ctx.cat;
    if (ctx.time - cat.lastMischiefT < 2.5 && cat.lastMischiefPos.distanceTo(cat.pos) < 6) return true;
    if (cat.carrying && this.owns.includes(cat.carrying.id)) return true;
    return false;
  }

  hear(x: number, z: number, radius: number) {
    if (!this.active || this.role === 'mama') return;
    const d = Math.hypot(x - this.body.x, z - this.body.z);
    if (d > radius) return;
    if (this.state === 'patrol' || this.state === 'wait') {
      this.state = 'look';
      this.stateT = 0;
      this.lookAt.set(x, 0, z);
      if (Math.random() < 0.6) this.say(LINES.look, 1.6);
      else ctx.bubbles.say(this.model.root, '?', { ttl: 1.2, y: this.model.height + 0.4, kind: 'emote', key: 'npc-' + this.name });
    }
  }

  inZone(x: number, z: number, m = 0) {
    const zn = this.zone;
    return x > zn.x0 - m && x < zn.x1 + m && z > zn.z0 - m && z < zn.z1 + m;
  }

  moveToward(tx: number, tz: number, sp: number, dt: number) {
    const b = this.body;
    const dx = tx - b.x, dz = tz - b.z;
    const d = Math.hypot(dx, dz);
    if (d < 0.05) {
      b.vx = damp(b.vx, 0, 10, dt);
      b.vz = damp(b.vz, 0, 10, dt);
      return d;
    }
    b.vx = damp(b.vx, (dx / d) * sp, 8, dt);
    b.vz = damp(b.vz, (dz / d) * sp, 8, dt);
    this.yaw = angleLerp(this.yaw, Math.atan2(dx, dz), 1 - Math.exp(-8 * dt));
    return d;
  }

  alert() {
    this.state = 'alert';
    this.stateT = 0;
    this.model.setMouth('o');
    sfx.tone(700, 0.15, 'square', 0.08, 0, 1100);
    this.say(LINES.alert, 1.4, 'shout');
    ctx.onSpotted?.(this);
  }

  update(dt: number) {
    if (!this.active) {
      this.model.root.visible = false;
      this.shadow.visible = false;
      return;
    }
    this.model.root.visible = true;
    this.shadow.visible = true;
    const b = this.body;
    const cat = ctx.cat;
    const cb = cat.body;
    this.stateT += dt;
    this.cooldown -= dt;
    let pose: HumanPose = 'idle';
    let spd = 1;
    const playing = ctx.mode === 'play' && !ctx.dialogOpen;

    // periodic sight check
    this.checkT -= dt;
    if (playing && this.checkT < 0 && this.role === 'adult') {
      this.checkT = 0.2;
      if ((this.state === 'patrol' || this.state === 'wait' || this.state === 'look') && this.cooldown <= 0 && cat.state !== 'hugged' && cat.state !== 'cut') {
        if (this.catSuspicious() && this.canSee(cb.x, cb.y, cb.z)) this.alert();
      }
    }

    switch (this.state) {
      case 'patrol': {
        if (!this.path.length) {
          pose = this.idlePose;
          b.vx = b.vz = 0;
          this.yaw = angleLerp(this.yaw, this.homeYaw, 1 - Math.exp(-3 * dt));
          this.lineT -= dt;
          if (this.lineT < 0 && this.idleLines.length && playing) {
            this.lineT = rand(10, 20);
            if (Math.hypot(cb.x - b.x, cb.z - b.z) < 14) this.say(this.idleLines, 2.2);
          }
          break;
        }
        const t = this.path[this.pathI];
        const d = this.moveToward(t.x, t.z, this.speed, dt);
        pose = 'walk';
        if (d < 0.3) {
          this.state = 'wait';
          this.stateT = 0;
          this.waitT = rand(1.5, 4);
        }
        break;
      }
      case 'wait': {
        b.vx = damp(b.vx, 0, 10, dt);
        b.vz = damp(b.vz, 0, 10, dt);
        pose = this.idlePose;
        if (this.stateT > this.waitT) {
          this.pathI = (this.pathI + 1) % Math.max(1, this.path.length);
          this.state = 'patrol';
        }
        this.lineT -= dt;
        if (this.lineT < 0 && this.idleLines.length && playing) {
          this.lineT = rand(10, 20);
          const d = Math.hypot(cb.x - b.x, cb.z - b.z);
          if (d < 14) this.say(this.idleLines, 2.2);
        }
        break;
      }
      case 'look': {
        b.vx = damp(b.vx, 0, 10, dt);
        b.vz = damp(b.vz, 0, 10, dt);
        this.yaw = angleLerp(this.yaw, Math.atan2(this.lookAt.x - b.x, this.lookAt.z - b.z), 1 - Math.exp(-6 * dt));
        pose = 'idle';
        // they put two and two together if they see the cat near the noise
        if (playing && this.stateT > 0.3 && this.cooldown <= 0 && cat.state !== 'hugged') {
          const near = Math.hypot(cb.x - this.lookAt.x, cb.z - this.lookAt.z) < 4;
          if (near && ctx.time - cat.lastMischiefT < 4 && this.canSee(cb.x, cb.y, cb.z)) this.alert();
        }
        if (this.stateT > 2.2) this.state = 'patrol';
        break;
      }
      case 'alert': {
        b.vx = b.vz = 0;
        this.yaw = angleLerp(this.yaw, Math.atan2(cb.x - b.x, cb.z - b.z), 1 - Math.exp(-10 * dt));
        pose = 'surprised';
        this.jumpY = Math.max(0, Math.sin(clamp(this.stateT / 0.35, 0, 1) * Math.PI) * 0.35);
        if (this.stateT > 0.7) {
          this.jumpY = 0;
          this.state = 'chase';
          this.stateT = 0;
          this.model.setMouth('frown');
          sfx.shoo();
          this.say(LINES.shoo, 2, 'shout');
        }
        break;
      }
      case 'chase': {
        pose = 'shoo';
        spd = 1.4;
        const reachable = cb.y - b.y < 0.9;
        const inArea = this.inZone(cb.x, cb.z, 2.5);
        if (!reachable || !inArea || this.stateT > 5 || cat.state === 'hugged' || cat.state === 'cut') {
          this.state = 'giveup';
          this.stateT = 0;
          this.say(LINES.gone, 1.8, 'shout');
          break;
        }
        const d = this.moveToward(cb.x, cb.z, this.chaseSpeed, dt);
        if (Math.random() < dt * 0.8) {
          sfx.shoo();
          this.say(LINES.shoo, 1.4, 'shout');
        }
        if (d < 1.15 && cat.state !== 'knock') {
          // shooed!
          cat.knock(b.x, b.z, 5.5, 4.5);
          ctx.onShooed?.(this);
          this.onCatch?.(this);
          this.state = 'giveup';
          this.stateT = 0;
          this.cooldown = 4;
        }
        break;
      }
      case 'giveup': {
        b.vx = damp(b.vx, 0, 8, dt);
        b.vz = damp(b.vz, 0, 8, dt);
        pose = 'point';
        this.yaw = angleLerp(this.yaw, Math.atan2(cb.x - b.x, cb.z - b.z), 1 - Math.exp(-6 * dt));
        if (this.stateT > 1.6) {
          this.model.setMouth('smile');
          this.state = 'return';
          this.cooldown = Math.max(this.cooldown, 2.5);
        }
        break;
      }
      case 'return': {
        const t = this.path.length ? this.path[this.pathI] : this.home;
        const d = this.moveToward(t.x, t.z, this.speed * 1.2, dt);
        pose = 'walk';
        if (d < 0.4) {
          this.state = 'wait';
          this.stateT = 0;
          this.waitT = 1;
        }
        if (this.stateT > 12) {
          // stuck: teleport home
          b.x = t.x;
          b.z = t.z;
          this.state = 'wait';
        }
        break;
      }
      case 'script': {
        if (this.goal) {
          const d = this.moveToward(this.goal.x, this.goal.z, this.goalSpeed, dt);
          this.pose = 'walk';
          if (d < 0.25) {
            this.goal = null;
            b.vx = b.vz = 0;
            this.pose = 'idle';
            const cb = this.goalCb;
            this.goalCb = null;
            cb?.();
          }
        }
        pose = this.pose;
        spd = 1;
        break;
      }
    }
    if (this.state !== 'script') this.pose = pose;
    if (this.state !== 'script' || Math.hypot(b.vx, b.vz) > 0.01) ctx.world.phys.move(b, dt);
    if (this.state === 'script' && this.pose === 'walk' && Math.hypot(b.vx, b.vz) < 0.05) this.pose = 'idle';
    // push the cat gently out of the way (and vice versa)
    if (cat.state === 'free' || cat.state === 'knock') {
      const dx = cb.x - b.x, dz = cb.z - b.z;
      const d = Math.hypot(dx, dz);
      const min = b.r + cb.r;
      if (d < min && d > 0.001 && Math.abs(cb.y - b.y) < 1.0) {
        cb.x += (dx / d) * (min - d);
        cb.z += (dz / d) * (min - d);
      }
    }
    this.model.update(dt, this.pose, spd);
    this.sync();
  }

  catchLines = LINES;
}

export const NPC_LINES = LINES;
