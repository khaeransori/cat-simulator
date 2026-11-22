// Indonesian house generator (port of the approved mockup, scratch lowpoly/houses/builder.ts).
// Merged low-poly geometry builder: every part becomes non-indexed flat geometry with per-face colour wobble,
// merged into ONE mesh (vertex colours) + ONE sign mesh (atlas texture) per chunk.
// Game additions: deterministic seed (seedRng), simple box colliders (B.col / BoxOpt.col) and
// window records for the night glow (B.wins); game materials are Lambert like the rest of the world.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

let seed = 7;
/** reset the generator so every build looks the same */
export const seedRng = (s: number) => { seed = Math.max(1, Math.floor(s)) % 2147483647; };
export const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
export const rr = (a: number, b: number) => a + (b - a) * rnd();
export const shade = (c: number, k: number) => {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};

export const MAT = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });

// ---------------- sign atlas (house numbers, shop signs, painted text) ----------------
export const ATLAS = document.createElement('canvas');
ATLAS.width = 1024; ATLAS.height = 1024;
const ag = ATLAS.getContext('2d')!;
const REG: Record<string, [number, number, number, number]> = {};
let ax = 0, ay = 0, rowH = 0;
export function region(name: string, w: number, h: number, draw: (g: CanvasRenderingContext2D, w: number, h: number) => void) {
  if (ax + w > 1024) { ax = 0; ay += rowH + 4; rowH = 0; }
  ag.save(); ag.translate(ax, ay); ag.beginPath(); ag.rect(0, 0, w, h); ag.clip(); draw(ag, w, h); ag.restore();
  REG[name] = [ax, ay, w, h]; ax += w + 4; rowH = Math.max(rowH, h);
}
export const ATLAS_TEX = new THREE.CanvasTexture(ATLAS);
ATLAS_TEX.colorSpace = THREE.SRGBColorSpace; ATLAS_TEX.anisotropy = 4;
export const SIGN_MAT = new THREE.MeshLambertMaterial({ map: ATLAS_TEX, alphaTest: 0.4 });

