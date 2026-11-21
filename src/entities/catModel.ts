import * as THREE from 'three';
import { boxGeo, lam } from '../world/builder';
import type { Look } from '../save';
import { getItem, furColor } from '../cosmetics';
import { rand } from '../ctx';
import { Atlas, uvBox, merged, mesh, joint, eyeMat, plane, lum, PZ, PY, PX, NX, NY, NZ } from './blockyAnimal';

export function shade(hex: number, k: number) {
  const c = new THREE.Color(hex);
  c.multiplyScalar(k);
  return c.getHex();
}
export function mix(a: number, b: number, t: number) {
  const c = new THREE.Color(a);
  c.lerp(new THREE.Color(b), t);
  return c.getHex();
}

function B(w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

export interface CatAnim {
  speed: number;
  air: boolean;
  sleep: number;
  sit: number;
  paw: number; // 0..1 swipe progress (0 = none)
  scratch: boolean;
  dig: boolean;
  eat: boolean;
  earsDown: number;
  happy: number;
  hugged: boolean;
  lookYaw: number;
}

export function newAnim(): CatAnim {
  return { speed: 0, air: false, sleep: 0, sit: 0, paw: 0, scratch: false, dig: false, eat: false, earsDown: 0, happy: 0, hugged: false, lookYaw: 0 };
}

// Blocky cat in the Kenney-Blocky style: cuboid parts sharing ONE pixel-painted atlas
// (face, muzzle, whiskers, blush and every fur pattern are painted, not extra boxes).
// +z is forward, origin at the feet. Part coordinates are in "cat units"; the whole cat is
// scaled by CAT_SCALE so it stands about knee-high next to a 1.7 m adult.
export const CAT_SCALE = 0.8;

// cuboid sizes (cat units)
const BODY = [0.34, 0.26, 0.58] as const, BODY_P = [0, 0.39, -0.01] as const;
const HEAD = [0.38, 0.32, 0.3] as const, HEAD_P = [0, 0.1, 0.1] as const;
const LEG = [0.1, 0.19, 0.1] as const, PAW = [0.11, 0.08, 0.12] as const;
const EAR = [0.12, 0.14, 0.06] as const;
const TSEG = [0.065, 0.065, 0.17] as const;
const PINK = 0xf5a3b5;

export class CatModel {
  root = new THREE.Group();
  /** uniform size group between root and pose (root.scale stays free for callers) */
  sizeG = new THREE.Group();
  pose = new THREE.Group();
  inner = new THREE.Group();
  headG = new THREE.Group();
  legs: THREE.Group[] = [];
  legUpper: THREE.Mesh[] = [];
  paws: THREE.Mesh[] = [];
  tail: THREE.Group[] = [];
  tailSeg: THREE.Mesh[] = [];
  ears: THREE.Group[] = [];
  eyes: THREE.Group[] = [];
  eyeMesh: THREE.Mesh[] = [];
  headAcc = new THREE.Group();
  faceAcc = new THREE.Group();
  neckAcc = new THREE.Group();
  backAcc = new THREE.Group();
  carry = new THREE.Group();
  atlas = new Atlas(256, 100);
  wings: THREE.Group[] = [];
  cape: THREE.Group | null = null;
  phase = 0;
  t = rand(0, 10);
  blinkT = rand(2, 5);
  twitchT = rand(3, 7);
  twitchEar = -1;
  twitchK = 0;
  look: Look | null = null;

  constructor() {
    const A = this.atlas, M = A.mat;
    const cB = A.box('body', ...BODY), cH = A.box('head', ...HEAD);
    const cL = A.box('leg', ...LEG), cP = A.box('paw', ...PAW), cE = A.box('ear', ...EAR);
    const cT = [A.box('t0', ...TSEG), A.box('t1', ...TSEG), A.box('t2', ...TSEG)];

    this.root.add(this.sizeG);
    this.sizeG.scale.setScalar(CAT_SCALE);
    this.sizeG.add(this.pose);
    this.pose.position.set(0, 0.27, -0.19);
    this.pose.add(this.inner);
    this.inner.position.set(0, -0.27, 0.19);
    const I = this.inner;

    // torso
    I.add(mesh(uvBox(A, cB, ...BODY), M, ...BODY_P));
    // legs: pivot at the hip/shoulder, column + paw hang down (one merged mesh per leg)
    const legGeo = merged('catleg', [uvBox(A, cL, ...LEG, 0, -0.095, 0), uvBox(A, cP, ...PAW, 0, -0.23, 0.01)]);
    for (const [x, z] of [
      [0.1, 0.17],
      [-0.1, 0.17],
      [0.1, -0.19],
      [-0.1, -0.19],
    ]) {
      const g = joint(I, x, 0.27, z);
      const m = mesh(legGeo, M);
      g.add(m);
      this.legs.push(g);
      this.legUpper.push(m);
      this.paws.push(m);
    }
    // head: pivot at the neck; the face (muzzle, nose, mouth, whiskers, blush) is painted on +z
    this.headG.position.set(0, 0.5, 0.26);
    I.add(this.headG);
    const H = this.headG;
    H.add(mesh(uvBox(A, cH, ...HEAD), M, ...HEAD_P));
    const eg = plane(0.075, 0.09);
    for (const sx of [1, -1]) {
      const e = new THREE.Group();
      e.position.set(0.085 * sx, 0.135, 0.2515);
      const em = new THREE.Mesh(eg, eyeMat(0x6fcf5a));
      e.add(em);
      H.add(e);
      this.eyes.push(e);
      this.eyeMesh.push(em);
      const ear = joint(H, 0.12 * sx, 0.25, 0.08);
      ear.rotation.z = -0.22 * sx;
      ear.add(mesh(uvBox(A, cE, ...EAR), M, 0, 0.07, 0));
      this.ears.push(ear);
    }
    H.add(this.headAcc, this.faceAcc, this.carry);
    this.headAcc.position.set(0, 0.26, 0.1);
    this.faceAcc.position.set(0, 0.13, 0.268);
    this.carry.position.set(0, -0.03, 0.33);
    I.add(this.neckAcc, this.backAcc);
    // collars sit just under the blocky head, wrapped round the chest top
    this.neckAcc.position.set(0, -0.01, 0.035);
    this.neckAcc.scale.set(1.05, 1, 1);

    // tail: pivot at the rump, three segments
    let parent: THREE.Object3D = I;
    for (let i = 0; i < 3; i++) {
      const g = new THREE.Group();
      if (i === 0) {
        g.position.set(0, 0.47, -0.29);
        g.rotation.x = 0.45;
      } else {
        g.position.set(0, 0, -0.15);
        g.rotation.x = 0.35;
      }
      const seg = mesh(uvBox(A, cT[i], ...TSEG), M, 0, 0, -0.075);
      g.add(seg);
      parent.add(g);
      parent = g;
      this.tail.push(g);
      this.tailSeg.push(seg);
    }
    this.root.traverse((o) => ((o as any).isMesh ? ((o as THREE.Mesh).castShadow = false) : 0));
  }

  setLook(look: Look) {
    this.look = { ...look };
    const fur = furColor(look.fur);
    const isGold = look.fur === 'emas';
    this.atlas.mat.emissive.setHex(isGold ? 0x3a2a00 : 0x000000);
    const eye = getItem('eyes', look.eyes);
    this.eyeMesh[0].material = eyeMat(eye?.color ?? 0x6fcf5a);
    this.eyeMesh[1].material = eyeMat(eye?.color2 ?? eye?.color ?? 0x6fcf5a);
    this.paint(look, fur);
    this.buildAccessories(look);
  }

  /** paint fur, pattern and face into the atlas */
  private paint(look: Look, fur: number) {
    const A = this.atlas, C = A.cells, g = A.g;
    g.clearRect(0, 0, A.S, A.S);
    const p = look.pattern;
    const white = 0xfbfaf6;
    const dark = look.fur === 'hitam' ? 0x6b6a78 : shade(fur, 0.68);
    let light = mix(fur, 0xffffff, 0.45);
    let paw = fur, tip = fur, mid = fur;
    if (p === 'tuxedo' || p === 'kauskaki') paw = tip = white;
    if (p === 'tuxedo') light = white;
    if (p === 'belang') mid = dark;
    const calA = look.fur === 'oranye' ? 0x3b3a45 : 0xf2a044;
    const calB = look.fur === 'hitam' ? white : 0x3b3a45;
    if (p === 'calico') tip = calA;

    for (const k of ['body', 'head', 'leg', 'ear', 't0']) A.paintBox(C[k], fur);
    A.paintBox(C.paw, paw);
    A.paintBox(C.t1, mid);
    A.paintBox(C.t2, tip);
    // belly a little lighter; inner ear pink
    A.fill(C.body[NY], shade(light, 0.95));
    A.frac(C.ear[PZ], 0.25, 0.2, 0.5, 0.6, PINK);

    const B_ = C.body, Hd = C.head;
    // body helpers: z in cat units (body spans z -0.30..0.28), y from top (0) to bottom (1)
    const zMin = BODY_P[2] - BODY[2] / 2, zLen = BODY[2];
    const topZ = (z: number) => (z - zMin) / zLen; // +y face: row 0 = back
    const sideZ = (z: number, sx: number) => (sx > 0 ? (zMin + zLen - z) / zLen : (z - zMin) / zLen);
    if (p === 'belang') {
      for (const z of [-0.22, -0.09, 0.04, 0.17]) {
        A.frac(B_[PY], 0, topZ(z) - 0.04, 1, 0.08, dark);
        for (const sx of [1, -1]) A.frac(B_[sx > 0 ? PX : NX], sideZ(z, sx) - 0.04, 0, 0.08, 0.7, dark);
      }
      A.frac(B_[NZ], 0.2, 0, 0.6, 0.15, dark);
      for (const x of [0.3, 0.47, 0.64]) A.frac(Hd[PY], x, 0.1, 0.08, 0.8, dark);
      for (const x of [0.32, 0.46, 0.6]) A.frac(Hd[PZ], x, 0, 0.08, 0.17, dark);
      for (const s of [PX, NX]) A.frac(Hd[s], 0.3, 0.15, 0.4, 0.08, dark);
    } else if (p === 'tuxedo') {
      A.frac(B_[PZ], 0.15, 0.25, 0.7, 0.75, white);
      A.fill(B_[NY], white);
    } else if (p === 'calico') {
      A.frac(B_[PY], 0.5, topZ(-0.24), 0.5, 0.42, calA);
      A.frac(B_[PY], 0.05, topZ(0.05), 0.4, 0.3, calB);
      A.frac(B_[NX], sideZ(0.16, -1) - 0.3, 0.1, 0.35, 0.6, calB);
      A.frac(B_[PX], sideZ(-0.05, 1) - 0.1, 0.0, 0.25, 0.45, calA);
      A.frac(Hd[PY], 0.5, 0.0, 0.5, 0.75, calA);
      A.frac(Hd[PX], 0.15, 0.0, 0.6, 0.55, calA);
      A.frac(Hd[PZ], 0.72, 0, 0.28, 0.3, calA);
      A.paintBox(C.ear, fur);
      A.frac(C.ear[PZ], 0.25, 0.2, 0.5, 0.6, PINK);
    } else if (p === 'tutul') {
      const spots: [number, number, number, number][] = [
        // face, fx, fy, size
        [PY, 0.6, topZ(-0.18), 0.2],
        [PY, 0.2, topZ(-0.02), 0.18],
        [PY, 0.55, topZ(0.14), 0.16],
        [PX, sideZ(-0.1, 1), 0.25, 0.12],
        [NX, sideZ(0.1, -1), 0.35, 0.11],
        [NX, sideZ(-0.18, -1), 0.15, 0.1],
      ];
      for (const [f, x, y, s] of spots) A.frac(B_[f], x - s / 2, y - s / 2, s, s * (f === PY ? 1.6 : 2.2), dark);
      A.frac(Hd[PY], 0.2, 0.2, 0.15, 0.2, dark);
      A.frac(Hd[PY], 0.7, 0.55, 0.13, 0.18, dark);
      A.frac(Hd[PX], 0.4, 0.2, 0.15, 0.18, dark);
    }

    // ---- face (+z of the head, 38×32 px; x: left→right is -x→+x, y: top→bottom) ----
    const F = Hd[PZ];
    A.frac(F, 0.29, 0.56, 0.42, 0.44, light); // muzzle
    if (p === 'tuxedo') A.frac(F, 0.42, 0.3, 0.16, 0.3, white); // blaze
    A.frac(F, 0.42, 0.56, 0.16, 0.1, 0xf27a9a); // nose
    const ink = 0x4a2f2a;
    A.frac(F, 0.487, 0.66, 0.026, 0.1, ink); // philtrum
    A.frac(F, 0.39, 0.76, 0.1, 0.035, ink); // mouth "w"
    A.frac(F, 0.51, 0.76, 0.1, 0.035, ink);
    A.frac(F, 0.37, 0.72, 0.03, 0.05, ink);
    A.frac(F, 0.6, 0.72, 0.03, 0.05, ink);
    const wh = lum(light) > 0.78 ? 'rgba(60,45,40,.6)' : 'rgba(255,255,255,.9)';
    for (const y of [0.66, 0.76]) {
      A.frac(F, 0.0, y, 0.24, 0.032, wh);
      A.frac(F, 0.76, y, 0.24, 0.032, wh);
    }
    A.frac(F, 0.08, 0.56, 0.13, 0.06, 'rgba(255,110,130,.45)'); // blush
    A.frac(F, 0.79, 0.56, 0.13, 0.06, 'rgba(255,110,130,.45)');
    A.done();
  }


  private buildAccessories(look: Look) {
    this.headAcc.clear();
    this.faceAcc.clear();
    this.neckAcc.clear();
    this.backAcc.clear();
    this.wings = [];
    this.cape = null;
    const h = this.headAcc;
    switch (look.head) {
      case 'pita': {
        const c = lam(0xff5fa2);
        const g = new THREE.Group();
        g.position.set(0.1, 0.0, 0.05);
        g.add(B(0.05, 0.05, 0.05, c, 0, 0, 0));
        const w1 = B(0.1, 0.08, 0.04, c, 0.07, 0, 0);
        w1.rotation.z = 0.3;
        const w2 = B(0.1, 0.08, 0.04, c, -0.07, 0, 0);
        w2.rotation.z = -0.3;
        g.add(w1, w2);
        g.rotation.z = -0.3;
        h.add(g);
        break;
      }
      case 'bunga': {
        const cols = [0xff6f91, 0xffd23f, 0x7ad3ff, 0xff9f43, 0xc38bff];
        for (let i = 0; i < 7; i++) {
          const a = (i / 7) * Math.PI * 2;
          const x = Math.cos(a) * 0.16, z = Math.sin(a) * 0.13;
          h.add(B(0.07, 0.05, 0.07, lam(cols[i % cols.length]), x, 0.02, z));
          h.add(B(0.03, 0.03, 0.03, lam(0xfff3b0), x, 0.05, z));
          h.add(B(0.05, 0.02, 0.03, lam(0x4caf50), Math.cos(a + 0.4) * 0.17, 0.0, Math.sin(a + 0.4) * 0.14));
        }
        break;
      }
      case 'koboi': {
        const c = lam(0x8a5a2b);
        h.add(B(0.52, 0.03, 0.44, c, 0, 0.02, 0));
        h.add(B(0.28, 0.15, 0.24, c, 0, 0.1, 0));
        h.add(B(0.29, 0.035, 0.25, lam(0x3a2412), 0, 0.05, 0));
        h.add(B(0.1, 0.03, 0.26, c, 0, 0.18, 0));
        break;
      }
      case 'topiPesta': {
        const g = new THREE.Group();
        g.rotation.z = 0.2;
        g.position.set(0.02, 0, 0);
        const cols = [0x4d96ff, 0xffd93d, 0xff6b6b, 0x6bcb77];
        for (let i = 0; i < 4; i++) {
          const s = 0.2 - i * 0.045;
          g.add(B(s, 0.07, s, lam(cols[i]), 0, 0.035 + i * 0.07, 0));
        }
        g.add(B(0.06, 0.06, 0.06, lam(0xffffff), 0, 0.33, 0));
        h.add(g);
        break;
      }
      case 'mahkota': {
        const gold = lam(0xf5c542);
        (gold as any).emissive?.setHex?.(0x221800);
        h.add(B(0.3, 0.07, 0.03, gold, 0, 0.035, 0.12));
        h.add(B(0.3, 0.07, 0.03, gold, 0, 0.035, -0.12));
        h.add(B(0.03, 0.07, 0.24, gold, 0.135, 0.035, 0));
        h.add(B(0.03, 0.07, 0.24, gold, -0.135, 0.035, 0));
        for (const x of [-0.12, 0, 0.12]) {
          h.add(B(0.045, 0.07, 0.03, gold, x, 0.1, 0.12));
          h.add(B(0.045, 0.07, 0.03, gold, x, 0.1, -0.12));
        }
        h.add(B(0.05, 0.04, 0.02, lam(0xe53935), 0, 0.035, 0.14));
        h.add(B(0.04, 0.04, 0.02, lam(0x1e88e5), 0.09, 0.035, 0.14));
        h.add(B(0.04, 0.04, 0.02, lam(0x43a047), -0.09, 0.035, 0.14));
        break;
      }
      case 'topiBintang': {
        // floppy wizard hat with a little gold star
        const c = lam(0x5b3fd1);
        const g = new THREE.Group();
        g.rotation.z = -0.15;
        h.add(B(0.4, 0.03, 0.36, c, 0, 0.015, 0));
        for (let i = 0; i < 4; i++) {
          const s = 0.24 - i * 0.055;
          g.add(B(s, 0.08, s, c, 0.01 * i, 0.06 + i * 0.075, -0.01 * i));
        }
        const gold = lam(0xffd23f);
        (gold as any).emissive?.setHex?.(0x332500);
        g.add(B(0.08, 0.025, 0.02, gold, 0.06, 0.38, -0.03));
        g.add(B(0.025, 0.08, 0.02, gold, 0.06, 0.38, -0.03));
        g.add(B(0.04, 0.04, 0.03, gold, 0.06, 0.38, -0.03));
        g.add(B(0.05, 0.05, 0.01, gold, 0.06, 0.12, 0.1));
        h.add(g);
        break;
      }
      case 'headset': {
        const c = lam(0x22252e), r = lam(0xff3d7f);
        h.add(B(0.36, 0.035, 0.06, c, 0, 0.03, -0.02));
        for (const sx of [1, -1]) {
          h.add(B(0.035, 0.12, 0.06, c, 0.19 * sx, -0.03, -0.02));
          h.add(B(0.07, 0.13, 0.13, r, 0.205 * sx, -0.12, -0.02));
          h.add(B(0.075, 0.07, 0.07, lam(0xffffff), 0.215 * sx, -0.12, -0.02));
        }
        break;
      }
      case 'topiNelayan': {
        // floppy bucket hat with a little fish badge
        const c = lam(0x7d9b4f);
        h.add(B(0.46, 0.025, 0.42, lam(0x6b8a40), 0, 0.01, 0));
        h.add(B(0.3, 0.12, 0.27, c, 0, 0.08, 0));
        h.add(B(0.31, 0.03, 0.28, lam(0xc9a86a), 0, 0.04, 0));
        h.add(B(0.08, 0.04, 0.02, lam(0xff8f00), 0.04, 0.09, 0.14));
        h.add(B(0.03, 0.04, 0.02, lam(0xff8f00), -0.01, 0.09, 0.14));
        break;
      }
    }
    const f = this.faceAcc;
    switch (look.face) {
      case 'bulat': {
        const c = lam(0x2b2b33);
        for (const sx of [1, -1]) {
          const x = 0.09 * sx;
          f.add(B(0.12, 0.018, 0.02, c, x, 0.055, 0));
          f.add(B(0.12, 0.018, 0.02, c, x, -0.055, 0));
          f.add(B(0.018, 0.12, 0.02, c, x + 0.055, 0, 0));
          f.add(B(0.018, 0.12, 0.02, c, x - 0.055, 0, 0));
        }
        f.add(B(0.07, 0.015, 0.02, c, 0, 0.02, 0));
        break;
      }
      case 'hitamK': {
        const c = lam(0x14141a);
        f.add(B(0.13, 0.08, 0.02, c, 0.09, 0, 0.004));
        f.add(B(0.13, 0.08, 0.02, c, -0.09, 0, 0.004));
        f.add(B(0.38, 0.02, 0.02, c, 0, 0.035, 0.004));
        f.add(B(0.03, 0.02, 0.02, lam(0xffffff), 0.12, 0.02, 0.016));
        break;
      }
      case 'hati': {
        const c = lam(0xff3d7f);
        for (const sx of [1, -1]) {
          const x = 0.09 * sx;
          f.add(B(0.055, 0.055, 0.02, c, x - 0.028, 0.02, 0.004));
          f.add(B(0.055, 0.055, 0.02, c, x + 0.028, 0.02, 0.004));
          f.add(B(0.08, 0.05, 0.02, c, x, -0.02, 0.004));
          f.add(B(0.035, 0.03, 0.02, c, x, -0.05, 0.004));
        }
        f.add(B(0.07, 0.015, 0.02, lam(0xd81b60), 0, 0.03, 0));
        break;
      }
      case 'bintangK': {
        const c = lam(0xffc61a);
        (c as any).emissive?.setHex?.(0x2a1d00);
        for (const sx of [1, -1]) {
          const x = 0.09 * sx;
          f.add(B(0.12, 0.04, 0.02, c, x, 0, 0.004));
          f.add(B(0.04, 0.12, 0.02, c, x, 0, 0.004));
          const d = B(0.07, 0.07, 0.02, c, x, 0, 0.004);
          d.rotation.z = Math.PI / 4;
          f.add(d);
          f.add(B(0.035, 0.035, 0.02, lam(0x7ad3ff), x, 0, 0.014));
        }
        f.add(B(0.07, 0.015, 0.02, c, 0, 0.02, 0));
        break;
      }
      case 'topengNakal': {
        // little black bandit mask with eye holes
        const c = lam(0x1d1d26);
        f.add(B(0.38, 0.03, 0.02, c, 0, 0.045, 0.002));
        f.add(B(0.38, 0.03, 0.02, c, 0, -0.035, 0.002));
        for (const x of [-0.17, 0, 0.17]) f.add(B(0.05, 0.11, 0.02, c, x, 0.005, 0.002));
        f.add(B(0.1, 0.02, 0.02, c, 0.22, 0.03, -0.03));
        f.add(B(0.1, 0.02, 0.02, c, -0.22, 0.03, -0.03));
        break;
      }
    }
    const n = this.neckAcc;
    const collar = (col: number) => {
      n.add(B(0.3, 0.05, 0.03, lam(col), 0, 0.47, 0.27));
      n.add(B(0.03, 0.05, 0.12, lam(col), 0.16, 0.48, 0.22));
      n.add(B(0.03, 0.05, 0.12, lam(col), -0.16, 0.48, 0.22));
    };
    switch (look.neck) {
      case 'kalung':
        collar(0xe0413b);
        n.add(B(0.05, 0.05, 0.02, lam(0xf5c542), 0, 0.44, 0.29));
        break;
      case 'lonceng':
        collar(0x2f6fdb);
        n.add(B(0.075, 0.075, 0.075, lam(0xf5c542), 0, 0.42, 0.3));
        n.add(B(0.02, 0.02, 0.02, lam(0x333333), 0, 0.39, 0.34));
        break;
      case 'syal': {
        const c = lam(0x2eaa6b), c2 = lam(0xf4f1e8);
        n.add(B(0.36, 0.08, 0.05, c, 0, 0.47, 0.27));
        n.add(B(0.04, 0.08, 0.16, c, 0.18, 0.48, 0.2));
        n.add(B(0.04, 0.08, 0.16, c, -0.18, 0.48, 0.2));
        n.add(B(0.08, 0.22, 0.04, c, 0.08, 0.36, 0.29));
        n.add(B(0.081, 0.04, 0.041, c2, 0.08, 0.3, 0.29));
        n.add(B(0.081, 0.04, 0.041, c2, 0.08, 0.38, 0.29));
        break;
      }
      case 'dasi': {
        const c = lam(0x2b59c3);
        n.add(B(0.05, 0.05, 0.03, c, 0, 0.45, 0.29));
        const a = B(0.08, 0.07, 0.03, c, 0.06, 0.45, 0.29);
        a.rotation.z = 0.25;
        const b = B(0.08, 0.07, 0.03, c, -0.06, 0.45, 0.29);
        b.rotation.z = -0.25;
        n.add(a, b);
        break;
      }
      case 'pelangi': {
        const cols = [0xff5252, 0xffa726, 0xffee58, 0x66bb6a, 0x42a5f5, 0xab47bc];
        n.add(B(0.36, 0.08, 0.05, lam(cols[0]), 0, 0.47, 0.27));
        n.add(B(0.04, 0.08, 0.16, lam(cols[4]), 0.18, 0.48, 0.2));
        n.add(B(0.04, 0.08, 0.16, lam(cols[2]), -0.18, 0.48, 0.2));
        for (let i = 0; i < 6; i++) n.add(B(0.08, 0.045, 0.04, lam(cols[i]), 0.08, 0.41 - i * 0.04, 0.29));
        break;
      }
      case 'syalApi': {
        const red = lam(0xff4b1f), org = lam(0xffa21f), yel = lam(0xffe14a);
        for (const m of [red, org, yel]) (m as any).emissive?.setHex?.(0x301000);
        n.add(B(0.36, 0.08, 0.05, red, 0, 0.47, 0.27));
        n.add(B(0.04, 0.08, 0.16, red, 0.18, 0.48, 0.2));
        n.add(B(0.04, 0.08, 0.16, red, -0.18, 0.48, 0.2));
        // flame tips on the front
        n.add(B(0.06, 0.07, 0.04, org, -0.1, 0.53, 0.28));
        n.add(B(0.05, 0.1, 0.04, yel, 0, 0.545, 0.285));
        n.add(B(0.06, 0.07, 0.04, org, 0.1, 0.53, 0.28));
        n.add(B(0.09, 0.2, 0.04, red, 0.08, 0.36, 0.29));
        n.add(B(0.07, 0.07, 0.041, org, 0.08, 0.3, 0.29));
        n.add(B(0.035, 0.05, 0.042, yel, 0.08, 0.27, 0.29));
        break;
      }
      case 'mutiara': {
        const pearl = lam(0xfaf6ff);
        (pearl as any).emissive?.setHex?.(0x1a1a22);
        for (let i = 0; i < 7; i++) {
          const a = -1.2 + (i / 6) * 2.4;
          n.add(B(0.045, 0.045, 0.045, pearl, Math.sin(a) * 0.16, 0.47 - Math.cos(a) * 0.03, 0.22 + Math.cos(a) * 0.07));
        }
        n.add(B(0.06, 0.06, 0.04, lam(0xff80ab), 0, 0.42, 0.3));
        break;
      }
    }
    const bk = this.backAcc;
    switch (look.back) {
      case 'ransel': {
        bk.add(B(0.24, 0.16, 0.2, lam(0xf07b2a), 0, 0.6, -0.08));
        bk.add(B(0.25, 0.06, 0.12, lam(0xd35f14), 0, 0.66, -0.02));
        bk.add(B(0.2, 0.08, 0.04, lam(0xf8c14a), 0, 0.58, -0.2));
        bk.add(B(0.03, 0.2, 0.03, lam(0x6b3b12), 0.14, 0.47, 0.03));
        bk.add(B(0.03, 0.2, 0.03, lam(0x6b3b12), -0.14, 0.47, 0.03));
        break;
      }
      case 'sayap': {
        for (const sx of [1, -1]) {
          const g = new THREE.Group();
          g.position.set(0.14 * sx, 0.55, 0.0);
          const w = lam(0xffffff);
          const f1 = B(0.3, 0.1, 0.03, w, 0.15 * sx, 0.06, 0);
          f1.rotation.z = 0.5 * sx;
          const f2 = B(0.26, 0.08, 0.03, w, 0.13 * sx, 0.0, -0.05);
          f2.rotation.z = 0.3 * sx;
          const f3 = B(0.2, 0.07, 0.03, lam(0xeaf2ff), 0.1 * sx, -0.05, -0.1);
          f3.rotation.z = 0.1 * sx;
          g.add(f1, f2, f3);
          g.rotation.y = -0.4 * sx;
          bk.add(g);
          this.wings.push(g);
        }
        break;
      }
      case 'kupu': {
        const cols = [0xff7ac8, 0x7ad3ff];
        for (const sx of [1, -1]) {
          const g = new THREE.Group();
          g.position.set(0.1 * sx, 0.6, -0.05);
          const top = B(0.26, 0.2, 0.025, lam(cols[0]), 0.13 * sx, 0.07, 0);
          top.rotation.z = 0.35 * sx;
          const bot = B(0.17, 0.14, 0.025, lam(cols[1]), 0.09 * sx, -0.09, -0.01);
          bot.rotation.z = -0.3 * sx;
          const dot = B(0.06, 0.06, 0.03, lam(0xffe14a), 0.17 * sx, 0.1, 0.004);
          g.add(top, bot, dot);
          g.rotation.y = -0.4 * sx;
          bk.add(g);
          this.wings.push(g);
        }
        break;
      }
      case 'jubah': {
        const g = new THREE.Group();
        g.position.set(0, 0.54, 0.2);
        const c = lam(0xd9342b);
        g.add(B(0.4, 0.02, 0.42, c, 0, 0, -0.21));
        g.add(B(0.02, 0.18, 0.42, c, 0.2, -0.09, -0.21));
        g.add(B(0.02, 0.18, 0.42, c, -0.2, -0.09, -0.21));
        g.add(B(0.12, 0.05, 0.03, lam(0xf5c542), 0, 0.0, 0.03));
        bk.add(g);
        this.cape = g;
        break;
      }
    }
  }

  update(dt: number, s: CatAnim) {
    this.t += dt;
    const t = this.t;
    const sp = Math.min(1, s.speed);
    if (sp > 0.05 && !s.air) this.phase += dt * (7 + 9 * sp);
    const a = 0.85 * sp;
    const sn = Math.sin(this.phase);
    let fl = sn * a, fr = -sn * a, bl = -sn * a, br = sn * a;
    let poseRX = 0, poseY = 0.27;
    let headRX = Math.sin(this.phase * 2) * 0.05 * sp;
    let headRY = s.lookYaw;
    let tailRX = 0.45 + s.happy * 0.55, tailRY = 0.45 + Math.sin(t * 2.2) * 0.3;
    if (sp > 0.05) tailRY = 0.35 + Math.sin(this.phase) * 0.2;
    let frontScale = 1;
    if (s.air) {
      fl = fr = -0.9;
      bl = br = 0.9;
      tailRX = 0.2;
    }
    if (s.hugged) {
      fl = fr = 0.1;
      bl = br = 0.25;
      tailRX = -0.6;
      tailRY = Math.sin(t * 8) * 0.4;
    }
    // sit (fishing, talking)
    if (s.sit > 0) {
      const k = s.sit;
      poseRX += -0.5 * k;
      poseY -= 0.1 * k;
      fl = fl * (1 - k) + 0.5 * k;
      fr = fr * (1 - k) + 0.5 * k;
      bl = bl * (1 - k) + -1.1 * k;
      br = br * (1 - k) + -1.1 * k;
      frontScale = 1 + 0.25 * k;
      tailRX = tailRX * (1 - k) + -0.3 * k;
      headRX += 0.35 * k;
    }
    // scratch / dig / paw
    if (s.scratch) {
      poseRX = -0.75;
      poseY = 0.2;
      fl = -1.6 + Math.sin(t * 26) * 0.55;
      fr = -1.6 - Math.sin(t * 26) * 0.55;
      bl = br = 0.75;
      headRX = 0.3;
    }
    if (s.dig) {
      fl = Math.sin(t * 30) * 0.9 - 0.3;
      fr = -Math.sin(t * 30) * 0.9 - 0.3;
      headRX = 0.5;
      tailRX = 1.1;
    }
    if (s.paw > 0) {
      fr = -1.8 * Math.sin(s.paw * Math.PI);
      headRX -= 0.1;
    }
    if (s.eat) headRX = 0.45 + Math.sin(t * 22) * 0.18;
    // sleep (sphinx pose)
    if (s.sleep > 0) {
      const k = s.sleep;
      poseY -= 0.19 * k;
      fl = fl * (1 - k) + -1.45 * k;
      fr = fr * (1 - k) + -1.45 * k;
      bl = bl * (1 - k) + 1.45 * k;
      br = br * (1 - k) + 1.45 * k;
      headRX = headRX * (1 - k) + 0.2 * k;
      tailRX = tailRX * (1 - k) + -0.25 * k;
      tailRY = tailRY * (1 - k) + (1.3 + Math.sin(t * 0.8) * 0.1) * k;
      poseRX *= 1 - k;
    }
    this.legs[0].rotation.x = fl;
    this.legs[1].rotation.x = fr;
    this.legs[2].rotation.x = bl;
    this.legs[3].rotation.x = br;
    this.legs[0].scale.y = this.legs[1].scale.y = frontScale;
    this.pose.rotation.x = poseRX;
    this.pose.position.y = poseY + (s.air || s.sleep > 0.5 ? 0 : Math.abs(Math.sin(this.phase)) * 0.025 * sp);
    this.headG.rotation.x = headRX;
    this.headG.rotation.y = headRY;
    this.tail[0].rotation.x = tailRX;
    this.tail[0].rotation.y = tailRY;
    this.tail[1].rotation.y = tailRY * 0.6;
    this.tail[2].rotation.y = tailRY * 0.6;
    this.tail[1].rotation.x = 0.35 - s.sleep * 0.3;
    this.tail[2].rotation.x = 0.35 - s.sleep * 0.3;

    // ears (twitch / flatten)
    this.twitchT -= dt;
    if (this.twitchT < 0) {
      this.twitchT = rand(3, 8);
      this.twitchEar = Math.random() < 0.5 ? 0 : 1;
      this.twitchK = 1;
    }
    this.twitchK = Math.max(0, this.twitchK - dt * 5);
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? 1 : -1;
      const tw = i === this.twitchEar ? Math.sin(this.twitchK * Math.PI) * 0.4 : 0;
      this.ears[i].rotation.z = (-0.22 - 0.5 * s.earsDown - tw) * sx;
      this.ears[i].rotation.x = -0.8 * s.earsDown;
    }
    // eyes
    this.blinkT -= dt;
    let eyeS = 1;
    if (this.blinkT < 0) {
      if (this.blinkT < -0.13) this.blinkT = rand(2, 5);
      else eyeS = 0.15;
    }
    if (s.sleep > 0.5) eyeS = 0.12;
    if (s.happy > 0.5) eyeS = 0.35;
    for (const e of this.eyes) e.scale.y = eyeS;

    // wings / cape
    for (let i = 0; i < this.wings.length; i++) {
      const sx = i === 0 ? 1 : -1;
      this.wings[i].rotation.y = (-0.4 + Math.sin(t * (s.air ? 18 : 3)) * (s.air ? 0.5 : 0.12)) * sx;
    }
    if (this.cape) this.cape.rotation.x = -0.15 - sp * 0.35 - (s.air ? 0.5 : 0) + Math.sin(t * 9) * 0.05 * sp;
  }
}
