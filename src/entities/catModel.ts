import * as THREE from 'three';
import { boxGeo, lam } from '../world/builder';
import type { Look } from '../save';
import { getItem, furColor } from '../cosmetics';
import { rand } from '../ctx';

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

// Blocky Roblox-style cat, +z is forward, origin at the feet.
export class CatModel {
  root = new THREE.Group();
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
  bodyPat = new THREE.Group();
  headPat = new THREE.Group();
  headAcc = new THREE.Group();
  faceAcc = new THREE.Group();
  neckAcc = new THREE.Group();
  backAcc = new THREE.Group();
  carry = new THREE.Group();
  furMat = new THREE.MeshLambertMaterial({ color: 0xf2a044 });
  lightMat = new THREE.MeshLambertMaterial({ color: 0xffe0b0 });
  pawMat = new THREE.MeshLambertMaterial({ color: 0xf2a044 });
  tailTipMat = new THREE.MeshLambertMaterial({ color: 0xf2a044 });
  tailMidMat = new THREE.MeshLambertMaterial({ color: 0xf2a044 });
  eyeMatL = new THREE.MeshLambertMaterial({ color: 0x6fcf5a });
  eyeMatR = new THREE.MeshLambertMaterial({ color: 0x6fcf5a });
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
    this.root.add(this.pose);
    this.pose.position.set(0, 0.27, -0.19);
    this.pose.add(this.inner);
    this.inner.position.set(0, -0.27, 0.19);
    const I = this.inner;

    // torso
    I.add(B(0.34, 0.26, 0.58, this.furMat, 0, 0.39, -0.01));
    I.add(this.bodyPat);
    // legs
    const legPos = [
      [0.1, 0.17],
      [-0.1, 0.17],
      [0.1, -0.19],
      [-0.1, -0.19],
    ];
    for (const [x, z] of legPos) {
      const g = new THREE.Group();
      g.position.set(x, 0.27, z);
      const up = B(0.1, 0.19, 0.1, this.furMat, 0, -0.095, 0);
      const paw = B(0.11, 0.08, 0.12, this.pawMat, 0, -0.23, 0.01);
      g.add(up, paw);
      I.add(g);
      this.legs.push(g);
      this.legUpper.push(up);
      this.paws.push(paw);
    }
    // head
    this.headG.position.set(0, 0.5, 0.26);
    I.add(this.headG);
    const H = this.headG;
    H.add(B(0.38, 0.32, 0.3, this.furMat, 0, 0.1, 0.1));
    H.add(B(0.17, 0.1, 0.06, this.lightMat, 0, 0.01, 0.27));
    H.add(B(0.06, 0.04, 0.02, lam(0xf27a9a), 0, 0.055, 0.305));
    H.add(B(0.03, 0.012, 0.01, lam(0x4a2f2a), -0.02, -0.02, 0.301));
    H.add(B(0.03, 0.012, 0.01, lam(0x4a2f2a), 0.02, -0.02, 0.301));
    H.add(this.headPat);
    for (const sx of [1, -1]) {
      const e = new THREE.Group();
      e.position.set(0.09 * sx, 0.13, 0.255);
      e.add(B(0.085, 0.095, 0.02, sx > 0 ? this.eyeMatL : this.eyeMatR, 0, 0, 0));
      e.add(B(0.035, 0.078, 0.012, lam(0x15151c), 0, -0.004, 0.012));
      e.add(B(0.024, 0.024, 0.01, lam(0xffffff), 0.02 * sx, 0.024, 0.02));
      H.add(e);
      this.eyes.push(e);
      const ear = new THREE.Group();
      ear.position.set(0.12 * sx, 0.25, 0.08);
      ear.rotation.z = -0.22 * sx;
      ear.add(B(0.12, 0.14, 0.06, this.furMat, 0, 0.07, 0));
      ear.add(B(0.07, 0.08, 0.012, lam(0xf5a3b5), 0, 0.06, 0.031));
      H.add(ear);
      this.ears.push(ear);
      for (const r of [0.14, -0.1]) {
        const w = B(0.15, 0.01, 0.01, lam(0xf8f8f8), 0.14 * sx, 0.005 + r * 0.1, 0.285);
        w.rotation.z = r * sx;
        H.add(w);
      }
    }
    H.add(this.headAcc, this.faceAcc, this.carry);
    this.headAcc.position.set(0, 0.26, 0.1);
    this.faceAcc.position.set(0, 0.13, 0.268);
    this.carry.position.set(0, -0.03, 0.33);
    I.add(this.neckAcc, this.backAcc);