const boxCache = new Map<string, THREE.BufferGeometry>();
function bevBox(w: number, h: number, d: number, b: number) {
  const k = `${w.toFixed(3)},${h.toFixed(3)},${d.toFixed(3)},${b}`;
  let g = boxCache.get(k);
  if (!g) {
    b = Math.min(b, w / 3, h / 3, d / 3);
    const s = new THREE.Shape();
    s.moveTo(-w / 2 + b, -h / 2 + b); s.lineTo(w / 2 - b, -h / 2 + b); s.lineTo(w / 2 - b, h / 2 - b); s.lineTo(-w / 2 + b, h / 2 - b); s.closePath();
    g = new THREE.ExtrudeGeometry(s, { depth: d - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
    g.translate(0, 0, -(d - 2 * b) / 2);
    boxCache.set(k, g);
  }
  return g;
}

type V3 = [number, number, number];
/** col: also record an axis-aligned collider for this box (true = camera rule automatic, 'nocam' = camera passes) */
export interface BoxOpt { bev?: number; rx?: number; ry?: number; rz?: number; wob?: number; col?: boolean | 'nocam'; }
export interface HCol { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; cam?: boolean; tag?: string; }
export interface HWin { x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; px: number; pz: number; }

export class B {
  parts: THREE.BufferGeometry[] = [];
  signs: THREE.BufferGeometry[] = [];
  /** world-space colliders (game) */
  cols: HCol[] = [];
  /** world-space window glass boxes for the night glow (game) */
  wins: HWin[] = [];
  m = new THREE.Matrix4();
  private aabb(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number) {
    const v = new THREE.Vector3(), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const x of [x0, x1]) for (const y of [y0, y1]) for (const z of [z0, z1]) {
      v.set(x, y, z).applyMatrix4(this.m);
      const a = [v.x, v.y, v.z];
      for (let i = 0; i < 3; i++) { lo[i] = Math.min(lo[i], a[i]); hi[i] = Math.max(hi[i], a[i]); }
    }
    const r = (n: number) => Math.round(n * 1000) / 1000;
    return { x0: r(lo[0]), y0: r(lo[1]), z0: r(lo[2]), x1: r(hi[0]), y1: r(hi[1]), z1: r(hi[2]) };
  }
  /** collider box in the current local frame (game) */
  col(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, cam?: boolean) {
    if (Math.abs(x1 - x0) < 0.01 || Math.abs(y1 - y0) < 0.01 || Math.abs(z1 - z0) < 0.01) return;
    this.cols.push({ ...this.aabb(Math.min(x0, x1), Math.max(x0, x1), Math.min(y0, y1), Math.max(y0, y1), Math.min(z0, z1), Math.max(z0, z1)), cam });
  }
  /** window glass facing local +z on a wall whose outer face is zf (game: lights up at night) */
  winGlow(x0: number, x1: number, y0: number, y1: number, zf: number) {
    const a = this.aabb(x0 + 0.02, x1 - 0.02, y0 + 0.02, y1 - 0.02, zf - 0.026, zf + 0.045);
    const c = new THREE.Vector3((x0 + x1) / 2, (y0 + y1) / 2, zf + 0.5).applyMatrix4(this.m);
    this.wins.push({ ...a, px: Math.round(c.x * 1000) / 1000, pz: Math.round(c.z * 1000) / 1000 });
  }
  private stack: THREE.Matrix4[] = [];
  push(x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0) {
    this.stack.push(this.m.clone());
    this.m = this.m.clone().multiply(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')), new THREE.Vector3(1, 1, 1)));
  }
  pop() { this.m = this.stack.pop()!; }
  /** add a geometry (centre at x,y,z) */
  geo(g: THREE.BufferGeometry, c: number, x: number, y: number, z: number, o: BoxOpt = {}, scale?: V3) {
    const gg = g.index ? g.toNonIndexed() : g.clone();
    const L = new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, 'YXZ')), new THREE.Vector3(...(scale || [1, 1, 1])));
    gg.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.m, L));
    for (const k of Object.keys(gg.attributes)) if (k !== 'position') gg.deleteAttribute(k);
    gg.computeVertexNormals();
    const n = gg.getAttribute('normal'), cnt = n.count, col = new Float32Array(cnt * 3);
    const base = new THREE.Color(c), wob = o.wob ?? 0.05, partK = (rnd() * 2 - 1) * wob * 0.6;
    const dir = new Map<string, number>();
    for (let i = 0; i < cnt; i += 3) {
      const key = `${Math.round(n.getX(i) * 3)},${Math.round(n.getY(i) * 3)},${Math.round(n.getZ(i) * 3)}`;
      let k = dir.get(key); if (k === undefined) { k = 1 + partK + (rnd() - 0.5) * wob; dir.set(key, k); }
      for (let j = 0; j < 3; j++) { col[(i + j) * 3] = base.r * k; col[(i + j) * 3 + 1] = base.g * k; col[(i + j) * 3 + 2] = base.b * k; }
    }
    gg.setAttribute('color', new THREE.BufferAttribute(col, 3));
    this.parts.push(gg);
  }
  /** box with BOTTOM at y0, centre x/z */
  bx(w: number, h: number, d: number, x: number, y0: number, z: number, c: number, o: BoxOpt = {}) {
    if (o.col) this.col(x - w / 2, x + w / 2, y0, y0 + h, z - d / 2, z + d / 2, o.col === 'nocam' ? false : undefined);
    const g = o.bev ? bevBox(w, h, d, o.bev) : new THREE.BoxGeometry(w, h, d);
    if (o.rx || o.rz) {
      // rotate about the box centre
      this.geo(g, c, x, y0 + h / 2, z, o);
    } else this.geo(g, c, x, y0 + h / 2, z, o);
  }
  /** box spanning x0..x1, y0..y1, z0..z1 */
  span(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, c: number, o: BoxOpt = {}) {
    this.bx(Math.abs(x1 - x0), Math.abs(y1 - y0), Math.abs(z1 - z0), (x0 + x1) / 2, Math.min(y0, y1), (z0 + z1) / 2, c, o);
  }
  /** square beam between two points */
  beam(a: V3, b: V3, t: number, c: number, t2 = t) {
    const A = new THREE.Vector3(...a), Bv = new THREE.Vector3(...b), d = Bv.clone().sub(A), L = d.length();
    const g = new THREE.BoxGeometry(t, t2, L);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize());
    const M = new THREE.Matrix4().compose(A.clone().add(Bv).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(M); this.geo(g, c, 0, 0, 0, { wob: 0.02 });
  }
  /** sagging wire */
  wire(a: V3, b: V3, sag: number, c = 0x2b2b2b, seg = 8, t = 0.035) {
    let prev = a;
    for (let i = 1; i <= seg; i++) {
      const s = i / seg, p: V3 = [a[0] + (b[0] - a[0]) * s, a[1] + (b[1] - a[1]) * s - sag * 4 * s * (1 - s), a[2] + (b[2] - a[2]) * s];
      this.beam(prev, p, t, c); prev = p;
    }
  }
  cyl(rt: number, rb: number, h: number, x: number, y0: number, z: number, c: number, seg = 8, o: BoxOpt = {}) {
    this.geo(new THREE.CylinderGeometry(rt, rb, h, seg), c, x, y0 + h / 2, z, o);
  }
  ico(r: number, x: number, y: number, z: number, c: number, s: V3 = [1, 1, 1]) {
    this.geo(new THREE.IcosahedronGeometry(r, 0), c, x, y, z, { wob: 0.1, ry: rnd() * 6 }, s);
  }
  /** textured sign plane facing +z (local), centre at x,y,z */
  sign(name: string, w: number, h: number, x: number, y: number, z: number, ry = 0) {
    const r = REG[name]; if (!r) throw new Error('no region ' + name);
    const g = new THREE.PlaneGeometry(w, h);
    const uv = g.getAttribute('uv');
    for (let i = 0; i < uv.count; i++) uv.setXY(i, (r[0] + uv.getX(i) * r[2]) / 1024, 1 - (r[1] + (1 - uv.getY(i)) * r[3]) / 1024);
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(this.m, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(0, ry, 0)), new THREE.Vector3(1, 1, 1))));
    this.signs.push(g);
  }
  build(mat: THREE.Material = MAT, signMat: THREE.Material = SIGN_MAT): THREE.Group {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(mergeGeometries(this.parts), mat); m.castShadow = m.receiveShadow = true; grp.add(m);
    if (this.signs.length) { const s = new THREE.Mesh(mergeGeometries(this.signs), signMat); s.receiveShadow = true; grp.add(s); }
    grp.userData.tris = this.parts.reduce((a, g) => a + g.getAttribute('position').count / 3, 0);
    return grp;
  }
}

