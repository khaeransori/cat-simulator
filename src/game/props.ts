import * as THREE from 'three';
import { ctx, rand } from '../ctx';
import { boxGeo, lam } from '../world/builder';

// Simple rigid-ish falling objects: pushed off a table, they arc, spin,
// land and either break, bounce, or roll to a stop.
export interface Faller {
  obj: THREE.Object3D;
  vx: number;
  vy: number;
  vz: number;
  wx: number;
  wz: number;
  r: number;
  g: number;
  drag: number;
  bounces: number;
  roll: boolean;
  onLand?: (x: number, y: number, z: number) => void;
  done: boolean;
  settle: number;
  flutter: number;
  bottom: number; // how far the object hangs below its origin
  flat?: boolean; // lie flat when landing (laundry)
}

export class PropSystem {
  fallers: Faller[] = [];
  trail: THREE.Mesh[] = [];
  trailActive = 0;
  trailLast = new THREE.Vector3();
  puddles: THREE.Mesh[] = [];
  decals: THREE.Object3D[] = [];

  fall(obj: THREE.Object3D, vx: number, vy: number, vz: number, o: Partial<Faller> = {}) {
    // make sure it's a top-level object in world space
    if (obj.parent && obj.parent !== ctx.scene) {
      const wp = new THREE.Vector3();
      const wq = new THREE.Quaternion();
      obj.getWorldPosition(wp);
      obj.getWorldQuaternion(wq);
      ctx.scene.add(obj);
      obj.position.copy(wp);
      obj.quaternion.copy(wq);
    }
    const f: Faller = {
      obj,
      vx,
      vy,
      vz,
      wx: o.wx ?? rand(-6, 6),
      wz: o.wz ?? rand(-6, 6),
      r: o.r ?? 0.12,
      g: o.g ?? 16,
      drag: o.drag ?? 0,
      bounces: o.bounces ?? 2,
      roll: o.roll ?? false,
      onLand: o.onLand,
      done: false,
      settle: 0,
      flutter: o.flutter ?? 0,
      bottom: o.bottom ?? 0,
      flat: o.flat,
    };
    this.fallers.push(f);
    return f;
  }

  update(dt: number) {
    const phys = ctx.world.phys;
    for (let i = this.fallers.length - 1; i >= 0; i--) {
      const f = this.fallers[i];
      const p = f.obj.position;
      f.vy -= f.g * dt;
      if (f.drag) {
        f.vx *= 1 - f.drag * dt;
        f.vz *= 1 - f.drag * dt;
        if (f.vy < -2.2) f.vy = -2.2;
      }
      const nx = p.x + f.vx * dt, nz = p.z + f.vz * dt;
      if (!phys.free(nx - f.r, p.y + 0.02, nz - f.r, nx + f.r, p.y + f.r * 2, nz + f.r)) {
        f.vx *= -0.3;
        f.vz *= -0.3;
      } else {
        p.x = nx;
        p.z = nz;
      }
      if (f.flutter) {
        p.x += Math.sin(ctx.time * 5 + i) * f.flutter * dt;
        f.obj.rotation.z = Math.sin(ctx.time * 4 + i) * 0.5;
      } else {
        f.obj.rotation.x += f.wx * dt;
        f.obj.rotation.z += f.wz * dt;
      }
      p.y += f.vy * dt;
      const ground = phys.groundAt(p.x, p.z, f.r * 0.8, p.y - f.bottom + 0.3);
      if (p.y - f.bottom <= ground && f.vy < 0) {
        p.y = ground + (f.flat ? 0.03 : f.bottom);
        if (f.flat) {
          f.obj.rotation.set(-Math.PI / 2, f.obj.rotation.y, 0);
          f.vy = 0;
          f.bounces = 0;
          f.flutter = 0;
          f.vx = f.vz = 0;
        }
        if (f.onLand && !f.done) {
          f.done = true;
          f.onLand(p.x, ground, p.z);
        }
        if (f.bounces > 0 && Math.abs(f.vy) > 1.5) {
          f.bounces--;
          f.vy = Math.abs(f.vy) * 0.35;
          f.vx *= 0.6;
          f.vz *= 0.6;
          f.wx *= 0.5;
          f.wz *= 0.5;
        } else {
          f.vy = 0;
          if (f.roll) {
            f.vx *= 1 - 1.6 * dt;
            f.vz *= 1 - 1.6 * dt;
            f.obj.rotation.x += f.vz * dt * 5;
            f.obj.rotation.z -= f.vx * dt * 5;
            if (Math.hypot(f.vx, f.vz) < 0.05) this.fallers.splice(i, 1);
          } else {
            // settle flat
            f.obj.rotation.x = Math.round(f.obj.rotation.x / (Math.PI / 2)) * (Math.PI / 2);
            f.obj.rotation.z = Math.round(f.obj.rotation.z / (Math.PI / 2)) * (Math.PI / 2);
            this.fallers.splice(i, 1);
          }
        }
      }
    }
    // tissue trail following the cat
    if (this.trailActive > 0) {
      this.trailActive -= dt;
      const c = ctx.cat.body;
      const d = Math.hypot(c.x - this.trailLast.x, c.z - this.trailLast.z);
      if (d > 0.28 && c.onGround) {
        const m = new THREE.Mesh(boxGeo(0.22, 0.015, 0.3), lam(0xffffff));
        m.position.set((c.x + this.trailLast.x) / 2, c.y + 0.012, (c.z + this.trailLast.z) / 2);
        m.rotation.y = Math.atan2(c.x - this.trailLast.x, c.z - this.trailLast.z) + rand(-0.2, 0.2);
        m.scale.z = d / 0.3;
        ctx.scene.add(m);
        this.trail.push(m);
        this.trailLast.set(c.x, c.y, c.z);
      }
    }
  }

  startTrail(from: THREE.Vector3) {
    this.trailActive = 6;
    this.trailLast.copy(from);
  }

  puddle(x: number, y: number, z: number, color = 0x4fa3e0, size = 1.4) {
    const m = new THREE.Mesh(boxGeo(size, 0.01, size * 0.8), new THREE.MeshLambertMaterial({ color, transparent: true, opacity: 0.75 }));
    m.position.set(x, y + 0.012, z);
    m.rotation.y = rand(0, Math.PI);
    ctx.scene.add(m);
    this.puddles.push(m);
    return m;
  }

  decal(o: THREE.Object3D) {
    ctx.scene.add(o);
    this.decals.push(o);
  }

  clear() {
    this.fallers.length = 0;
    for (const m of this.trail) ctx.scene.remove(m);
    this.trail.length = 0;
    this.trailActive = 0;
    for (const m of this.puddles) ctx.scene.remove(m);
    this.puddles.length = 0;
    for (const d of this.decals) ctx.scene.remove(d);
    this.decals.length = 0;
  }
}
