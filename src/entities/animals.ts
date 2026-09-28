import * as THREE from 'three';
import { boxGeo, lam } from '../world/builder';
import { rand } from '../ctx';

function B(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), lam(color));
  m.position.set(x, y, z);
  return m;
}

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
    const brown = 0xa8693a, light = 0xf3e2c8, dark = 0x5a3419;
    this.root.add(this.body);
    const Bd = this.body;
    Bd.add(B(0.44, 0.38, 0.84, brown, 0, 0.6, 0));
    Bd.add(B(0.3, 0.24, 0.1, light, 0, 0.58, 0.42));
    for (const [x, z] of [
      [0.15, 0.3],
      [-0.15, 0.3],
      [0.15, -0.3],
      [-0.15, -0.3],
    ]) {
      const g = new THREE.Group();
      g.position.set(x, 0.45, z);
      g.add(B(0.14, 0.38, 0.14, brown, 0, -0.19, 0));
      g.add(B(0.15, 0.08, 0.18, light, 0, -0.41, 0.02));
      Bd.add(g);
      this.legs.push(g);
    }
    this.head.position.set(0, 0.78, 0.44);
    Bd.add(this.head);
    const H = this.head;
    H.add(B(0.4, 0.36, 0.36, brown, 0, 0.08, 0.1));
    H.add(B(0.24, 0.12, 0.22, light, 0, 0.0, 0.36));
    H.add(B(0.1, 0.07, 0.05, 0x1a1a1a, 0, 0.07, 0.47));
    this.jaw.position.set(0, -0.06, 0.26);
    this.jaw.add(B(0.2, 0.06, 0.2, light, 0, -0.03, 0.08));
    this.jaw.add(B(0.1, 0.02, 0.12, 0xf06b8a, 0, 0.01, 0.1));
    H.add(this.jaw);
    for (const sx of [1, -1]) {
      const e = B(0.06, 0.07, 0.02, 0x1a1a1a, 0.1 * sx, 0.16, 0.285);
      H.add(e);
      this.eyes.push(e);
      const ear = B(0.08, 0.26, 0.18, dark, 0.23 * sx, 0.06, 0.06);
      H.add(ear);
      this.ears.push(ear);
    }
    H.add(B(0.3, 0.05, 0.05, 0xe53935, 0, -0.1, 0.12));
    this.tail.position.set(0, 0.72, -0.42);
    this.tail.add(B(0.08, 0.08, 0.3, brown, 0, 0, -0.14));
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
      y = -0.3;
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

export class PigeonModel {
  root = new THREE.Group();
  body = new THREE.Group();
  head = new THREE.Group();
  wingL = new THREE.Group();
  wingR = new THREE.Group();
  t = rand(0, 10);
  peckT = rand(0, 3);

  constructor() {
    const grey = 0x9097a8, dark = 0x5d6373;
    this.root.add(this.body);
    this.body.add(B(0.18, 0.16, 0.3, grey, 0, 0.16, 0));
    this.body.add(B(0.14, 0.04, 0.14, dark, 0, 0.15, -0.2));
    this.body.add(B(0.02, 0.08, 0.02, 0xe57373, 0.05, 0.04, 0));
    this.body.add(B(0.02, 0.08, 0.02, 0xe57373, -0.05, 0.04, 0));
    this.head.position.set(0, 0.26, 0.12);
    this.head.add(B(0.12, 0.12, 0.12, grey, 0, 0.04, 0.02));
    this.head.add(B(0.13, 0.05, 0.1, 0x5bb08a, 0, -0.03, 0.0));
    this.head.add(B(0.04, 0.03, 0.06, 0xf0c05a, 0, 0.03, 0.1));
    this.head.add(B(0.02, 0.02, 0.01, 0xff8a00, 0.05, 0.06, 0.07));
    this.head.add(B(0.02, 0.02, 0.01, 0xff8a00, -0.05, 0.06, 0.07));
    this.body.add(this.head);
    for (const [g, sx] of [
      [this.wingL, 1],
      [this.wingR, -1],
    ] as [THREE.Group, number][]) {
      g.position.set(0.09 * sx, 0.22, 0);
      g.add(B(0.2, 0.03, 0.24, dark, 0.1 * sx, 0, -0.02));
      this.body.add(g);
    }
    this.wingL.rotation.z = -1.4;
    this.wingR.rotation.z = 1.4;
  }

  update(dt: number, flying: boolean) {
    this.t += dt;
    if (flying) {
      const f = Math.sin(this.t * 28) * 0.9;
      this.wingL.rotation.z = f;
      this.wingR.rotation.z = -f;
      this.head.rotation.x = 0;
    } else {
      this.wingL.rotation.z = -1.4;
      this.wingR.rotation.z = 1.4;
      this.peckT -= dt;
      if (this.peckT < 0) {
        this.peckT = rand(0.8, 3);
      }
      this.head.rotation.x = this.peckT < 0.25 ? 0.9 : 0;
    }
  }
}
