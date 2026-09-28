import * as THREE from 'three';
import { boxGeo, lam } from '../world/builder';
import { shade } from './catModel';

function B(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(boxGeo(w, h, d), lam(color));
  m.position.set(x, y, z);
  return m;
}

export interface HumanOpts {
  skin: number;
  shirt: number;
  pants: number;
  shoes?: number;
  hair: 'short' | 'long' | 'hijab' | 'cap' | 'bun' | 'peci';
  hairColor?: number;
  hijabColor?: number;
  kid?: boolean;
  prop?: 'sapu' | 'tas' | 'none';
  apron?: number;
  towel?: boolean;
  mustache?: boolean;
  skirt?: boolean;
}

export type HumanPose = 'idle' | 'walk' | 'sweep' | 'shoo' | 'surprised' | 'hug' | 'wave' | 'laugh' | 'point' | 'carry';

export class HumanModel {
  root = new THREE.Group();
  inner = new THREE.Group();
  legL = new THREE.Group();
  legR = new THREE.Group();
  armL = new THREE.Group();
  armR = new THREE.Group();
  head = new THREE.Group();
  hand = new THREE.Group(); // right hand slot
  holdSlot = new THREE.Group(); // in front of chest (hug / carry)
  mouths: Record<string, THREE.Object3D> = {};
  broom: THREE.Group | null = null;
  phase = 0;
  t = Math.random() * 10;
  mouth = 'smile';
  kid: boolean;
  height: number;

