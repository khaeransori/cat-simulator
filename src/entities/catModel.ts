import * as THREE from 'three';
import { boxGeo, lam } from '../world/builder';
import type { Look } from '../save';
import { getItem, furColor } from '../cosmetics';
import { rand } from '../ctx';
import { Atlas, uvBox, merged, mesh, joint, plane, PZ, PY, ANIMAL_SCALE, faceCanvas, mockEyeMat, paintPart, hexCss } from './blockyAnimal';

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

// Blocky cat = the APPROVED MOCKUP's quadruped (scratch/lowpoly/chars/animals_part.ts):
// body 0.62×0.5×0.9 with a 64 px painted coat, legs 0.18×0.45 + paws, head 0.62×0.56×0.5 with
// the 128 px painted face, square cat ears with pink inner, L-shaped tail, collar under the chin.
// Built in mockup units, then sized by MOCK_S × ANIMAL_SCALE (mockup cat 0.62, adult 1.69 → game 2.0).
// Differences from the mockup that the game needs: the eyes are separate planes (blink, cosmetic eye
// colour) drawn exactly where the mockup paints them, and the coat/face colours follow the save look.
const MOCK_S = 0.62;
export const CAT_SCALE = MOCK_S * ANIMAL_SCALE;
const BODY_LEN = 0.9;
const HIP = 0.45; // leg joint height (mockup units)
const LEG_Z = BODY_LEN / 2 - 0.12;
const HEAD_J = [0, 0.78, BODY_LEN / 2 - 0.02] as const;
/** old cat units → mockup units, for things authored against the previous cat (rod, carried items) */
const LEGACY = 1.667;
const PINK = 0xf2a3a3;

export class CatModel {
  root = new THREE.Group();
  /** uniform size group (root.scale stays free for callers, e.g. the bigger cat friends) */
  sizeG = new THREE.Group();
  pose = new THREE.Group();
  /** the cat's body parts (mockup units) */
  bodyG = new THREE.Group();
  /** legacy mount in the previous cat's units (fishing rod); moves with the body pose */
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
  atlas = new Atlas(256, 64);
  /** ear-tip height in metres at root scale 1 */
  height = 1.4 * CAT_SCALE;
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
    const c = {
      body: A.boxPx('body', 32),
      belly: A.boxPx('belly', 4),
      leg: A.boxPx('leg', 4),
      paw: A.boxPx('paw', 4),
      head: A.boxPx('head', 4, 128),
      ear: A.boxPx('ear', 4),
      earIn: A.boxPx('earIn', 4),
      tailA: A.boxPx('tailA', 4),
      tailB: A.boxPx('tailB', 4),
      tip: A.boxPx('tip', 4),
    };
    this.root.add(this.sizeG);
    this.sizeG.scale.setScalar(CAT_SCALE);
    this.sizeG.add(this.pose);
    // pose pivot = back hips (sit / scratch rotate around it)
    this.pose.position.set(0, HIP, -LEG_Z);
    this.pose.add(this.bodyG);
    this.bodyG.position.set(0, -HIP, LEG_Z);
    const Bd = this.bodyG;
    this.bodyG.add(this.inner);
    this.inner.scale.setScalar(LEGACY);

