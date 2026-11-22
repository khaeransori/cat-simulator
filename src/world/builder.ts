import * as THREE from 'three';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
  cam: boolean; // blocks the camera
  off?: boolean; // disabled (e.g. an opened gate)
  tag?: string;
  qm?: number;
}

export interface BoxOpts {
  collide?: boolean;
  visible?: boolean;
  cam?: boolean;
  top?: number; // different color for the top face
  jitter?: number;
  tag?: string;
  out?: AABB[]; // receive the created collider
}

const FACES = [
  // normal, 4 corners (as indices into the 8 box corners)
  { n: [1, 0, 0], c: [1, 5, 7, 3] },
  { n: [-1, 0, 0], c: [4, 0, 2, 6] },
  { n: [0, 1, 0], c: [2, 3, 7, 6] },
  { n: [0, -1, 0], c: [4, 5, 1, 0] },
  { n: [0, 0, 1], c: [0, 1, 3, 2] },
  { n: [0, 0, -1], c: [5, 4, 6, 7] },
];

// Merges thousands of boxes into one mesh with vertex colors (1 draw call)
// and records axis-aligned colliders for the physics.
export class StaticBuilder {
  pos: number[] = [];
  nrm: number[] = [];
  col: number[] = [];
  idx: number[] = [];
  /** texture coords (world-space planar mapping, 1 unit = uvScale m); filled always, used when built with a map */
  uv: number[] = [];
  uvScale = 1.2;
  colliders: AABB[] = [];
  private c = new THREE.Color();
  private c2 = new THREE.Color();
  private v = new THREE.Vector3();
  private nm = new THREE.Matrix3();

  // Box by center x/z, bottom y, and size.
  box(cx: number, by: number, cz: number, w: number, h: number, d: number, color: number, o: BoxOpts = {}) {
    return this.mm(cx - w / 2, by, cz - d / 2, cx + w / 2, by + h, cz + d / 2, color, o);
  }

  // Box by min/max corners.
  mm(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, o: BoxOpts = {}) {
    if (o.visible !== false) this.geom(x0, y0, z0, x1, y1, z1, color, o.top, o.jitter ?? 0.05);
    if (o.collide !== false) {
      const a: AABB = { minX: Math.min(x0, x1), minY: Math.min(y0, y1), minZ: Math.min(z0, z1), maxX: Math.max(x0, x1), maxY: Math.max(y0, y1), maxZ: Math.max(z0, z1), cam: o.cam !== false, tag: o.tag };
      // the camera passes through low furniture (seen from inside, a box is invisible)
      if (o.cam === undefined && a.maxY - a.minY < 1.3 && a.maxY < 2.05) a.cam = false;
      this.colliders.push(a);
      if (o.out) o.out.push(a);
      return a;
    }
    return null;
  }

  // Collider only (invisible wall)
  wall(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cam = false) {
    return this.mm(x0, y0, z0, x1, y1, z1, 0, { visible: false, cam });
  }

