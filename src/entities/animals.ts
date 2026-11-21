import * as THREE from 'three';
import { rand } from '../ctx';
import { Atlas, uvBox, merged, mesh, joint, ANIMAL_SCALE, faceCanvas, paintPart, shadeHex, PY, type Faces } from './blockyAnimal';

// Animals exactly as in the APPROVED MOCKUP (scratch/lowpoly/chars/animals_part.ts): the same
// cuboid sizes, pivots, colours and 128 px painted faces. Built in mockup units; the mockup's
// per-animal size is multiplied by ANIMAL_SCALE (mockup adult 1.69 m → game adult 2.0 m).
// Each animal paints all its parts into one atlas → one material, a few meshes.

const atlasCache = new Map<string, Atlas>();
function speciesAtlas(key: string, build: (a: Atlas) => void) {
  let a = atlasCache.get(key);
  if (!a) {
    a = new Atlas(256, 64);
    build(a);
    a.done();
    atlasCache.set(key, a);
  }
  return a;
}
/** mockup eye spot on a 128 px face (x 64±gap, y eyeY, 18×22 px) → head-local position */
function eyeSpot(w: number, h: number, cy: number, front: number, sx: number, gap = 26, eyeY = 50) {
  return new THREE.Vector3(((gap * sx) / 128) * w, cy + h / 2 - ((eyeY + 11) / 128) * h, front + 0.0015);
}

// ---------------- Dog (Bleki) = mockup quadruped({ body 0x2b2a30, paw/muzzle 0xa1887f, tongue,
// floppy ears 0x1d1c22, dog tail, size 0.82, long 1.15, collar 0x1e88e5 }) ----------------
const DOG_S = 0.82;
const DOG_LEN = 0.9 * 1.15;

export class DogModel {
  root = new THREE.Group();
  /** bobbing group (update() writes body.position.y in metres) */
  body = new THREE.Group();
  head = new THREE.Group();
  jaw = new THREE.Group();
  legs: THREE.Group[] = [];
  tail = new THREE.Group();
  ears: THREE.Object3D[] = [];
  /** eyelids: hidden while awake (the eyes are painted on the face like the mockup) */
  eyes: THREE.Mesh[] = [];
  phase = 0;
  t = 0;