// ---------------- roofs ----------------
/** hip roof solid (limasan / perisai). centre x,z, base y0, footprint w (x) * d (z), rise h. ridge along the longer axis. */
export function hipRoof(b: B, x: number, y0: number, z: number, w: number, d: number, h: number, c: number, capC = shade(c, 0.8), fascia = 0xf2ece0) {
  const swap = d > w; const W = swap ? d : w, D = swap ? w : d, r = Math.max(0, W - D);
  const P = (px: number, py: number, pz: number) => swap ? [pz, py, -px] : [px, py, pz];
  const A = P(-W / 2, 0, D / 2), Bp = P(W / 2, 0, D / 2), C = P(W / 2, 0, -D / 2), Dp = P(-W / 2, 0, -D / 2), R1 = P(-r / 2, h, 0), R2 = P(r / 2, h, 0);
  const tris = [A, Bp, R2, A, R2, R1, Bp, C, R2, C, Dp, R1, C, R1, R2, Dp, A, R1, A, Dp, C, A, C, Bp];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(tris.flat(), 3));
  b.geo(g, c, x, y0, z, { wob: 0.06 });
  // game: two inscribed collider layers so the cat can climb about on the roof
  for (const t of [1 / 3, 2 / 3]) { const dd = D * (1 - t), ww = W - D * t, cw = swap ? dd : ww, cd = swap ? ww : dd; b.col(x - cw / 2, x + cw / 2, y0 + (t - 1 / 3) * h, y0 + t * h, z - cd / 2, z + cd / 2); }
  // fascia (lisplang) skirt
  b.span(x - w / 2, x + w / 2, y0 - 0.16, y0 + 0.01, z - d / 2, z + d / 2, fascia, { wob: 0.02 });
  // ridge + hip caps
  const Q = (p: number[]) => [p[0] + x, p[1] + y0 + 0.05, p[2] + z] as V3;
  if (r > 0.05) b.beam(Q(R1), Q(R2), 0.16, capC);
  for (const [cor, rp] of [[A, R1], [Dp, R1], [Bp, R2], [C, R2]] as number[][][]) b.beam(Q(cor), Q(rp), 0.13, capC);
}

/** square tiered frustum (tajug) */
export function frustum(b: B, x: number, y0: number, z: number, botHalf: number, topHalf: number, h: number, c: number) {
  const mid = (botHalf + topHalf) / 2; b.col(x - mid, x + mid, y0, y0 + h / 2, z - mid, z + mid); if (topHalf > 0.3) b.col(x - topHalf, x + topHalf, y0 + h / 2, y0 + h, z - topHalf, z + topHalf);
  b.geo(new THREE.CylinderGeometry(topHalf * Math.SQRT2, botHalf * Math.SQRT2, h, 4), c, x, y0 + h / 2, z, { ry: Math.PI / 4, wob: 0.06 });
}