    Bd.add(mesh(uvBox(A, c.body, 0.62, 0.5, BODY_LEN), M, 0, 0.62, 0));
    Bd.add(mesh(uvBox(A, c.belly, 0.5, 0.06, BODY_LEN * 0.8), M, 0, 0.36, 0));
    // legs: pivot at the hip, block hangs down (Kenney arm/leg nodes)
    const legGeo = merged('mockcat-leg', [uvBox(A, c.leg, 0.18, 0.45, 0.18, 0, -0.225, 0), uvBox(A, c.paw, 0.2, 0.08, 0.22, 0, -0.41, 0.01)]);
    for (const [x, z] of [
      [0.2, LEG_Z],
      [-0.2, LEG_Z],
      [0.2, -LEG_Z],
      [-0.2, -LEG_Z],
    ]) {
      const g = joint(Bd, x, HIP, z);
      const m = mesh(legGeo, M);
      g.add(m);
      this.legs.push(g);
      this.legUpper.push(m);
      this.paws.push(m);
    }
    // head: pivot at the neck
    this.headG.position.set(...HEAD_J);
    Bd.add(this.headG);
    const H = this.headG;
    H.add(mesh(uvBox(A, c.head, 0.62, 0.56, 0.5), M, 0, 0.16, 0.2));
    // eyes exactly where the mockup paints them (18×22 px of 128 at x 64±26, y 50)
    const eg = plane((18 / 128) * 0.62, (22 / 128) * 0.56);
    for (const sx of [1, -1]) {
      const e = new THREE.Group();
      e.position.set(((26 * sx) / 128) * 0.62, 0.16 + 0.28 - (61 / 128) * 0.56, 0.4515);
      const em = new THREE.Mesh(eg, mockEyeMat(0x6fcf5a));
      e.add(em);
      H.add(e);
      this.eyes.push(e);
      this.eyeMesh.push(em);
      // ear: pivot at the base; the anim's -0.22 outward tilt is undone so it stands upright like the mockup
      const ear = joint(H, 0.19 * sx, 0.44, 0.14);
      const ei = new THREE.Group();
      ei.rotation.z = 0.22 * sx;
      ear.add(ei);
      ei.add(mesh(uvBox(A, c.ear, 0.16, 0.18, 0.08), M, 0, 0.09, 0));
      ei.add(mesh(uvBox(A, c.earIn, 0.08, 0.1, 0.02), M, 0, 0.08, 0.05));
      this.ears.push(ear);
    }
    H.add(this.headAcc, this.faceAcc, this.carry, this.neckAcc);
    // cosmetics are authored in the previous cat's units: map them onto the mockup head
    this.headAcc.position.set(0, 0.44, 0.2); // top centre of the head
    this.headAcc.scale.setScalar(0.62 / 0.38);
    this.faceAcc.position.set(0, 0.173, 0.475); // eye line, just in front of the face
    this.faceAcc.scale.setScalar(1.4);
    this.carry.position.set(0, 0.0, 0.5); // the mouth
    this.carry.scale.setScalar(1 / CAT_SCALE); // carried things keep their world size
    // collars/scarves (authored on the old body, collar at y 0.47 z 0.27) → mockup collar spot
    // under the chin (head-local 0, -0.12, 0.12), widened to the 0.64 mockup collar
    const NK = 0.64 / 0.3;
    this.neckAcc.scale.setScalar(NK);
    this.neckAcc.position.set(0, -0.12 - 0.47 * NK, 0.12 - 0.27 * NK);
    // back items (old body top y 0.52, centre z -0.01) → mockup body top 0.87
    Bd.add(this.backAcc);
    const BK = 1.7;
    this.backAcc.scale.setScalar(BK);
    this.backAcc.position.set(0, 0.87 - 0.52 * BK, 0.01 * BK);

