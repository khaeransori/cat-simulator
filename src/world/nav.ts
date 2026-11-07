// Simple navigation for walking NPCs: straight line when clear, otherwise a
// small grid A* around obstacles. Grids are built on demand per search (the
// physics world can change: gates open), so no precomputation is needed.
import type { Physics, Body } from './physics';

const CELL = 0.4;
const MAX_NODES = 24000;

/** Is a body-sized box free at (x, z)? Low steps (< stepH) are ignored. */
export function clearAt(P: Physics, b: Body, x: number, z: number, pad = 1.02) {
  const r = b.r * pad;
  return P.free(x - r, b.y + b.stepH + 0.02, z - r, x + r, b.y + b.h, z + r);
}

/** Can the body walk in a straight line from its position to (tx, tz)? */
export function lineClear(P: Physics, b: Body, x0: number, z0: number, tx: number, tz: number) {
  const d = Math.hypot(tx - x0, tz - z0);
  const n = Math.max(1, Math.ceil(d / 0.25));
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    if (!clearAt(P, b, x0 + (tx - x0) * k, z0 + (tz - z0) * k)) return false;
  }
  return true;
}

export interface NavBounds {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * Path from the body to (tx, tz) as a list of [x, z] waypoints (the last one may be
 * moved to the nearest free spot if the target itself is inside an obstacle).
 * Returns null when no path exists inside the bounds.
 */
export function findPath(P: Physics, b: Body, tx: number, tz: number, bounds: NavBounds): [number, number][] | null {
  const x0 = Math.min(bounds.x0, b.x, tx) - 2, z0 = Math.min(bounds.z0, b.z, tz) - 2;
  const x1 = Math.max(bounds.x1, b.x, tx) + 2, z1 = Math.max(bounds.z1, b.z, tz) + 2;
  const W = Math.ceil((x1 - x0) / CELL) + 1, H = Math.ceil((z1 - z0) / CELL) + 1;
  if (W * H > MAX_NODES * 4) return null;
  const blocked = new Int8Array(W * H).fill(-1); // -1 unknown, 0 free, 1 blocked
  const cx = (i: number) => x0 + (i % W) * CELL;
  const cz = (i: number) => z0 + Math.floor(i / W) * CELL;
  const isFree = (i: number) => {
    if (blocked[i] < 0) blocked[i] = clearAt(P, b, cx(i), cz(i), 1.08) ? 0 : 1;
    return blocked[i] === 0;
  };
  const idx = (x: number, z: number) => {
    const ix = Math.max(0, Math.min(W - 1, Math.round((x - x0) / CELL)));
    const iz = Math.max(0, Math.min(H - 1, Math.round((z - z0) / CELL)));
    return iz * W + ix;
  };
  const nearestFree = (i: number) => {
    if (isFree(i)) return i;
    const ix = i % W, iz = Math.floor(i / W);
    for (let r = 1; r < 12; r++)
      for (let dz = -r; dz <= r; dz++)
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
          const x = ix + dx, z = iz + dz;
          if (x < 0 || z < 0 || x >= W || z >= H) continue;
          const j = z * W + x;
          if (isFree(j)) return j;
        }
    return -1;
  };
  const s = nearestFree(idx(b.x, b.z));
  const g = nearestFree(idx(tx, tz));
  if (s < 0 || g < 0) return null;

  // A* (binary heap on f)
  const gs = new Float32Array(W * H).fill(Infinity);
  const from = new Int32Array(W * H).fill(-1);
  const closed = new Uint8Array(W * H);
  const heap: number[] = [];
  const fs: number[] = [];
  const hx = g % W, hz = Math.floor(g / W);
  const heur = (i: number) => {
    const dx = Math.abs((i % W) - hx), dz = Math.abs(Math.floor(i / W) - hz);
    return (dx + dz + (Math.SQRT2 - 2) * Math.min(dx, dz)) * CELL;
  };
  const push = (i: number, f: number) => {
    heap.push(i);
    fs.push(f);
    let k = heap.length - 1;
    while (k > 0) {
      const p = (k - 1) >> 1;
      if (fs[p] <= fs[k]) break;
      [heap[p], heap[k]] = [heap[k], heap[p]];
      [fs[p], fs[k]] = [fs[k], fs[p]];
      k = p;
    }
  };
  const pop = () => {
    const top = heap[0];
    const li = heap.pop()!, lf = fs.pop()!;
    if (heap.length) {
      heap[0] = li;
      fs[0] = lf;
      let k = 0;
      for (;;) {
        const l = k * 2 + 1, r = l + 1;
        let m = k;
        if (l < heap.length && fs[l] < fs[m]) m = l;
        if (r < heap.length && fs[r] < fs[m]) m = r;
        if (m === k) break;
        [heap[m], heap[k]] = [heap[k], heap[m]];
        [fs[m], fs[k]] = [fs[k], fs[m]];
        k = m;
      }
    }
    return top;
  };
  gs[s] = 0;
  push(s, heur(s));
  let found = false, n = 0;
  while (heap.length && n++ < MAX_NODES) {
    const i = pop();
    if (closed[i]) continue;
    closed[i] = 1;
    if (i === g) {
      found = true;
      break;
    }
    const ix = i % W, iz = Math.floor(i / W);
    for (let dz = -1; dz <= 1; dz++)
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dz) continue;
        const x = ix + dx, z = iz + dz;
        if (x < 0 || z < 0 || x >= W || z >= H) continue;
        const j = z * W + x;
        if (closed[j] || !isFree(j)) continue;
        // no corner cutting
        if (dx && dz && (!isFree(iz * W + x) || !isFree(z * W + ix))) continue;
        const ng = gs[i] + (dx && dz ? Math.SQRT2 : 1) * CELL;
        if (ng < gs[j]) {
          gs[j] = ng;
          from[j] = i;
          push(j, ng + heur(j));
        }
      }
  }
  if (!found) return null;
  const cells: number[] = [];
  for (let i = g; i >= 0; i = from[i]) cells.push(i);
  cells.reverse();
  // string-pull: keep only the corners we can't see past
  const out: [number, number][] = [];
  let ax = b.x, az = b.z;
  let k = 0;
  while (k < cells.length - 1) {
    let far = k + 1;
    for (let j = cells.length - 1; j > k + 1; j--) {
      if (lineClear(P, b, ax, az, cx(cells[j]), cz(cells[j]))) {
        far = j;
        break;
      }
    }
    ax = cx(cells[far]);
    az = cz(cells[far]);
    out.push([ax, az]);
    k = far;
  }
  if (!out.length) out.push([cx(g), cz(g)]);
  return out;
}