/** gable (pelana) roof with ridge along local X. centre x,z; span S (z); length L (x); gable infill in wallC */
export function gableRoof(b: B, x: number, y0: number, z: number, L: number, S: number, h: number, roofC: number, wallC: number, o: { oh?: number; ohEnd?: number; t?: number; rows?: number; along?: 'x' | 'z'; capC?: number } = {}) {
  const oh = o.oh ?? 0.45, ohE = o.ohEnd ?? 0.35, t = o.t ?? 0.16;
  b.push(x, y0, z, o.along === 'z' ? Math.PI / 2 : 0);
  for (const t of [1 / 3, 2 / 3]) b.col(-L / 2, L / 2, (t - 1 / 3) * h, t * h, -S * (1 - t) / 2, S * (1 - t) / 2);
  // gable infill prism
  const sh = new THREE.Shape(); sh.moveTo(-S / 2, 0); sh.lineTo(S / 2, 0); sh.lineTo(0, h); sh.closePath();
  const pg = new THREE.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false }); pg.rotateY(Math.PI / 2); pg.translate(-L / 2, 0, 0);
  b.geo(pg, wallC, 0, 0, 0, { wob: 0.03 });
  const a = Math.atan2(h, S / 2), sl = Math.hypot(S / 2, h) + oh;
  for (const side of [1, -1]) {
    // slab: starts at ridge, goes down-slope
    const dz = Math.cos(a) * side, dy = -Math.sin(a), nz = Math.sin(a) * side, ny = Math.cos(a);
    const cx = 0, cy = h + dy * sl / 2 + ny * t / 2, cz = dz * sl / 2 + nz * t / 2;
    b.geo(new THREE.BoxGeometry(L + 2 * ohE, t, sl), roofC, cx, cy, cz, { rx: side > 0 ? a : Math.PI - a, wob: 0.05 });
    // tile rows (genteng)
    const rows = o.rows ?? Math.floor(sl / 0.55);
    for (let i = 1; i < rows; i++) {
      const s = (i / rows) * sl;
      b.geo(new THREE.BoxGeometry(L + 2 * ohE - 0.02, 0.05, 0.1), shade(roofC, 0.86), 0, h + dy * s + ny * (t + 0.02), dz * s + nz * (t + 0.02), { rx: side > 0 ? a : Math.PI - a, wob: 0.03 });
    }
  }
  b.geo(new THREE.BoxGeometry(L + 2 * ohE + 0.04, 0.2, 0.3), o.capC ?? shade(roofC, 0.78), 0, h + t * 0.9, 0, {});
  b.pop();
}

/** shed (mono-pitch) roof over x0..x1, z0(front)..z1(back): slab from yF (front) to yB (back); side infill in wallC down to yW */
export function shedRoof(b: B, x0: number, x1: number, z0: number, z1: number, yW: number, yF: number, yB: number, roofC: number, wallC: number, oh = 0.4) {
  const D = z0 - z1, rise = yB - yF, a = Math.atan2(rise, D), sl = Math.hypot(D, rise) + 2 * oh, t = 0.16;
  b.col(x0, x1, yW, yF, z1, z0); for (const k of [1, 2]) b.col(x0, x1, yF + rise * (k - 1) / 3, yF + rise * k / 3, z1, z0 - D * k / 3);
  // infill solid (trapezoid prism) along x
  const sh = new THREE.Shape(); sh.moveTo(z0, yW); sh.lineTo(z1, yW); sh.lineTo(z1, yB); sh.lineTo(z0, yF); sh.closePath();
  const pg = new THREE.ExtrudeGeometry(sh, { depth: x1 - x0, bevelEnabled: false });
  // shape (u=z, v=y) extruded along +w -> map u->z, v->y, w->x
  const pos = pg.getAttribute('position');
  for (let i = 0; i < pos.count; i++) { const u = pos.getX(i), v = pos.getY(i), w = pos.getZ(i); pos.setXYZ(i, x0 + w, v, u); }
  pg.computeVertexNormals();
  // winding flips with the axis swap -> fix by flipping index order
  const idx = pg.index; if (idx) { for (let i = 0; i < idx.count; i += 3) { const t2 = idx.getX(i); idx.setX(i, idx.getX(i + 1)); idx.setX(i + 1, t2); } }
  else { for (let i = 0; i < pos.count; i += 3) { const ax = pos.getX(i), ay = pos.getY(i), az = pos.getZ(i); pos.setXYZ(i, pos.getX(i + 1), pos.getY(i + 1), pos.getZ(i + 1)); pos.setXYZ(i + 1, ax, ay, az); } }
  b.geo(pg, wallC, 0, 0, 0, { wob: 0.03 });
  const cy = (yF + yB) / 2 + Math.cos(a) * t / 2, cz = (z0 + z1) / 2 - Math.sin(a) * t / 2 * 0;
  b.geo(new THREE.BoxGeometry(x1 - x0 + 2 * oh, t, sl), roofC, (x0 + x1) / 2, cy + 0.02, cz, { rx: a, wob: 0.05 });
}