  constructor(o: HumanOpts) {
    this.kid = !!o.kid;
    this.root.add(this.inner);
    const I = this.inner;
    const shoes = o.shoes ?? 0x3a3a3a;
    // legs
    for (const [g, sx] of [
      [this.legL, 1],
      [this.legR, -1],
    ] as [THREE.Group, number][]) {
      g.position.set(0.17 * sx, 0.9, 0);
      g.add(B(0.28, 0.76, 0.3, o.pants, 0, -0.38, 0));
      g.add(B(0.3, 0.16, 0.38, shoes, 0, -0.82, 0.04));
      I.add(g);
    }
    // torso
    I.add(B(0.72, 0.8, 0.38, o.shirt, 0, 1.3, 0));
    if (o.skirt) I.add(B(0.78, 0.5, 0.44, o.pants, 0, 0.72, 0));
    if (o.apron) {
      I.add(B(0.6, 0.9, 0.04, o.apron, 0, 1.1, 0.21));
      I.add(B(0.74, 0.06, 0.4, o.apron, 0, 1.36, 0));
    }
    if (o.towel) {
      I.add(B(0.26, 0.08, 0.42, 0xf2f2f2, 0.24, 1.72, 0));
      I.add(B(0.26, 0.4, 0.06, 0xf2f2f2, 0.24, 1.5, 0.21));
      I.add(B(0.26, 0.04, 0.07, 0xe24a4a, 0.24, 1.38, 0.21));
    }
    // arms
    for (const [g, sx] of [
      [this.armL, 1],
      [this.armR, -1],
    ] as [THREE.Group, number][]) {
      g.position.set(0.5 * sx, 1.64, 0);
      g.add(B(0.27, 0.34, 0.3, o.shirt, 0, -0.14, 0));
      g.add(B(0.24, 0.48, 0.26, o.skin, 0, -0.52, 0));
      I.add(g);
    }
    this.hand.position.set(0, -0.78, 0.02);
    this.armR.add(this.hand);
    this.holdSlot.position.set(0, 1.3, 0.55);
    I.add(this.holdSlot);

    // head
    this.head.position.set(0, 1.7, 0);
    I.add(this.head);
    const H = this.head;
    const hs = o.kid ? 1.15 : 1;
    H.scale.set(hs, hs, hs);
    H.add(B(0.56, 0.56, 0.52, o.skin, 0, 0.3, 0));
    H.add(B(0.22, 0.1, 0.52, o.skin, 0, 0.02, 0)); // neck
    // face
    for (const sx of [1, -1]) {
      H.add(B(0.07, 0.11, 0.02, 0x1d1d24, 0.12 * sx, 0.36, 0.265));
      H.add(B(0.025, 0.025, 0.01, 0xffffff, 0.12 * sx + 0.015, 0.39, 0.275));
      H.add(B(0.1, 0.03, 0.02, shade(o.hairColor ?? 0x2a1c14, 1), 0.12 * sx, 0.46, 0.265));
      H.add(B(0.07, 0.04, 0.012, 0xf29b9b, 0.19 * sx, 0.26, 0.262));
    }
    H.add(B(0.07, 0.07, 0.04, shade(o.skin, 0.9), 0, 0.3, 0.27));
    // mouths
    const sm = new THREE.Group();
    sm.add(B(0.12, 0.03, 0.02, 0x7a2a2a, 0, 0.18, 0.265));
    sm.add(B(0.03, 0.03, 0.02, 0x7a2a2a, 0.07, 0.2, 0.265));
    sm.add(B(0.03, 0.03, 0.02, 0x7a2a2a, -0.07, 0.2, 0.265));
    const om = B(0.09, 0.11, 0.02, 0x5a1a1a, 0, 0.17, 0.265);
    const gr = new THREE.Group();
    gr.add(B(0.2, 0.08, 0.02, 0x5a1a1a, 0, 0.18, 0.265));
    gr.add(B(0.16, 0.03, 0.01, 0xffffff, 0, 0.205, 0.272));
    const fl = new THREE.Group();
    fl.add(B(0.14, 0.03, 0.02, 0x7a2a2a, 0, 0.17, 0.265));
    fl.add(B(0.03, 0.03, 0.02, 0x7a2a2a, 0.08, 0.15, 0.265));
    fl.add(B(0.03, 0.03, 0.02, 0x7a2a2a, -0.08, 0.15, 0.265));
    this.mouths = { smile: sm, o: om, grin: gr, frown: fl };
    for (const k of Object.keys(this.mouths)) {
      H.add(this.mouths[k]);
      this.mouths[k].visible = k === 'smile';
    }
    if (o.mustache) H.add(B(0.2, 0.04, 0.03, 0x2a1c14, 0, 0.23, 0.27));
    // hair
    const hc = o.hairColor ?? 0x2a1c14;
    switch (o.hair) {
      case 'short':
        H.add(B(0.6, 0.12, 0.56, hc, 0, 0.6, 0));
        H.add(B(0.6, 0.36, 0.1, hc, 0, 0.42, -0.24));
        H.add(B(0.06, 0.22, 0.46, hc, 0.29, 0.48, -0.02));
        H.add(B(0.06, 0.22, 0.46, hc, -0.29, 0.48, -0.02));
        break;
      case 'long':
      case 'bun':
        H.add(B(0.6, 0.12, 0.56, hc, 0, 0.6, 0));
        H.add(B(0.6, o.hair === 'long' ? 0.7 : 0.4, 0.1, hc, 0, o.hair === 'long' ? 0.25 : 0.42, -0.24));
        H.add(B(0.06, o.hair === 'long' ? 0.5 : 0.24, 0.46, hc, 0.29, o.hair === 'long' ? 0.36 : 0.48, -0.02));
        H.add(B(0.06, o.hair === 'long' ? 0.5 : 0.24, 0.46, hc, -0.29, o.hair === 'long' ? 0.36 : 0.48, -0.02));
        H.add(B(0.56, 0.08, 0.06, hc, 0, 0.56, 0.24));
        if (o.hair === 'bun') H.add(B(0.24, 0.2, 0.22, hc, 0, 0.72, -0.18));
        break;
      case 'hijab': {
        const c = o.hijabColor ?? 0x7b61c9;
        H.add(B(0.64, 0.14, 0.6, c, 0, 0.6, 0));
        H.add(B(0.64, 0.64, 0.1, c, 0, 0.32, -0.27));
        H.add(B(0.08, 0.6, 0.56, c, 0.31, 0.32, 0));
        H.add(B(0.08, 0.6, 0.56, c, -0.31, 0.32, 0));
        H.add(B(0.64, 0.08, 0.06, c, 0, 0.55, 0.27));
        H.add(B(0.62, 0.16, 0.08, c, 0, 0.04, 0.27));
        H.add(B(0.86, 0.32, 0.5, c, 0, -0.08, -0.01));
        break;
      }
      case 'cap': {
        H.add(B(0.6, 0.16, 0.56, o.hijabColor ?? 0xe53935, 0, 0.62, 0));
        H.add(B(0.5, 0.04, 0.26, o.hijabColor ?? 0xe53935, 0, 0.56, 0.36));
        H.add(B(0.6, 0.24, 0.1, hc, 0, 0.44, -0.24));
        break;
      }
      case 'peci':
        H.add(B(0.6, 0.2, 0.56, 0x1b1b1b, 0, 0.64, 0));
        H.add(B(0.6, 0.2, 0.1, hc, 0, 0.44, -0.24));
        break;
    }
    // props
    if (o.prop === 'sapu') {
      const b = new THREE.Group();
      b.add(B(0.05, 1.3, 0.05, 0xc49a5a, 0, -0.4, 0));
      b.add(B(0.34, 0.3, 0.1, 0xd9b36a, 0, -1.1, 0));
      b.add(B(0.36, 0.06, 0.12, 0x8a5a2b, 0, -0.95, 0));
      b.rotation.x = 0.4;
      this.hand.add(b);
      this.broom = b;
    } else if (o.prop === 'tas') {
      const bag = new THREE.Group();
      bag.add(B(0.14, 0.34, 0.36, 0xb5473a, 0, -0.2, 0));
      bag.add(B(0.04, 0.24, 0.04, 0x7a2e24, 0, 0.02, 0));
      this.armL.add(bag);
      bag.position.set(0.16, -0.62, 0);
    }
    const sc = o.kid ? 0.62 : 1;
    this.inner.scale.set(sc, sc, sc);
    this.height = 2.3 * sc;
  }

