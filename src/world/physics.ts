import type { AABB } from './builder';

export interface Body {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  r: number; // half width (square footprint)
  h: number; // height
  onGround: boolean;
  stepH: number; // auto step-up height
  climbH: number; // ledge assist while airborne (0 = off)
  g: number; // gravity
  hitWall?: boolean;
  climbed?: boolean;
  landed?: boolean;
  fallFrom?: number;
}

// Axis-aligned box world with a uniform grid for fast queries.
export class Physics {
  list: AABB[] = [];
  grid = new Map<number, AABB[]>();
  cs = 4;
  stamp = 1;
  private tmp: AABB[] = [];

  constructor(cols: AABB[]) {
    for (const c of cols) this.add(c);
  }

  private k(ix: number, iz: number) {
    return (ix + 2000) * 8192 + (iz + 2000);
  }

  add(a: AABB) {
    this.list.push(a);
    const x0 = Math.floor(a.minX / this.cs), x1 = Math.floor(a.maxX / this.cs);
    const z0 = Math.floor(a.minZ / this.cs), z1 = Math.floor(a.maxZ / this.cs);
    for (let ix = x0; ix <= x1; ix++)
      for (let iz = z0; iz <= z1; iz++) {
        const key = this.k(ix, iz);
        let cell = this.grid.get(key);
        if (!cell) this.grid.set(key, (cell = []));
        cell.push(a);
      }
  }

  query(x0: number, z0: number, x1: number, z1: number): AABB[] {
    const out = this.tmp;
    out.length = 0;
    const s = ++this.stamp;
    const ix0 = Math.floor(x0 / this.cs), ix1 = Math.floor(x1 / this.cs);
    const iz0 = Math.floor(z0 / this.cs), iz1 = Math.floor(z1 / this.cs);
    for (let ix = ix0; ix <= ix1; ix++)
      for (let iz = iz0; iz <= iz1; iz++) {
        const cell = this.grid.get(this.k(ix, iz));
        if (!cell) continue;
        for (const a of cell) {
          if (a.qm === s || a.off) continue;
          a.qm = s;
          if (a.maxX < x0 || a.minX > x1 || a.maxZ < z0 || a.minZ > z1) continue;
          out.push(a);
        }
      }
    return out;
  }

  // Highest surface at or below `fromY` under the footprint.
  groundAt(x: number, z: number, r: number, fromY: number) {
    let best = -50;
    const q = this.query(x - r, z - r, x + r, z + r);
    for (const a of q) {
      if (x + r <= a.minX || x - r >= a.maxX || z + r <= a.minZ || z - r >= a.maxZ) continue;
      if (a.maxY <= fromY + 0.001 && a.maxY > best) best = a.maxY;
    }
    return best;
  }

  ceilAt(x: number, z: number, r: number, fromY: number) {
    let best = 1e9;
    const q = this.query(x - r, z - r, x + r, z + r);
    for (const a of q) {
      if (x + r <= a.minX || x - r >= a.maxX || z + r <= a.minZ || z - r >= a.maxZ) continue;
      if (a.minY >= fromY - 0.02 && a.minY < best) best = a.minY;
    }
    return best;
  }

  // Is the box region free of colliders?
  free(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    const q = this.query(x0, z0, x1, z1);
    for (const a of q) {
      if (x1 <= a.minX || x0 >= a.maxX || z1 <= a.minZ || z0 >= a.maxZ) continue;
      if (y1 <= a.minY || y0 >= a.maxY) continue;
      return false;
    }
    return true;
  }

