import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Blocky animals (same construction as the Kenney Blocky people): cuboid parts with a flat,
// pixel-painted texture. Every animal paints all its parts into ONE small canvas atlas
// (Nearest filtering), so a whole animal is a handful of meshes sharing a single material.

export type Rect = { x: number; y: number; w: number; h: number };
/** cells in BoxGeometry face order: +x, -x, +y, -y, +z (front), -z (back) */
export type Faces = [Rect, Rect, Rect, Rect, Rect, Rect];
export const PX = 0, NX = 1, PY = 2, NY = 3, PZ = 4, NZ = 5;

export const hexCss = (c: number) => '#' + (c & 0xffffff).toString(16).padStart(6, '0');
export function shadeHex(c: number, k: number) {
  const r = Math.min(255, ((c >> 16) & 255) * k), g = Math.min(255, ((c >> 8) & 255) * k), b = Math.min(255, (c & 255) * k);
  return (Math.round(r) << 16) | (Math.round(g) << 8) | Math.round(b);
}
export function lum(c: number) {
  return (0.299 * ((c >> 16) & 255) + 0.587 * ((c >> 8) & 255) + 0.114 * (c & 255)) / 255;
}

/** Canvas atlas with a simple shelf packer. `pxu` = texture pixels per metre of model. */
export class Atlas {
  cv = document.createElement('canvas');
  g: CanvasRenderingContext2D;
  tex: THREE.CanvasTexture;
  mat: THREE.MeshLambertMaterial;
  cells: Record<string, Faces> = {};
  private x = 1;
  private y = 1;
  private row = 0;
  constructor(public S: number, public pxu: number) {
    this.cv.width = this.cv.height = S;
    this.g = this.cv.getContext('2d')!;
    this.tex = new THREE.CanvasTexture(this.cv);
    this.tex.colorSpace = THREE.SRGBColorSpace;
    this.tex.magFilter = THREE.NearestFilter;
    this.tex.minFilter = THREE.NearestMipmapLinearFilter;
    this.mat = new THREE.MeshLambertMaterial({ map: this.tex });
  }
  alloc(w: number, h: number): Rect {
    w = Math.max(2, Math.ceil(w));
    h = Math.max(2, Math.ceil(h));
    if (this.x + w + 1 > this.S) {
      this.x = 1;
      this.y += this.row + 2;
      this.row = 0;
    }
    const r = { x: this.x, y: this.y, w, h };
    this.x += w + 2;
    this.row = Math.max(this.row, h);
    if (this.y + h > this.S) console.error('atlas overflow', this.S);
    return r;
  }
  /** allocate the 6 face cells of a w×h×d cuboid */
  box(name: string, w: number, h: number, d: number): Faces {
    const k = this.pxu;
    const f: Faces = [this.alloc(d * k, h * k), this.alloc(d * k, h * k), this.alloc(w * k, d * k), this.alloc(w * k, d * k), this.alloc(w * k, h * k), this.alloc(w * k, h * k)];
    this.cells[name] = f;
    return f;
  }
  fill(r: Rect, c: number | string) {
    this.g.fillStyle = typeof c === 'number' ? hexCss(c) : c;
    this.g.fillRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2); // 1px bleed into the gutter
  }
  /** fill a fraction of a cell (0..1 coords, top-left origin), snapped to whole pixels */
  frac(r: Rect, fx: number, fy: number, fw: number, fh: number, c: number | string) {
    this.g.fillStyle = typeof c === 'number' ? hexCss(c) : c;
    const x0 = Math.round(r.x + fx * r.w), y0 = Math.round(r.y + fy * r.h);
    const x1 = Math.round(r.x + (fx + fw) * r.w), y1 = Math.round(r.y + (fy + fh) * r.h);
    this.g.fillRect(x0, y0, Math.max(1, x1 - x0), Math.max(1, y1 - y0));
  }
  /** paint a whole cuboid one colour (underside a touch darker, like the Blocky skins) */
  paintBox(f: Faces, c: number, under?: number) {
    f.forEach((r, i) => this.fill(r, i === NY ? (under ?? shadeHex(c, 0.86)) : c));
  }
  done() {
    this.tex.needsUpdate = true;
  }
}

const geoCache = new Map<string, THREE.BufferGeometry>();
/** BoxGeometry whose faces sample the given atlas cells; optional local transform baked in. */
export function uvBox(a: Atlas, f: Faces, w: number, h: number, d: number, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const key = [a.S, w, h, d, x, y, z, rx, ry, rz].map((v) => +v.toFixed(4)).join(',') + '|' + f.map((r) => `${r.x},${r.y},${r.w},${r.h}`).join(';');
  let g = geoCache.get(key);
  if (g) return g;
  g = new THREE.BoxGeometry(w, h, d);
  const uv = g.getAttribute('uv') as THREE.BufferAttribute;
  const S = a.S, ins = 0.3;
  for (let fi = 0; fi < 6; fi++) {
    const r = f[fi];
    for (let j = 0; j < 4; j++) {
      const i = fi * 4 + j;
      const u = uv.getX(i), v = uv.getY(i);
      const px = r.x + ins + u * (r.w - 2 * ins);
      const py = r.y + ins + (1 - v) * (r.h - 2 * ins);
      uv.setXY(i, px / S, 1 - py / S);
    }
  }
  g.clearGroups();
  if (rx || ry || rz) g.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz)));
  g.translate(x, y, z);
  geoCache.set(key, g);
  return g;
}

const mergeCache = new Map<string, THREE.BufferGeometry>();
/** merge several uvBox geometries into one (cached by identity of the parts) */
export function merged(key: string, parts: THREE.BufferGeometry[]) {
  let g = mergeCache.get(key);
  if (!g) {
    g = mergeGeometries(parts)!;
    mergeCache.set(key, g);
  }
  return g;
}

export function mesh(geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  return m;
}

/** a joint (pivot) group, like the Kenney rig nodes */
export function joint(parent: THREE.Object3D, x: number, y: number, z: number) {
  const g = new THREE.Group();
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}

// ---- pixel eyes: a tiny plane with iris, pupil and a white shine ----
const eyeMats = new Map<string, THREE.MeshLambertMaterial>();
export function eyeMat(iris: number, pupil = 0x15151c, slit = true) {
  const k = iris + ':' + pupil + ':' + slit;
  let m = eyeMats.get(k);
  if (!m) {
    const cv = document.createElement('canvas');
    cv.width = 8;
    cv.height = 10;
    const g = cv.getContext('2d')!;
    g.fillStyle = hexCss(iris);
    g.fillRect(0, 0, 8, 10);
    g.fillStyle = hexCss(shadeHex(iris, 0.72));
    g.fillRect(0, 8, 8, 2);
    g.fillStyle = hexCss(pupil);
    if (slit) g.fillRect(3, 1, 3, 8);
    else g.fillRect(1, 1, 6, 8);
    g.fillStyle = '#ffffff';
    g.fillRect(slit ? 1 : 2, 1, 2, 2);
    const t = new THREE.CanvasTexture(cv);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestFilter;
    t.generateMipmaps = false;
    m = new THREE.MeshLambertMaterial({ map: t });
    eyeMats.set(k, m);
  }
  return m;
}
const planeCache = new Map<string, THREE.PlaneGeometry>();
export function plane(w: number, h: number) {
  const k = w + 'x' + h;
  let g = planeCache.get(k);
  if (!g) planeCache.set(k, (g = new THREE.PlaneGeometry(w, h)));
  return g;
}
