import * as THREE from 'three';
import { rand } from '../ctx';
import { Atlas, uvBox, merged, mesh, joint, eyeMat, plane, shadeHex, PX, NX, PY, PZ, NZ, type Faces } from './blockyAnimal';

// Blocky animals (Kenney-Blocky construction): cuboids with pivots at hips, neck, rump and wing
// shoulders, all parts painted into one small Nearest-filtered atlas per species/colour.
// Dimensions are metres (1.7 m adult). Dog ≈ 0.8 m to the top of the head, cat ≈ 0.65,
// duck ≈ 0.45, pigeon ≈ 0.3.

type Part = { n: string; s: [number, number, number] };
const atlasCache = new Map<string, Atlas>();
/** build (once per key) an atlas holding the given cuboids, painted by `paint` */
function speciesAtlas(key: string, size: number, pxu: number, parts: Part[], paint: (a: Atlas) => void) {
  let a = atlasCache.get(key);
  if (!a) {
    a = new Atlas(size, pxu);
    for (const p of parts) a.box(p.n, ...p.s);
    paint(a);
    a.done();
    atlasCache.set(key, a);
  }
  return a;
}
const box = (a: Atlas, p: Part, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => uvBox(a, a.cells[p.n] as Faces, ...p.s, x, y, z, rx, ry, rz);

// ---------------- Dog (Bleki): black, tan muzzle and paws, floppy ears, blue collar ----------------
const DOG = {
  body: { n: 'body', s: [0.36, 0.3, 0.78] } as Part,
  leg: { n: 'leg', s: [0.12, 0.33, 0.12] } as Part,
  paw: { n: 'paw', s: [0.13, 0.07, 0.15] } as Part,
  head: { n: 'head', s: [0.34, 0.3, 0.28] } as Part,
  snout: { n: 'snout', s: [0.2, 0.12, 0.15] } as Part,
  jaw: { n: 'jaw', s: [0.18, 0.05, 0.15] } as Part,
  ear: { n: 'ear', s: [0.06, 0.2, 0.13] } as Part,
  collar: { n: 'collar', s: [0.37, 0.06, 0.22] } as Part,
  tag: { n: 'tag', s: [0.06, 0.06, 0.03] } as Part,
  tail: { n: 'tail', s: [0.07, 0.07, 0.28] } as Part,
};
const DOG_SCALE = 1.05;

export class DogModel {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  jaw = new THREE.Group();
  legs: THREE.Group[] = [];
  tail = new THREE.Group();
  ears: THREE.Mesh[] = [];
  eyes: THREE.Mesh[] = [];
  phase = 0;
  t = 0;

  constructor() {
    const blk = 0x2b2a30, tan = 0xb08a72, earC = 0x1d1c22, collar = 0x1e88e5;
    const A = speciesAtlas('dog', 256, 100, Object.values(DOG), (a) => {
      const C = a.cells;
      for (const k of ['body', 'leg', 'head', 'tail']) a.paintBox(C[k], blk);
      a.paintBox(C.ear, earC);
      a.paintBox(C.paw, tan);
      a.paintBox(C.snout, tan);
      a.paintBox(C.jaw, tan);
      a.frac(C.jaw[PY], 0.25, 0.2, 0.5, 0.7, 0xef7a85); // tongue
      a.paintBox(C.collar, collar);
      a.paintBox(C.tag, 0xfdd835);
      a.frac(C.snout[PZ], 0.3, 0, 0.4, 0.45, 0x111111); // nose
      a.frac(C.snout[PY], 0.3, 0.75, 0.4, 0.25, 0x111111);
      a.frac(C.snout[PZ], 0.47, 0.45, 0.06, 0.3, 0x4a2a22);
      a.frac(C.head[PZ], 0.18, 0.18, 0.18, 0.14, tan); // tan eyebrow dots
      a.frac(C.head[PZ], 0.64, 0.18, 0.18, 0.14, tan);
      a.frac(C.body[PZ], 0.2, 0.3, 0.6, 0.7, shadeHex(tan, 0.9)); // chest
    });
    const M = A.mat;
    this.root.add(this.body);
    this.body.scale.setScalar(DOG_SCALE);
    // the body group is what bobs; keep a wrapper so scaling doesn't fight the bob
    const Bd = new THREE.Group();
    this.body.add(Bd);
    Bd.add(mesh(box(A, DOG.body), M, 0, 0.54, 0));
    const legGeo = merged('dogleg', [box(A, DOG.leg, 0, -0.165, 0), box(A, DOG.paw, 0, -0.365, 0.015)]);
    for (const [x, z] of [
      [0.12, 0.28],
      [-0.12, 0.28],
      [0.12, -0.28],
      [-0.12, -0.28],
    ]) {
      const g = joint(Bd, x, 0.4, z);
      g.add(mesh(legGeo, M));
      this.legs.push(g);
    }
    this.head.position.set(0, 0.64, 0.38);
    Bd.add(this.head);
    const H = this.head;
    H.add(mesh(merged('doghead', [box(A, DOG.head, 0, 0.13, 0.08), box(A, DOG.snout, 0, 0.04, 0.29), box(A, DOG.collar, 0, -0.04, 0.02), box(A, DOG.tag, 0, -0.09, 0.14)]), M));
    this.jaw.position.set(0, -0.02, 0.22);
    this.jaw.add(mesh(box(A, DOG.jaw), M, 0, -0.025, 0.07));
    H.add(this.jaw);
    const eg = plane(0.06, 0.065);
    const em = eyeMat(0x5a3a22, 0x111111, false);
    for (const sx of [1, -1]) {
      const e = new THREE.Mesh(eg, em);
      e.position.set(0.085 * sx, 0.17, 0.2215);
      H.add(e);
      this.eyes.push(e);
      // floppy ear: pivot at the top of the head, flap hangs down the side
      const ear = mesh(box(A, DOG.ear, 0, -0.08, 0), M, 0.18 * sx, 0.26, 0.06);
      ear.rotation.z = 0.3 * sx;
      H.add(ear);
      this.ears.push(ear);
    }
    this.tail.position.set(0, 0.64, -0.39);
    this.tail.add(mesh(box(A, DOG.tail), M, 0, 0, -0.13));
    this.tail.rotation.x = 0.8;
    Bd.add(this.tail);
  }

  update(dt: number, st: { run: number; sleep: boolean; bark: boolean; sit?: boolean }) {
    this.t += dt;
    const t = this.t;
    if (st.run > 0.05) this.phase += dt * 14 * st.run;
    const s = Math.sin(this.phase) * 0.8 * Math.min(1, st.run);
    let y = 0;
    let hx = 0;
    this.legs[0].rotation.x = s;
    this.legs[3].rotation.x = s;
    this.legs[1].rotation.x = -s;
    this.legs[2].rotation.x = -s;
    this.tail.rotation.y = Math.sin(t * (st.bark ? 20 : 8)) * 0.5;
    this.tail.rotation.x = 0.8;
    this.jaw.rotation.x = 0;
    for (const e of this.eyes) e.scale.y = 1;
    if (st.sleep) {
      y = -0.27;
      this.legs[0].rotation.x = this.legs[1].rotation.x = -1.4;
      this.legs[2].rotation.x = this.legs[3].rotation.x = 1.4;
      hx = 0.3;
      this.tail.rotation.x = -0.1;
      this.tail.rotation.y = 0.9;
      for (const e of this.eyes) e.scale.y = 0.15;
    } else if (st.bark) {
      hx = -0.35 + Math.sin(t * 18) * 0.15;
      this.jaw.rotation.x = 0.3 + Math.sin(t * 18) * 0.3;
      y = Math.abs(Math.sin(t * 9)) * 0.05;
    }
    this.body.position.y = y + (st.run > 0.1 ? Math.abs(Math.sin(this.phase)) * 0.05 : 0);
    this.head.rotation.x = hx;
    for (let i = 0; i < 2; i++) this.ears[i].rotation.x = st.run > 0.3 ? -0.6 : 0;
  }
}

// ---------------- Birds (merpati, bebek; ayam ready via the same builder) ----------------
interface BirdOpts {
  key: string;
  body: number;
  wing: number;
  head: number;
  beak: number;
  legs: number;
  size: number;
  neckRing?: number;
  comb?: number;
  tailC?: number;
  duck?: boolean;
}
const BP = {
  body: { n: 'body', s: [0.46, 0.45, 0.62] } as Part,
  head: { n: 'head', s: [0.36, 0.36, 0.34] } as Part,
  beak: { n: 'beak', s: [0.14, 0.08, 0.16] } as Part,
  bill: { n: 'bill', s: [0.2, 0.07, 0.2] } as Part,
  leg: { n: 'leg', s: [0.05, 0.3, 0.05] } as Part,
  foot: { n: 'foot', s: [0.12, 0.03, 0.16] } as Part,
  wing: { n: 'wing', s: [0.06, 0.3, 0.44] } as Part,
  tail: { n: 'tail', s: [0.24, 0.1, 0.22] } as Part,
  ring: { n: 'ring', s: [0.38, 0.07, 0.36] } as Part,
  comb: { n: 'comb', s: [0.06, 0.14, 0.22] } as Part,
};

class BlockyBird {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  wingL = new THREE.Group();
  wingR = new THREE.Group();
  t = rand(0, 10);
  peckT = rand(0, 3);

  constructor(o: BirdOpts) {
    const A = speciesAtlas('bird:' + o.key, 256, 64, Object.values(BP), (a) => {
      const C = a.cells;
      a.paintBox(C.body, o.body);
      a.paintBox(C.head, o.head);
      a.paintBox(C.beak, o.beak);
      a.paintBox(C.bill, o.beak);
      a.paintBox(C.leg, o.legs);
      a.paintBox(C.foot, o.legs);
      a.paintBox(C.wing, o.wing);
      a.paintBox(C.tail, o.tailC ?? o.wing);
      a.paintBox(C.ring, o.neckRing ?? o.body);
      a.paintBox(C.comb, o.comb ?? o.head);
      // wing feather tips
      for (const f of [PX, NX]) a.frac(C.wing[f], f === PX ? 0 : 0.6, 0.7, 0.4, 0.3, shadeHex(o.wing, 0.8));
      // eyes: front (with shine) + a dot on each side, blush on the cheeks
      const F = C.head[PZ];
      for (const x of [0.16, 0.66]) {
        a.frac(F, x, 0.3, 0.18, 0.24, 0x1b1714);
        a.frac(F, x + 0.03, 0.33, 0.07, 0.07, 0xffffff);
      }
      a.frac(F, 0.06, 0.58, 0.16, 0.08, 'rgba(255,120,130,.4)');
      a.frac(F, 0.78, 0.58, 0.16, 0.08, 'rgba(255,120,130,.4)');
      for (const f of [PX, NX]) a.frac(C.head[f], f === PX ? 0.12 : 0.62, 0.3, 0.26, 0.24, 0x1b1714);
      a.frac(C.body[NZ], 0, 0, 1, 0.3, shadeHex(o.body, 0.9));
    });
    const M = A.mat;
    this.root.add(this.body);
    this.body.scale.setScalar(o.size);
    const parts = [box(A, BP.body, 0, 0.545, 0), box(A, BP.tail, 0, o.duck ? 0.78 : 0.66, -0.38, o.duck ? -0.5 : -0.2)];
    for (const s of [-1, 1]) parts.push(box(A, BP.leg, 0.11 * s, 0.17, 0.02), box(A, BP.foot, 0.11 * s, 0.015, 0.07));
    this.body.add(mesh(merged('birdbody:' + o.key, parts), M));
    // head pivot at the neck
    this.head.position.set(0, 0.74, 0.22);
    const hp = [box(A, BP.head, 0, 0.2, 0.08), o.duck ? box(A, BP.bill, 0, 0.13, 0.33) : box(A, BP.beak, 0, 0.16, 0.3)];
    if (o.neckRing !== undefined) hp.push(box(A, BP.ring, 0, 0.04, 0.08));
    if (o.comb !== undefined) hp.push(box(A, BP.comb, 0, 0.44, 0.06));
    this.head.add(mesh(merged('birdhead:' + o.key, hp), M));
    this.body.add(this.head);
    // wings: pivot at the shoulder, slab hangs at the side when folded
    for (const [g, sx] of [
      [this.wingL, 1],
      [this.wingR, -1],
    ] as [THREE.Group, number][]) {
      g.position.set(0.24 * sx, 0.72, 0);
      g.add(mesh(box(A, BP.wing), M, 0.02 * sx, -0.13, -0.03));
      this.body.add(g);
    }
  }

  update(dt: number, flying: boolean) {
    this.t += dt;
    if (flying) {
      const f = 1.25 + Math.sin(this.t * 24) * 0.75;
      this.wingL.rotation.z = f;
      this.wingR.rotation.z = -f;
      this.head.rotation.x = 0;
      this.body.rotation.z = 0;
    } else {
      this.wingL.rotation.z = 0.05;
      this.wingR.rotation.z = -0.05;
      this.peckT -= dt;
      if (this.peckT < 0) this.peckT = rand(0.8, 3);
      this.head.rotation.x = this.peckT < 0.25 ? 0.9 : 0;
    }
  }
}

export class PigeonModel extends BlockyBird {
  constructor() {
    super({ key: 'merpati', body: 0x9aa3b5, wing: 0x7d8699, head: 0x8a93a6, beak: 0x50525a, legs: 0xe57373, neckRing: 0x5fa38a, size: 0.27 });
  }
}

// Small white (or brown) duck for the river flock (same interface as PigeonModel).
export class DuckModel extends BlockyBird {
  constructor(color = 0xfafafa) {
    const white = color === 0xfafafa;
    super({ key: 'bebek:' + color, body: color, wing: white ? 0xe6e6e6 : shadeHex(color, 0.85), head: white ? color : 0x3d7a4a, beak: 0xff9800, legs: 0xff9800, size: 0.4, duck: true, neckRing: white ? undefined : 0xfafafa });
  }
  update(dt: number, flying: boolean) {
    super.update(dt, flying);
    if (!flying) this.body.rotation.z = Math.sin(this.t * 6) * 0.06;
  }
}

/** Ayam (chicken): not placed in the world yet, but built with the same rig for future drops. */
export class ChickenModel extends BlockyBird {
  constructor() {
    super({ key: 'ayam', body: 0xb5482f, wing: 0x7a2e1c, head: 0xd96b2b, beak: 0xf2b134, legs: 0xf2b134, comb: 0xe53935, tailC: 0x1f5f3a, size: 0.5 });
  }
}

// test hook (test/animals.mjs builds a lineup next to a Blocky person)
import { CatModel } from './catModel';
import { buildBlocky } from './blocky';
import { ITEMS } from '../cosmetics';
(globalThis as any).__catModels = { THREE, ITEMS, CatModel, DogModel, PigeonModel, DuckModel, ChickenModel, buildBlocky };