  // Ray against boxes, returns hit distance (or maxD).
  raycast(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxD: number, camOnly = true) {
    const ex = ox + dx * maxD, ez = oz + dz * maxD;
    const q = this.query(Math.min(ox, ex), Math.min(oz, ez), Math.max(ox, ex), Math.max(oz, ez));
    let best = maxD;
    const idx = dx !== 0 ? 1 / dx : 1e12, idy = dy !== 0 ? 1 / dy : 1e12, idz = dz !== 0 ? 1 / dz : 1e12;
    for (const a of q) {
      if (camOnly && !a.cam) continue;
      let t1 = (a.minX - ox) * idx, t2 = (a.maxX - ox) * idx;
      let tmin = Math.min(t1, t2), tmax = Math.max(t1, t2);
      t1 = (a.minY - oy) * idy;
      t2 = (a.maxY - oy) * idy;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
      t1 = (a.minZ - oz) * idz;
      t2 = (a.maxZ - oz) * idz;
      tmin = Math.max(tmin, Math.min(t1, t2));
      tmax = Math.min(tmax, Math.max(t1, t2));
      if (tmax >= Math.max(tmin, 0) && tmin < best) {
        if (tmin < 0) continue; // origin inside box: ignore
        best = tmin;
      }
    }
    return best;
  }

  lineOfSight(ax: number, ay: number, az: number, bx: number, by: number, bz: number) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const d = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (d < 0.01) return true;
    const t = this.raycast(ax, ay, az, dx / d, dy / d, dz / d, d, false);
    return t >= d - 0.05;
  }

  move(b: Body, dt: number) {
    b.hitWall = false;
    b.climbed = false;
    b.landed = false;
    const sp = Math.max(Math.abs(b.vx), Math.abs(b.vz)) * dt;
    const n = Math.max(1, Math.ceil(sp / (b.r * 0.7)));
    const sdt = dt / n;
    for (let i = 0; i < n; i++) {
      b.x += b.vx * sdt;
      this.resolve(b, 0);
      b.z += b.vz * sdt;
      this.resolve(b, 1);
    }
    b.vy -= b.g * dt;
    if (b.vy < -30) b.vy = -30;
    const ny = b.y + b.vy * dt;
    const wasGround = b.onGround;
    if (b.vy <= 0) {
      const g = this.groundAt(b.x, b.z, b.r * 0.85, b.y + 0.03);
      if (ny <= g) {
        if (!wasGround) b.landed = true;
        b.y = g;
        b.vy = 0;
        b.onGround = true;
      } else {
        if (wasGround) b.fallFrom = b.y;
        b.y = ny;
        b.onGround = false;
      }
    } else {
      const c = this.ceilAt(b.x, b.z, b.r * 0.85, b.y + b.h);
      if (ny + b.h >= c) {
        b.y = c - b.h;
        b.vy = 0;
      } else b.y = ny;
      b.onGround = false;
    }
  }

  private resolve(b: Body, axis: 0 | 1) {
    const q = this.query(b.x - b.r, b.z - b.r, b.x + b.r, b.z + b.r);
    // copy because nested queries reuse the buffer
    const cand = q.slice();
    for (const a of cand) {
      if (a.maxY <= b.y + 0.001 || a.minY >= b.y + b.h - 0.001) continue;
      if (b.x + b.r <= a.minX || b.x - b.r >= a.maxX || b.z + b.r <= a.minZ || b.z - b.r >= a.maxZ) continue;
      const rise = a.maxY - b.y;
      if (rise <= b.stepH && b.vy <= 0.5) {
        if (this.ceilAt(b.x, b.z, b.r * 0.85, a.maxY + 0.01) >= a.maxY + b.h) {
          b.y = a.maxY;
          continue;
        }
      }
      if (b.climbH > 0 && !b.onGround && rise <= b.climbH && b.vy < 2.2) {
        if (this.ceilAt(b.x, b.z, b.r * 0.85, a.maxY + 0.01) >= a.maxY + b.h) {
          b.y = a.maxY;
          b.vy = 0;
          b.onGround = true;
          b.climbed = true;
          continue;
        }
      }
      b.hitWall = true;
      // push out the shorter way along the axis we just moved on
      if (axis === 0) {
        const pl = b.x + b.r - a.minX, pr = a.maxX - (b.x - b.r);
        if (pl < pr) b.x = a.minX - b.r - 0.0005;
        else b.x = a.maxX + b.r + 0.0005;
      } else {
        const pl = b.z + b.r - a.minZ, pr = a.maxZ - (b.z - b.r);
        if (pl < pr) b.z = a.minZ - b.r - 0.0005;
        else b.z = a.maxZ + b.r + 0.0005;
      }
    }
  }
}
