import * as THREE from 'three';

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

  build(mat: THREE.Material) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nrm, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.pos.length / 3 > 65535 ?new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    const mesh = new THREE.Mesh(g, mat);
    mesh.matrixAutoUpdate = false;
    return mesh;
  }
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