  geom(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, top?: number, jitter = 0.05, m?: THREE.Matrix4) {
    const corners = [
      [x0, y0, z1], [x1, y0, z1], [x0, y1, z1], [x1, y1, z1],
      [x0, y0, z0], [x1, y0, z0], [x0, y1, z0], [x1, y1, z0],
    ];
    const j = 1 + (Math.random() * 2 - 1) * jitter;
    this.c.setHex(color).multiplyScalar(j);
    if (top !== undefined) this.c2.setHex(top).multiplyScalar(j);
    if (m) this.nm.getNormalMatrix(m);
    for (const f of FACES) {
      const base = this.pos.length / 3;
      const isTop = f.n[1] === 1;
      const cc = isTop && top !== undefined ? this.c2 : this.c;
      const shade = f.n[1] === -1 ? 0.7 : 1;
      for (const ci of f.c) {
        const p = corners[ci];
        if (m) {
          this.v.set(p[0], p[1], p[2]).applyMatrix4(m);
          this.pos.push(this.v.x, this.v.y, this.v.z);
        } else this.pos.push(p[0], p[1], p[2]);
        if (m) {
          this.v.set(f.n[0], f.n[1], f.n[2]).applyMatrix3(this.nm).normalize();
          this.nrm.push(this.v.x, this.v.y, this.v.z);
        } else this.nrm.push(f.n[0], f.n[1], f.n[2]);
        const L = this.pos.length;
        this.pushUV(this.pos[L - 3], this.pos[L - 2], this.pos[L - 1], m ? this.v.x : f.n[0], m ? this.v.y : f.n[1], m ? this.v.z : f.n[2]);
        this.col.push(cc.r * shade, cc.g * shade, cc.b * shade);
      }
      this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  }

  // Visual-only box rotated around Y (and optionally X/Z) about its center.
  rot(cx: number, cy: number, cz: number, w: number, h: number, d: number, ry: number, color: number, rx = 0, rz = 0) {
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(cx, cy, cz),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ')),
      new THREE.Vector3(1, 1, 1),
    );
    this.geom(-w / 2, -h / 2, -d / 2, w / 2, h / 2, d / 2, color, undefined, 0.04, m);
  }

  private pushUV(x: number, y: number, z: number, nx: number, ny: number, nz: number) {
    const ax = Math.abs(nx), ay = Math.abs(ny), az = Math.abs(nz), k = 1 / this.uvScale;
    if (ay >= ax && ay >= az) this.uv.push(x * k, z * k);
    else if (ax >= az) this.uv.push(z * k, y * k);
    else this.uv.push(x * k, y * k);
  }

  /** Chamfered (bevelled) visual box by min/max corners; r = bevel size. Optional collider like mm(). */
  bev(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number, r = 0.05, o: BoxOpts & { vary?: number } = {}) {
    const w = Math.abs(x1 - x0), h = Math.abs(y1 - y0), d = Math.abs(z1 - z0);
    this.poly(chamferGeo(w, h, d, Math.min(r, w * 0.45, h * 0.45, d * 0.45)), color, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, { vary: o.vary ?? 0.02 });
    if (o.collide === true) return this.mm(x0, y0, z0, x1, y1, z1, color, { ...o, visible: false });
    return null;
  }

  /** LOW-POLY: add any geometry flat-shaded (per-face normals) with a per-face colour wobble. */
  poly(g: THREE.BufferGeometry, color: number, x: number, y: number, z: number, o: { jit?: number; sy?: number; sx?: number; sz?: number; ry?: number; rx?: number; rz?: number; vary?: number } = {}) {
    let q = g.index ? g.toNonIndexed() : g.clone();
    if (o.jit) {
      const p = q.getAttribute('position') as THREE.BufferAttribute;
      const seen = new Map<string, number[]>();
      for (let i = 0; i < p.count; i++) {
        const k = p.getX(i).toFixed(3) + ',' + p.getY(i).toFixed(3) + ',' + p.getZ(i).toFixed(3);
        let d = seen.get(k);
        if (!d) seen.set(k, (d = [(Math.random() * 2 - 1) * o.jit, (Math.random() * 2 - 1) * o.jit, (Math.random() * 2 - 1) * o.jit]));
        p.setXYZ(i, p.getX(i) + d[0], p.getY(i) + d[1], p.getZ(i) + d[2]);
      }
    }
    const m = new THREE.Matrix4().compose(
      new THREE.Vector3(x, y, z),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0, 'YXZ')),
      new THREE.Vector3(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1),
    );
    q.applyMatrix4(m);
    const p = q.getAttribute('position');
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), n = new THREE.Vector3();
    const vary = o.vary ?? 0.07;
    for (let f = 0; f < p.count; f += 3) {
      a.fromBufferAttribute(p, f); b.fromBufferAttribute(p, f + 1); c.fromBufferAttribute(p, f + 2);
      n.subVectors(c, b).cross(b.clone().sub(a).negate()).normalize();
      this.c.setHex(color).multiplyScalar(1 + (Math.random() * 2 - 1) * vary);
      const base = this.pos.length / 3;
      for (const v of [a, b, c]) {
        this.pos.push(v.x, v.y, v.z);
        this.nrm.push(n.x, n.y, n.z);
        this.pushUV(v.x, v.y, v.z, n.x, n.y, n.z);
        this.col.push(this.c.r, this.c.g, this.c.b);
      }
      this.idx.push(base, base + 1, base + 2);
    }
  }

  build(mat: THREE.Material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    if ((mat as any).map) g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setIndex(this.pos.length / 3 > 65535 ?new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
}

// Chamfered box geometry (convex hull of the 24 bevel points), cached per size.
const chamCache = new Map<string, THREE.BufferGeometry>();
export function chamferGeo(w: number, h: number, d: number, r: number) {
  const k = [w, h, d, r].map((n) => n.toFixed(3)).join(',');
  let g = chamCache.get(k);
  if (!g) {
    const p: THREE.Vector3[] = [];
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      p.push(new THREE.Vector3(sx * (w / 2), sy * (h / 2 - r), sz * (d / 2 - r)));
      p.push(new THREE.Vector3(sx * (w / 2 - r), sy * (h / 2), sz * (d / 2 - r)));
      p.push(new THREE.Vector3(sx * (w / 2 - r), sy * (h / 2 - r), sz * (d / 2)));
    }
    g = new ConvexGeometry(p);
    chamCache.set(k, g);
  }
  return g;
}