    // tail
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
      const seg = B(0.065, 0.065, 0.17, i === 2 ? this.tailTipMat : i === 1 ? this.tailMidMat : this.furMat, 0, 0, -0.075);
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
    this.furMat.color.setHex(fur);
    this.furMat.emissive.setHex(isGold ? 0x3a2a00 : 0x000000);
    const light = mix(fur, 0xffffff, 0.45);
    this.lightMat.color.setHex(light);
    this.pawMat.color.setHex(fur);
    this.tailTipMat.color.setHex(fur);
    this.tailMidMat.color.setHex(fur);
    const eye = getItem('eyes', look.eyes);
    this.eyeMatL.color.setHex(eye?.color ?? 0x6fcf5a);
    this.eyeMatR.color.setHex(eye?.color2 ?? eye?.color ?? 0x6fcf5a);

    // pattern
    this.bodyPat.clear();
    this.headPat.clear();
    const dark = look.fur === 'hitam' ? 0x6b6a78 : shade(fur, 0.68);
    const dm = lam(dark);
    const white = lam(0xfbfaf6);
    const p = look.pattern;
    if (p === 'belang') {
      for (const z of [-0.22, -0.09, 0.04, 0.17]) this.bodyPat.add(B(0.352, 0.19, 0.045, dm, 0, 0.44, z));
      for (const x of [-0.07, 0, 0.07]) this.headPat.add(B(0.035, 0.012, 0.14, dm, x, 0.262, 0.14));
      for (const x of [-0.06, 0, 0.06]) this.headPat.add(B(0.028, 0.06, 0.012, dm, x, 0.22, 0.252));
      this.tailMidMat.color.setHex(dark);
    } else if (p === 'tuxedo') {
      this.bodyPat.add(B(0.24, 0.2, 0.02, white, 0, 0.37, 0.286));
      this.bodyPat.add(B(0.26, 0.02, 0.4, white, 0, 0.255, 0.02));
      this.lightMat.color.setHex(0xfbfaf6);
      this.pawMat.color.setHex(0xfbfaf6);
      this.tailTipMat.color.setHex(0xfbfaf6);
    } else if (p === 'kauskaki') {
      this.pawMat.color.setHex(0xfbfaf6);
      this.tailTipMat.color.setHex(0xfbfaf6);
    } else if (p === 'calico') {
      const a = look.fur === 'oranye' ? 0x3b3a45 : 0xf2a044;
      const b2 = look.fur === 'hitam' ? 0xfbfaf6 : 0x3b3a45;
      this.bodyPat.add(B(0.2, 0.03, 0.24, lam(a), 0.07, 0.51, -0.12));
      this.bodyPat.add(B(0.02, 0.14, 0.2, lam(b2), -0.172, 0.42, 0.06));
      this.bodyPat.add(B(0.14, 0.03, 0.16, lam(b2), -0.08, 0.515, 0.12));
      this.headPat.add(B(0.18, 0.02, 0.2, lam(a), 0.09, 0.262, 0.1));
      this.headPat.add(B(0.02, 0.16, 0.16, lam(a), 0.191, 0.12, 0.1));
      this.tailTipMat.color.setHex(a);
    } else if (p === 'tutul') {
      const spots = [
        [0.08, 0.525, -0.18, 0.08, 0.02, 0.08],
        [-0.07, 0.525, -0.02, 0.07, 0.02, 0.07],
        [0.06, 0.525, 0.14, 0.06, 0.02, 0.06],
        [0.172, 0.42, -0.1, 0.02, 0.06, 0.07],
        [-0.172, 0.4, 0.1, 0.02, 0.07, 0.06],
        [-0.172, 0.45, -0.18, 0.02, 0.05, 0.05],
      ];
      for (const s of spots) this.bodyPat.add(B(s[3], s[4], s[5], dm, s[0], s[1], s[2]));
      this.headPat.add(B(0.06, 0.02, 0.06, dm, -0.08, 0.262, 0.05));
      this.headPat.add(B(0.05, 0.02, 0.05, dm, 0.1, 0.262, 0.16));
    }

    this.buildAccessories(look);
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