  setMouth(m: string) {
    if (this.mouth === m) return;
    this.mouth = m;
    for (const k of Object.keys(this.mouths)) this.mouths[k].visible = k === m;
  }

  update(dt: number, pose: HumanPose, speed = 1) {
    this.t += dt;
    const t = this.t;
    let la = 0, ra = 0, laz = 0, raz = 0, ll = 0, lr = 0, hy = 0, hx = 0, bob = 0, rot = 0;
    if (pose === 'walk') {
      this.phase += dt * 7 * speed;
      const s = Math.sin(this.phase);
      ll = s * 0.6;
      lr = -s * 0.6;
      la = -s * 0.5;
      ra = s * 0.5;
      bob = Math.abs(Math.cos(this.phase)) * 0.05;
    } else if (pose === 'idle') {
      la = Math.sin(t * 1.5) * 0.04;
      ra = -la;
      hy = Math.sin(t * 0.5) * 0.2;
    } else if (pose === 'sweep') {
      ra = -0.5;
      raz = Math.sin(t * 3) * 0.35;
      la = -0.4;
      laz = -0.2 + Math.sin(t * 3) * 0.2;
      hx = 0.25;
      rot = Math.sin(t * 3) * 0.1;
    } else if (pose === 'shoo') {
      this.phase += dt * 9 * speed;
      const s = Math.sin(this.phase);
      ll = s * 0.6;
      lr = -s * 0.6;
      ra = -2.5 + Math.sin(t * 16) * 0.6;
      la = -2.2 + Math.cos(t * 16) * 0.5;
      bob = Math.abs(Math.cos(this.phase)) * 0.06;
    } else if (pose === 'surprised') {
      ra = -2.9;
      la = -2.9;
      raz = 0.3;
      laz = -0.3;
      hx = -0.15;
    } else if (pose === 'hug') {
      ra = -1.35;
      la = -1.35;
      raz = 0.35;
      laz = -0.35;
      hy = Math.sin(t * 3) * 0.15;
    } else if (pose === 'carry') {
      ra = -1.1;
      la = -1.1;
      raz = 0.25;
      laz = -0.25;
      this.phase += dt * 7 * speed;
      const s = Math.sin(this.phase);
      ll = s * 0.6;
      lr = -s * 0.6;
    } else if (pose === 'wave') {
      ra = -2.7;
      raz = Math.sin(t * 10) * 0.35;
      la = Math.sin(t * 1.5) * 0.05;
    } else if (pose === 'laugh') {
      la = -0.3;
      ra = -0.3;
      laz = -0.4;
      raz = 0.4;
      hx = -0.2 + Math.sin(t * 20) * 0.05;
      bob = Math.abs(Math.sin(t * 12)) * 0.04;
    } else if (pose === 'point') {
      ra = -1.6 + Math.sin(t * 12) * 0.15;
      la = -0.2;
      laz = -0.5;
      hx = Math.sin(t * 12) * 0.05;
    }
    this.armL.rotation.set(la, 0, laz);
    this.armR.rotation.set(ra, 0, raz);
    this.legL.rotation.x = ll;
    this.legR.rotation.x = lr;
    this.head.rotation.set(hx, hy, 0);
    this.inner.position.y = bob;
    this.inner.rotation.y = rot;
    if (this.broom) this.broom.rotation.x = pose === 'sweep' ? 0.9 : pose === 'shoo' ? 0.3 + Math.sin(t * 16) * 0.5 : 0.4;
  }
}