/** Tiny tileable canvas textures (offline): wood grain, plaster speckle. Near-white so vertex colours tint them. */
const texCache = new Map<string, THREE.CanvasTexture>();
export function grainTex(kind: 'wood' | 'plaster' | 'fabric' = 'wood') {
  let t = texCache.get(kind);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#ffffff';
  g.fillRect(0, 0, 128, 128);
  let seed = kind.length * 977;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  if (kind === 'wood') {
    for (let i = 0; i < 46; i++) {
      const y = rnd() * 128, a = 0.05 + rnd() * 0.1, th = 1 + rnd() * 2.5;
      g.strokeStyle = `rgba(120,80,40,${a})`;
      g.lineWidth = th;
      g.beginPath();
      for (let x = 0; x <= 128; x += 8) g.lineTo(x, y + Math.sin(x / 19 + i) * 2.2);
      g.stroke();
    }
    for (let i = 0; i < 3; i++) {
      g.fillStyle = 'rgba(110,70,35,0.16)';
      g.beginPath();
      g.ellipse(rnd() * 128, rnd() * 128, 5, 2.5, 0, 0, 7);
      g.fill();
    }
  } else if (kind === 'plaster') {
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${0.02 + rnd() * 0.04})`;
      g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2);
    }
  } else {
    for (let y = 0; y < 128; y += 4) {
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(0, y, 128, 2);
    }
    for (let x = 0; x < 128; x += 4) {
      g.fillStyle = 'rgba(255,255,255,0.05)';
      g.fillRect(x, 0, 2, 128);
    }
  }
  t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(kind, t);
  return t;
}

// Small helper to build separate (animated) props out of boxes.
const geoCache = new Map<string, THREE.BoxGeometry>();
const matCache = new Map<number, THREE.MeshLambertMaterial>();
export function boxGeo(w: number, h: number, d: number) {
  const k = w.toFixed(3) + ',' + h.toFixed(3) + ',' + d.toFixed(3);
  let g = geoCache.get(k);
  if (!g) {
    g = new THREE.BoxGeometry(w, h, d);
    geoCache.set(k, g);
  }
  return g;
}
export function lam(color: number) {
  let m = matCache.get(color);
  if (!m) {
    m = new THREE.MeshLambertMaterial({ color });
    matCache.set(color, m);
  }
  return m;
}
// Mesh box positioned by its center.
export function mbox(w: number, h: number, d: number, color: number | THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), typeof color === 'number' ? lam(color) : color);
  m.position.set(x, y, z);
  return m;
}