// ---------------- facade parts ----------------
export const GLASS = 0x8fc4dc;
export type WinStyle = 'alu' | 'kayu' | 'papan' | 'pecah' | 'klasik';
/** window on a wall whose outer face is at z=zf (facing +z). y0 = sill height */
export function win(b: B, x: number, y0: number, w: number, h: number, zf: number, o: { style?: WinStyle; frame?: number; teralis?: number; shutter?: number; roster?: number; mullion?: boolean } = {}) {
  const st = o.style || 'alu', fr = o.frame ?? (st === 'kayu' ? 0x6d4528 : 0x37393d), f = 0.09;
  const glass = st === 'pecah' || st === 'papan' ? 0x2e3338 : GLASS;
  b.bx(w, h, 0.06, x, y0, zf, glass, { wob: 0.03 });
  if (glass === GLASS) b.winGlow(x - w / 2, x + w / 2, y0, y0 + h, zf);
  b.bx(w + 0.04, f, 0.12, x, y0 + h - f, zf + 0.0, fr); b.bx(w + 0.04, f, 0.12, x, y0, zf, fr);
  b.bx(f, h - 2 * f, 0.12, x - w / 2 + f / 2, y0 + f, zf, fr); b.bx(f, h - 2 * f, 0.12, x + w / 2 - f / 2, y0 + f, zf, fr);
  b.bx(w + 0.24, 0.08, 0.22, x, y0 - 0.08, zf + 0.04, st === 'klasik' ? 0xe6dcc4 : 0xe9e4da); // sill
  if (o.mullion !== false && st !== 'papan') { b.bx(0.06, h - 2 * f, 0.1, x, y0 + f, zf, fr); if (h > 1.1) b.bx(w - 2 * f, 0.06, 0.1, x, y0 + h * 0.72, zf, fr); }
  if (st === 'klasik') { b.bx(w + 0.3, 0.14, 0.18, x, y0 + h, zf + 0.03, 0xe6dcc4); b.bx(0.24, 0.26, 0.2, x, y0 + h - 0.06, zf + 0.04, 0xe6dcc4); }
  if (o.teralis !== undefined) {
    const n = Math.max(3, Math.round(w / 0.16));
    for (let i = 1; i < n; i++) b.bx(0.03, h - 0.1, 0.03, x - w / 2 + (i * w) / n, y0 + 0.05, zf + 0.13, o.teralis, { wob: 0 });
    for (const yy of [0.25, h * 0.55, h - 0.25]) b.bx(w - 0.06, 0.035, 0.03, x, y0 + yy, zf + 0.13, o.teralis, { wob: 0 });
  }
  if (o.shutter !== undefined) for (const s of [-1, 1]) {
    const sx = x + s * (w / 2 + w / 4 + 0.03);
    b.bx(w / 2, h, 0.05, sx, y0, zf + 0.03, o.shutter);
    for (let k = 1; k < 7; k++) b.bx(w / 2 - 0.1, 0.035, 0.04, sx, y0 + (k * h) / 7, zf + 0.07, shade(o.shutter, 0.8), { wob: 0 });
  }
  if (st === 'papan') {
    const wood = 0x9b8466;
    b.bx(w + 0.1, 0.18, 0.05, x, y0 + h * 0.22, zf + 0.12, wood, { rz: 0.12 });
    b.bx(w + 0.1, 0.18, 0.05, x, y0 + h * 0.55, zf + 0.13, shade(wood, 0.9), { rz: -0.08 });
    b.bx(w + 0.06, 0.16, 0.05, x, y0 + h * 0.8, zf + 0.12, shade(wood, 1.08), { rz: 0.05 });
  }
  if (st === 'pecah') {
    for (const [sx, sy, rz] of [[-0.25, 0.25, 0.5], [0.2, 0.55, -0.7], [-0.1, 0.8, 1.1]]) b.bx(0.22, 0.38, 0.03, x + sx * w, y0 + sy * h - 0.2, zf + 0.06, GLASS, { rz });
  }
  if (o.roster !== undefined) roster(b, x, y0 + h + 0.12, w, zf, o.roster);
}
/** lubang angin / roster above openings */
export function roster(b: B, x: number, y0: number, w: number, zf: number, c: number) {
  b.bx(w, 0.26, 0.04, x, y0, zf + 0.01, 0x3a3634);
  const n = Math.max(2, Math.round(w / 0.22));
  for (let i = 0; i <= n; i++) b.bx(0.04, 0.26, 0.06, x - w / 2 + (i * w) / n, y0, zf + 0.02, c, { wob: 0 });
  b.bx(w, 0.04, 0.06, x, y0 + 0.11, zf + 0.02, c, { wob: 0 });
  b.bx(w + 0.04, 0.04, 0.07, x, y0, zf + 0.02, c, { wob: 0 }); b.bx(w + 0.04, 0.04, 0.07, x, y0 + 0.22, zf + 0.02, c, { wob: 0 });
}
export function door(b: B, x: number, y0: number, w: number, h: number, zf: number, c: number, o: { double?: boolean; frame?: number; open?: boolean } = {}) {
  const fr = o.frame ?? shade(c, 0.7);
  if (o.open) b.bx(w, h, 0.06, x, y0, zf, 0x2a2420);
  else b.bx(w, h, 0.08, x, y0, zf, c, { wob: 0.03 });
  b.bx(w + 0.16, 0.1, 0.14, x, y0 + h, zf, fr); b.bx(0.08, h, 0.14, x - w / 2 - 0.04, y0, zf, fr); b.bx(0.08, h, 0.14, x + w / 2 + 0.04, y0, zf, fr);
  if (!o.open) {
    const leaves = o.double ? 2 : 1, lw = w / leaves;
    for (let l = 0; l < leaves; l++) {
      const lx = x - w / 2 + lw * (l + 0.5);
      b.bx(lw * 0.62, h * 0.32, 0.03, lx, y0 + h * 0.56, zf + 0.05, shade(c, 0.85)); b.bx(lw * 0.62, h * 0.32, 0.03, lx, y0 + h * 0.12, zf + 0.05, shade(c, 0.85));
      b.bx(0.06, 0.16, 0.06, lx + (l === 0 && leaves === 2 ? lw * 0.4 : leaves === 2 ? -lw * 0.4 : lw * 0.36), y0 + h * 0.47, zf + 0.06, 0xd4af37, { wob: 0 });
    }
    if (o.double) b.bx(0.03, h, 0.03, x, y0, zf + 0.05, shade(c, 0.6), { wob: 0 });
  }
}
export function acUnit(b: B, x: number, y0: number, zf: number) {
  b.bx(0.8, 0.55, 0.3, x, y0, zf + 0.17, 0xeceff1, { bev: 0.03 });
  b.geo(new THREE.CylinderGeometry(0.19, 0.19, 0.04, 10), 0x5f6468, x - 0.12, y0 + 0.275, zf + 0.33, { rx: Math.PI / 2, wob: 0 });
  b.bx(0.04, 0.04, 0.34, x - 0.3, y0 - 0.05, zf + 0.17, 0x777777, { wob: 0 }); b.bx(0.04, 0.04, 0.34, x + 0.3, y0 - 0.05, zf + 0.17, 0x777777, { wob: 0 });
  b.beam([x + 0.36, y0 + 0.2, zf + 0.1], [x + 0.45, y0 + 1.2, zf + 0.03], 0.04, 0xf2f2f2); // pipe
}
/** toren air (water tank) on a steel stand, base at y0 */
export function toren(b: B, x: number, y0: number, z: number, c = 0xf08a24, stand = 0) {
  if (stand > 0) {
    for (const [dx, dz] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) b.bx(0.08, stand, 0.08, x + dx, y0, z + dz, 0x5d6166, { wob: 0 });
    b.beam([x - 0.5, y0 + stand * 0.45, z + 0.5], [x + 0.5, y0 + stand * 0.75, z + 0.5], 0.05, 0x5d6166);
    b.beam([x - 0.5, y0 + stand * 0.45, z - 0.5], [x + 0.5, y0 + stand * 0.75, z - 0.5], 0.05, 0x5d6166);
    b.bx(1.2, 0.1, 1.2, x, y0 + stand, z, 0x5d6166, { col: true });
    y0 += stand + 0.1;
  } else b.bx(1.1, 0.12, 1.1, x, y0, z, 0x8d8d8d);
  b.col(x - 0.55, x + 0.55, y0, y0 + 1.47, z - 0.55, z + 0.55);
  b.cyl(0.55, 0.55, 1.15, x, y0 + 0.02, z, c, 10);
  b.cyl(0.42, 0.55, 0.2, x, y0 + 1.17, z, c, 10);
  b.cyl(0.18, 0.18, 0.1, x, y0 + 1.37, z, shade(c, 0.8), 8);
  for (const yy of [0.35, 0.75]) b.cyl(0.565, 0.565, 0.05, x, y0 + yy, z, shade(c, 0.85), 10, { wob: 0 });
}
export function parabola(b: B, x: number, y0: number, z: number, ry = 0, pole = 1.2) {
  b.cyl(0.04, 0.04, pole, x, y0, z, 0x8a8a8a, 6);
  b.push(x, y0 + pole, z, ry);
  b.geo(new THREE.CylinderGeometry(0.6, 0.14, 0.2, 10), 0xd9d9d6, 0, 0.1, 0.1, { rx: 0.95 });
  b.beam([0, 0.1, 0.18], [0, 0.55, 0.65], 0.035, 0x8a8a8a);
  b.bx(0.1, 0.1, 0.12, 0, 0.5, 0.66, 0x333333);
  b.pop();
}
export function pot(b: B, x: number, y0: number, z: number, s = 1, leaf = 0x4f9e44) {
  b.cyl(0.2 * s, 0.14 * s, 0.32 * s, x, y0, z, 0xb5653a, 7);
  b.ico(0.3 * s, x, y0 + 0.5 * s, z, leaf, [1, 1.1, 1]);
}
export function bush(b: B, x: number, y0: number, z: number, s = 1, c = 0x5aa845) {
  b.ico(0.5 * s, x, y0 + 0.35 * s, z, c, [1.2, 0.8, 1.1]);
}
export function tree(b: B, x: number, z: number, s: number, c?: number) {
  b.col(x - 0.2 * s, x + 0.2 * s, 0, 2 * s, z - 0.2 * s, z + 0.2 * s, false);
  b.cyl(0.15 * s, 0.25 * s, 2 * s, x, 0, z, 0x8a5a36, 6);
  const cc = c ?? [0x5fae4a, 0x6dbb52, 0x4f9e44][Math.floor(rnd() * 3)];
  b.ico(1, x, 2.4 * s, z, cc, [1.4 * s, 1.2 * s, 1.4 * s]); b.ico(1, x + 0.5 * s, 3.1 * s, z - 0.2 * s, cc, [0.9 * s, 0.8 * s, 0.9 * s]);
}
export function palm(b: B, x: number, z: number, h: number) {
  b.col(x - 0.18, x + 0.18, 0, h, z - 0.18, z + 0.18, false);
  for (let i = 0; i < 6; i++) b.cyl(0.17 - i * 0.008, 0.19 - i * 0.008, h / 6, x, (i * h) / 6, z, i % 2 ? 0xa89a86 : 0x9a8c78, 7);
  b.cyl(0.2, 0.17, 0.7, x, h, z, 0x6f9a45, 7);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + 0.3;
    const p1: V3 = [x, h + 0.65, z], p2: V3 = [x + Math.cos(a) * 1.4, h + 0.95, z + Math.sin(a) * 1.4], p3: V3 = [x + Math.cos(a) * 2.5, h + 0.2, z + Math.sin(a) * 2.5];
    b.beam(p1, p2, 0.08, 0x4f9a3c, 0.32); b.beam(p2, p3, 0.07, 0x5aa844, 0.28);
  }
}
export function pisang(b: B, x: number, z: number, s = 1) {
  b.cyl(0.11 * s, 0.15 * s, 1.9 * s, x, 0, z, 0x7f9a4a, 6);
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + rnd();
    const p1: V3 = [x, 1.8 * s, z], p2: V3 = [x + Math.cos(a) * 0.9 * s, 2.5 * s, z + Math.sin(a) * 0.9 * s], p3: V3 = [x + Math.cos(a) * 1.5 * s, 2.1 * s, z + Math.sin(a) * 1.5 * s];
    b.beam(p1, p2, 0.05, k % 3 === 0 ? 0x9cae4a : 0x5fa63e, 0.42 * s); b.beam(p2, p3, 0.05, 0x6db347, 0.4 * s);
  }
}
export function weeds(b: B, x0: number, x1: number, z0: number, z1: number, n: number, hMax = 1.1) {
  const cs = [0x8fae3e, 0xa3b04a, 0x6d9a3a, 0xb5b05a, 0x7a9a44];
  for (let i = 0; i < n; i++) {
    const x = rr(x0, x1), z = rr(z0, z1), h = rr(0.35, hMax);
    b.geo(new THREE.ConeGeometry(rr(0.06, 0.12), h, 3), cs[i % cs.length], x, h / 2, z, { rz: rr(-0.25, 0.25), rx: rr(-0.25, 0.25), wob: 0.1 });
  }
}
/** jemuran: two posts and lines with clothes, along local x at z */
export function jemuran(b: B, x0: number, x1: number, z: number, y0 = 0) {
  for (const x of [x0, x1]) { b.bx(0.07, 1.9, 0.07, x, y0, z, 0x8a8a8a, { wob: 0 }); b.bx(0.07, 0.07, 0.8, x, y0 + 1.85, z, 0x8a8a8a, { wob: 0 }); }
  const cl = [0xe53935, 0xfdd835, 0x1e88e5, 0xffffff, 0x8e24aa, 0x43a047, 0xff8a65];
  for (const dz of [-0.3, 0.3]) {
    b.wire([x0, y0 + 1.86, z + dz], [x1, y0 + 1.86, z + dz], 0.08, 0xcfcfcf, 4, 0.02);
    let x = x0 + 0.25;
    while (x < x1 - 0.4) {
      const w = rr(0.3, 0.55), h = rr(0.35, 0.7), s = (x - x0) / (x1 - x0), sag = 0.08 * 4 * s * (1 - s);
      b.bx(w, h, 0.03, x + w / 2, y0 + 1.84 - sag - h, z + dz, cl[Math.floor(rnd() * cl.length)], { wob: 0.04 });
      x += w + rr(0.08, 0.2);
    }
  }
}