  constructor() {
    const blk = 0x2b2a30, tan = 0xa1887f, earC = 0x1d1c22, collar = 0x1e88e5;
    const A = speciesAtlas('dog', (a) => {
      const C = {
        body: a.boxPx('body', 8),
        leg: a.boxPx('leg', 4),
        paw: a.boxPx('paw', 4),
        head: a.boxPx('head', 4, 128),
        ear: a.boxPx('ear', 4),
        collar: a.boxPx('collar', 4),
        tag: a.boxPx('tag', 4),
        tail: a.boxPx('tail', 4),
        jaw: a.boxPx('jaw', 8),
      };
      paintPart(a, C.body, blk);
      paintPart(a, C.leg, blk);
      paintPart(a, C.paw, tan);
      paintPart(a, C.head, blk, faceCanvas(blk, { eye: 0x2b2118, nose: 0x111111, tongue: true }, tan));
      paintPart(a, C.ear, earC);
      paintPart(a, C.collar, collar);
      paintPart(a, C.tag, 0xfdd835);
      paintPart(a, C.tail, blk);
      paintPart(a, C.jaw, tan);
      a.frac(C.jaw[PY], 0.25, 0.1, 0.5, 0.8, 0xef7a85); // tongue on top of the open jaw
    });
    const C = A.cells as Record<string, Faces>, M = A.mat;
    this.root.add(this.body);
    const S = new THREE.Group(); // mockup units
    S.scale.setScalar(DOG_S * ANIMAL_SCALE);
    this.body.add(S);
    S.add(mesh(uvBox(A, C.body, 0.62, 0.5, DOG_LEN), M, 0, 0.62, 0));
    const legGeo = merged('mockdog-leg', [uvBox(A, C.leg, 0.18, 0.45, 0.18, 0, -0.225, 0), uvBox(A, C.paw, 0.2, 0.08, 0.22, 0, -0.41, 0.01)]);
    for (const [x, z] of [
      [0.2, DOG_LEN / 2 - 0.12],
      [-0.2, DOG_LEN / 2 - 0.12],
      [0.2, -DOG_LEN / 2 + 0.12],
      [-0.2, -DOG_LEN / 2 + 0.12],
    ]) {
      const g = joint(S, x, 0.45, z);
      g.add(mesh(legGeo, M));
      this.legs.push(g);
    }
    // head: pivot at the neck
    this.head.position.set(0, 0.78, DOG_LEN / 2 - 0.02);
    S.add(this.head);
    const H = this.head;
    H.add(mesh(merged('mockdog-head', [uvBox(A, C.head, 0.62, 0.56, 0.5, 0, 0.16, 0.2), uvBox(A, C.collar, 0.64, 0.07, 0.3, 0, -0.12, 0.12), uvBox(A, C.tag, 0.07, 0.07, 0.03, 0, -0.19, 0.28)]), M));
    // floppy ears (mockup: 0.08×0.26×0.16 centred at ±0.34, 0.28, 0.18, tilted 0.5); the pivot sits
    // at the ear's top end so it can flap back while running
    for (const sx of [1, -1]) {
      const e = joint(H, 0.34 * sx - Math.sin(0.5) * 0.13 * sx, 0.28 + Math.cos(0.5) * 0.13, 0.18);
      e.rotation.z = 0.5 * sx;
      e.add(mesh(uvBox(A, C.ear, 0.08, 0.26, 0.16), M, 0, -0.13, 0));
      this.ears.push(e);
    }
    // jaw: tucked inside the head at rest (the dog looks exactly like the mockup); drops when barking
    this.jaw.position.set(0, -0.06, 0.44);
    this.jaw.add(mesh(uvBox(A, C.jaw, 0.34, 0.06, 0.22), M, 0, -0.03, -0.1));
    H.add(this.jaw);
    // tail: pivot at the rump (mockup: 0.1×0.1×0.34 at (0, 0.12, -0.14), rot -0.9). update() sets
    // tail.rotation.x = 0.8 at rest, so an inner group counter-rotates by -0.8.
    this.tail.position.set(0, 0.78, -DOG_LEN / 2);
    const tg = new THREE.Group();
    tg.rotation.x = -0.8;
    this.tail.add(tg);
    const tm = mesh(uvBox(A, C.tail, 0.1, 0.1, 0.34), M, 0, 0.12, -0.14);
    tm.rotation.x = -0.9;
    tg.add(tm);
    S.add(this.tail);
    const lid = new THREE.MeshLambertMaterial({ color: blk });
    const lg = new THREE.PlaneGeometry((20 / 128) * 0.62, (24 / 128) * 0.56);
    for (const sx of [1, -1]) {
      const e = new THREE.Mesh(lg, lid);
      e.position.copy(eyeSpot(0.62, 0.56, 0.16, 0.45, sx));
      e.visible = false;
      H.add(e);
      this.eyes.push(e);
    }
    this.root.traverse((o) => ((o as any).isMesh ? ((o as THREE.Mesh).castShadow = true) : 0));
    // the bark bubble (y 1.4) was placed for the previous 0.9 m dog; this one is 1.18 m to the ear tops
    this.root.userData.bubbleLift = 0.28;
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
    for (const e of this.eyes) e.visible = false;
    if (st.sleep) {
      y = -0.3;
      this.legs[0].rotation.x = this.legs[1].rotation.x = -1.4;
      this.legs[2].rotation.x = this.legs[3].rotation.x = 1.4;
      hx = 0.3;
      this.tail.rotation.x = -0.1;
      this.tail.rotation.y = 0.9;
      for (const e of this.eyes) e.visible = true;
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

// ---------------- Birds = mockup bird() ----------------
interface BirdOpts {
  key: string;
  body: number;
  wing: number;
  head: number;
  beak: number;
  legs: number;
  size: number;
  comb?: number;
  tailC?: number;
  long?: boolean;
  neckRing?: number;
  tall?: boolean;
}

class BlockyBird {
  root = new THREE.Group();
  /** bobbing/tilting group */
  body = new THREE.Group();
  head = new THREE.Group();
  wingL = new THREE.Group();
  wingR = new THREE.Group();
  t = rand(0, 10);
  peckT = rand(0, 3);

  constructor(o: BirdOpts) {
    const bh = o.tall ? 0.55 : 0.45;
    const A = speciesAtlas('bird:' + o.key, (a) => {
      const C = {
        body: a.boxPx('body', 4),
        leg: a.boxPx('leg', 4),
        foot: a.boxPx('foot', 4),
        wing: a.boxPx('wing', 4),
        head: a.boxPx('head', 4, 128),
        beak: a.boxPx('beak', 4),
        comb: a.boxPx('comb', 4),
        ring: a.boxPx('ring', 4),
        tail: a.boxPx('tail', 4),
      };
      paintPart(a, C.body, o.body);
      paintPart(a, C.leg, o.legs);
      paintPart(a, C.foot, o.legs);
      paintPart(a, C.wing, o.wing);
      paintPart(a, C.head, o.head, faceCanvas(o.head, { eyeY: 46, eyeGap: 30, blush: true }));
      paintPart(a, C.beak, o.beak);
      paintPart(a, C.comb, o.comb ?? o.head);
      paintPart(a, C.ring, o.neckRing ?? o.head);
      paintPart(a, C.tail, o.tailC ?? o.body);
    });
    const C = A.cells as Record<string, Faces>, M = A.mat;
    this.root.add(this.body);
    const S = new THREE.Group();
    S.scale.setScalar(o.size * ANIMAL_SCALE);
    this.body.add(S);
    const lt = o.long;
    const parts = [
      uvBox(A, C.body, 0.46, bh, 0.62, 0, 0.42 + bh / 2 - 0.1, 0),
      // tail joint (0, 0.62, -0.31) + the mockup part offset/rotation
      uvBox(A, C.tail, lt ? 0.3 : 0.22, lt ? 0.34 : 0.1, 0.22, 0, 0.62 + (lt ? 0.16 : 0.02), -0.31 - 0.08, lt ? -0.6 : -0.2),
    ];
    // legs stay rigid (the flock never animated them): joint (±0.11, 0.32, 0.02) + offsets
    for (const s of [-1, 1]) parts.push(uvBox(A, C.leg, 0.05, 0.3, 0.05, 0.11 * s, 0.32 - 0.15, 0.02), uvBox(A, C.foot, 0.12, 0.03, 0.16, 0.11 * s, 0.32 - 0.3, 0.07));
    S.add(mesh(merged('mockbird-body:' + o.key, parts), M));
    this.head.position.set(0, 0.72 + (o.tall ? 0.08 : 0), 0.22);
    const hp = [uvBox(A, C.head, 0.36, 0.36, 0.34, 0, 0.2, 0.08), uvBox(A, C.beak, 0.14, 0.08, 0.14, 0, 0.16, 0.3)];
    if (o.comb !== undefined) hp.push(uvBox(A, C.comb, 0.06, 0.14, 0.22, 0, 0.44, 0.06), uvBox(A, C.comb, 0.06, 0.1, 0.06, 0, 0.06, 0.3));
    if (o.neckRing !== undefined) hp.push(uvBox(A, C.ring, 0.38, 0.06, 0.36, 0, 0.02, 0.08));
    this.head.add(mesh(merged('mockbird-head:' + o.key, hp), M));
    S.add(this.head);
    for (const [g, sx] of [
      [this.wingL, 1],
      [this.wingR, -1],
    ] as [THREE.Group, number][]) {
      g.position.set(0.24 * sx, 0.72, 0);
      g.add(mesh(uvBox(A, C.wing, 0.06, 0.3, 0.44), M, 0.02 * sx, -0.12, -0.02));
      S.add(g);
    }
    this.root.traverse((m) => ((m as any).isMesh ? ((m as THREE.Mesh).castShadow = true) : 0));
  }

  update(dt: number, flying: boolean) {
    this.t += dt;
    if (flying) {
      // wings swing from folded (mockup pose) up past horizontal and back
      const f = 1.2 + Math.sin(this.t * 24) * 0.9;
      this.wingL.rotation.z = f;
      this.wingR.rotation.z = -f;
      this.head.rotation.x = 0;
    } else {
      this.wingL.rotation.z = 0;
      this.wingR.rotation.z = 0;
      this.peckT -= dt;
      if (this.peckT < 0) this.peckT = rand(0.8, 3);
      this.head.rotation.x = this.peckT < 0.25 ? 0.9 : 0;
    }
  }
}

/** mockup 'Merpati' */
export class PigeonModel extends BlockyBird {
  constructor() {
    super({ key: 'merpati', body: 0x9aa3b5, wing: 0x7d8699, head: 0x8a93a6, beak: 0x50525a, legs: 0xe57373, neckRing: 0x5fa38a, size: 0.27 }); // real pigeon ~0.35 m (mockup 0.5 → 0.65 m)
  }
}

/** mockup 'Bebek' (white). The river flock also has brown ducks: the same recipe in that colour. */
export class DuckModel extends BlockyBird {
  constructor(color = 0xfafafa) {
    const white = color === 0xfafafa;
    super({ key: 'bebek:' + color, body: color, wing: white ? 0xe6e6e6 : shadeHex(color, 0.85), head: color, beak: 0xff9800, legs: 0xff9800, size: 0.385 }); // real duck ~0.5 m (mockup 0.66 → 0.86 m)
  }
  update(dt: number, flying: boolean) {
    super.update(dt, flying);
    this.body.rotation.z = flying ? 0 : Math.sin(this.t * 6) * 0.06;
  }
}

/** mockup 'Ayam jago' (+ hens): the chicken flock in the west neighbour's front yard */
export class ChickenModel extends BlockyBird {
  constructor(kind: 'jago' | 'betina' | 'betinaPutih' = 'jago') {
    if (kind === 'jago') super({ key: 'ayam', body: 0xb5482f, wing: 0x7a2e1c, head: 0xd96b2b, beak: 0xf2b134, legs: 0xf2b134, comb: 0xe53935, tailC: 0x1f5f3a, long: true, size: 0.39, tall: true }); // real rooster ~0.6 m (mockup 0.72 → 1.11 m)
    // hens: same mockup recipe, small comb, short tail, a little smaller (~0.45 m)
    else if (kind === 'betina') super({ key: 'ayam-betina', body: 0xa86b3c, wing: 0x7d4a26, head: 0xb87a45, beak: 0xf2b134, legs: 0xf2b134, comb: 0xe53935, tailC: 0x6e4122, size: 0.32 });
    else super({ key: 'ayam-putih', body: 0xf3efe6, wing: 0xddd6c8, head: 0xf3efe6, beak: 0xf2b134, legs: 0xf2b134, comb: 0xe53935, size: 0.32 });
  }
}

// test hook (test/animals.mjs builds a lineup next to a Blocky person)
import { CatModel } from './catModel';
import { buildBlocky } from './blocky';
import { ITEMS } from '../cosmetics';
(globalThis as any).__catModels = { THREE, ITEMS, CatModel, DogModel, PigeonModel, DuckModel, ChickenModel, buildBlocky };