    // tail: pivot at the rump; low piece back, then the upright piece and its tip (mockup L shape).
    // update() drives tail[0].rotation.x ≈ 0.45 and tail[1/2].rotation.x ≈ 0.35 at rest; the meshes
    // are counter-rotated so the rest pose is exactly the mockup's.
    const t0 = joint(Bd, 0, 0.78, -BODY_LEN / 2);
    const a = mesh(uvBox(A, c.tailA, 0.1, 0.1, 0.36), M, 0, 0.06, -0.16);
    a.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.45);
    a.rotation.x = -0.5 - 0.45;
    t0.add(a);
    const tA = a;
    // b: 0.1×0.32 upright at (0, 0.3, -0.3) in the mockup; split 0.2 + 0.12 tip for the colour
    const t1 = new THREE.Group();
    t1.position.set(0, 0.14, -0.3);
    t1.position.applyAxisAngle(new THREE.Vector3(1, 0, 0), -0.45);
    t0.add(t1);
    const bg = new THREE.Group();
    bg.rotation.x = -0.8;
    t1.add(bg);
    const b = mesh(uvBox(A, c.tailB, 0.1, 0.2, 0.1), M, 0, 0.1, 0);
    bg.add(b);
    const t2 = new THREE.Group();
    t2.position.set(0, 0.2, 0);
    bg.add(t2);
    const tipG = new THREE.Group();
    tipG.rotation.x = -0.35;
    t2.add(tipG);
    const tip = mesh(uvBox(A, c.tip, 0.1, 0.12, 0.1), M, 0, 0.06, 0);
    tipG.add(tip);
    this.tail.push(t0, t1, t2);
    this.tailSeg.push(tA, b, tip);
    this.root.traverse((o) => ((o as any).isMesh ? ((o as THREE.Mesh).castShadow = false) : 0));
    // speech bubbles were placed for the previous cat (ear tips at 0.89 m): lift them by the difference
    this.root.userData.bubbleLift = this.height - 0.89;
  }

  setLook(look: Look) {
    this.look = { ...look };
    const fur = furColor(look.fur);
    this.atlas.mat.emissive.setHex(look.fur === 'emas' ? 0x3a2a00 : 0x000000);
    const eye = getItem('eyes', look.eyes);
    this.eyeMesh[0].material = mockEyeMat(eye?.color ?? 0x6fcf5a);
    this.eyeMesh[1].material = mockEyeMat(eye?.color2 ?? eye?.color ?? 0x6fcf5a);
    this.paint(look, fur);
    this.buildAccessories(look);
  }

  /** paint coat, pattern and face exactly the mockup way (64 px coat on every body face, 128 px face) */
  private paint(look: Look, fur: number) {
    const A = this.atlas, C = A.cells;
    A.g.clearRect(0, 0, A.S, A.S);
    const p = look.pattern;
    const white = 0xf6f3ec;
    const light = mix(fur, 0xffffff, 0.6);
    const dark = look.fur === 'hitam' ? 0x6b6a78 : look.fur === 'oranye' ? 0xd9822a : shade(fur, 0.82); // mockup orange stripes 0xd9822a
    const spot = look.fur === 'hitam' ? 0x6b6a78 : shade(fur, 0.62);
    const calA = look.fur === 'oranye' ? 0x3b3a45 : 0xf2a044;
    const calB = look.fur === 'hitam' ? white : 0x3b3a45;
    const whiteBits = p === 'tuxedo' || p === 'kauskaki' || p === 'calico';
    const lightC = p === 'tuxedo' || p === 'calico' ? white : light;
    const pawC = whiteBits ? white : light;
    const tipC = p === 'kauskaki' ? white : p === 'calico' ? calA : fur;

    // coat canvas (mockup bodyPat: 64 px, same on all six faces)
    const coat = document.createElement('canvas');
    coat.width = coat.height = 64;
    const g = coat.getContext('2d')!;
    g.fillStyle = hexCss(fur); g.fillRect(0, 0, 64, 64);
    const R = (x: number, y: number, w: number, h: number, col: number) => { g.fillStyle = hexCss(col); g.fillRect(x, y, w, h); };
    if (p === 'belang') for (let y = 6; y < 64; y += 16) R(0, y, 64, 6, dark);
    if (p === 'tutul') for (const [x, y, s] of [[8, 8, 10], [36, 14, 8], [18, 34, 9], [46, 40, 10], [6, 50, 7], [30, 52, 6]]) R(x, y, s, s, spot);
    if (p === 'calico') { R(4, 6, 24, 18, calA); R(36, 30, 22, 20, calB); R(10, 42, 14, 12, calB); R(44, 4, 14, 12, calA); }
    for (const r of C.body) A.draw(r, coat);
    if (p === 'tuxedo') A.frac(C.body[PZ], 0.2, 0.15, 0.6, 0.85, white); // white bib on the chest
    paintPart(A, C.belly, lightC);
    paintPart(A, C.leg, fur);
    paintPart(A, C.paw, pawC);
    paintPart(A, C.ear, fur);
    paintPart(A, C.earIn, PINK);
    paintPart(A, C.tailA, fur);
    paintPart(A, C.tailB, p === 'belang' ? dark : fur);
    paintPart(A, C.tip, tipC);

    // face (mockup faceTex: muzzle, nose, mouth, whiskers, blush; forehead marks per pattern)
    const mark = (fg: CanvasRenderingContext2D) => {
      fg.fillStyle = hexCss(p === 'tutul' ? spot : dark);
      if (p === 'belang') for (const x of [40, 58, 76]) fg.fillRect(x, 6, 10, 26);
      if (p === 'tutul') { fg.fillRect(30, 10, 12, 12); fg.fillRect(80, 20, 10, 10); }
      if (p === 'calico') { fg.fillStyle = hexCss(calA); fg.fillRect(70, 0, 58, 40); }
      if (p === 'tuxedo') { fg.fillStyle = hexCss(white); fg.fillRect(54, 30, 20, 40); }
    };
    const face = faceCanvas(fur, { nose: 0xe58a8a, mouth: true, whisk: true, blush: true, noEyes: true }, lightC, mark);
    paintPart(A, C.head, fur, face);
    if (p === 'calico') A.frac(C.head[PY], 0.5, 0, 0.5, 1, calA);
    if (p === 'belang') A.frac(C.head[PY], 0.3, 0.1, 0.4, 0.8, dark);
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
    // vertical offsets below are the old cat's, ×1.667 into mockup units
    let poseRX = 0, poseY = HIP;
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
    if (s.sit > 0) {
      const k = s.sit;
      poseRX += -0.5 * k;
      poseY -= 0.167 * k;
      fl = fl * (1 - k) + 0.5 * k;
      fr = fr * (1 - k) + 0.5 * k;
      bl = bl * (1 - k) + -1.1 * k;
      br = br * (1 - k) + -1.1 * k;
      frontScale = 1 + 0.25 * k;
      tailRX = tailRX * (1 - k) + -0.3 * k;
      headRX += 0.35 * k;
    }
    if (s.scratch) {
      poseRX = -0.75;
      poseY = HIP - 0.117;
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
    if (s.sleep > 0) {
      const k = s.sleep;
      poseY -= 0.317 * k;
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
    this.pose.position.y = poseY + (s.air || s.sleep > 0.5 ? 0 : Math.abs(Math.sin(this.phase)) * 0.042 * sp);
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