export type FenceStyle = 'besi' | 'slat' | 'mewah' | 'karat' | 'rendah';
/** front fence along local x from x0 to x1 at z (facing +z). gates: [gx0,gx1] ranges */
export function fence(b: B, x0: number, x1: number, z: number, o: { style: FenceStyle; barC: number; pillarC?: number; gates?: [number, number][]; h?: number; base?: number; gateOpen?: boolean }) {
  const st = o.style, h = o.h ?? (st === 'mewah' ? 2.3 : st === 'rendah' ? 1.1 : 1.55), base = o.base ?? (st === 'mewah' ? 0.7 : 0.45);
  const pc = o.pillarC ?? 0xe8e2d4, gates = o.gates || [];
  const inGate = (x: number) => gates.some(([a, c]) => x > a && x < c);
  const posts = new Set<number>([x0, x1]); gates.forEach(([a, c]) => { posts.add(a); posts.add(c); });
  // base wall between gates
  const cuts = [x0, ...gates.flat(), x1].sort((a, c) => a - c);
  for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], c = cuts[i + 1]; if (inGate((a + c) / 2) || c - a < 0.05) continue; b.span(a, c, 0, base, z - 0.12, z + 0.12, pc, { bev: 0.03 }); }
  const pw = st === 'mewah' ? 0.5 : 0.32;
  // game colliders: thin wall along the fence (open gates stay open) + the pillars; the camera passes
  for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], c = cuts[i + 1]; if (c - a < 0.05 || (o.gateOpen && inGate((a + c) / 2))) continue; b.col(a, c, 0, h, z - 0.12, z + 0.12, false); }
  for (const x of posts) b.col(x - pw / 2, x + pw / 2, 0, h + 0.22, z - pw / 2, z + pw / 2, false);
  for (const x of posts) {
    b.bx(pw, h + 0.12, pw, x, 0, z, pc, { bev: 0.03 }); b.bx(pw + 0.12, 0.1, pw + 0.12, x, h + 0.12, z, shade(pc, 0.92));
    if (st === 'mewah') { b.bx(0.22, 0.3, 0.22, x, h + 0.22, z, 0xfff1b0, { wob: 0 }); b.bx(0.3, 0.06, 0.3, x, h + 0.52, z, 0x222222, { wob: 0 }); }
  }
  const sorted = [...posts].sort((a, c) => a - c);
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i] + pw / 2, c = sorted[i + 1] - pw / 2; if (c - a < 0.1) continue;
    const gate = inGate((a + c) / 2), yb = gate ? 0.05 : base, zz = gate ? z - 0.05 : z;
    if (gate && o.gateOpen) {
      // hinged gate swung open & tilted (abandoned)
      b.push(a, 0, zz, 1.1, 0, 0.05);
      for (let xx = 0.08; xx < (c - a) * 0.95; xx += 0.16) if (rnd() > 0.15) b.bx(0.035, h - 0.1, 0.035, xx, 0.05, 0, o.barC, { wob: 0.08 });
      b.bx((c - a) * 0.95, 0.06, 0.05, (c - a) * 0.475, 0.1, 0, o.barC); b.bx((c - a) * 0.95, 0.06, 0.05, (c - a) * 0.475, h - 0.1, 0, o.barC);
      b.pop();
      continue;
    }
    if (st === 'slat' && !gate || (st === 'slat' && gate)) {
      for (let y = yb + 0.08; y < h - 0.05; y += 0.17) b.bx(c - a, 0.11, 0.05, (a + c) / 2, y, zz, o.barC, { wob: 0.02 });
      continue;
    }
    const sp = st === 'mewah' ? 0.15 : 0.13;
    for (let x = a + sp / 2; x < c; x += sp) {
      if (st === 'karat' && rnd() < 0.18) continue;
      b.bx(0.035, h - yb, 0.035, x, yb, zz, st === 'karat' ? shade(o.barC, rr(0.8, 1.2)) : o.barC, { wob: 0 });
      if (st === 'mewah') b.geo(new THREE.ConeGeometry(0.05, 0.14, 4), 0xd4af37, x, h + 0.07, zz, { wob: 0 });
    }
    for (const y of [yb + 0.08, h - 0.04, ...(gate ? [(yb + h) / 2] : [])]) b.bx(c - a, 0.05, 0.05, (a + c) / 2, y, zz, o.barC, { wob: 0 });
    if (st === 'mewah') for (let x = a + 0.3; x < c - 0.2; x += 0.6) b.geo(new THREE.TorusGeometry(0.12, 0.022, 4, 8), 0xd4af37, x, h - 0.35, zz + 0.02, { wob: 0 });
  }
}
