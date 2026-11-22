// People: Kenney "Blocky Characters" rig (CC0, kenney.nl) dressed in Indonesian outfits (see blocky.ts).
// Same public API as the old box people: root / holdSlot / hand / height, setMouth, setUmbrella and
// the procedural poses (idle, walk, sweep, shoo, surprised, hug, wave, laugh, point, carry).
// Rule: anyone wearing a kerudung has long sleeves and a long bottom (checked in the constructor).
import * as THREE from 'three';
import { buildBlocky, hex, type BlockyNodes, type Outfit } from './blocky';
import { lam } from '../world/builder';
import { shade } from './catModel';

export type HumanOpts = Outfit;
export type HumanPose = 'idle' | 'walk' | 'sweep' | 'shoo' | 'surprised' | 'hug' | 'wave' | 'laugh' | 'point' | 'carry';

/** Kenney rig is 2.73 units tall; adult x0.62 = ~1.7 m, kid x0.5 = ~1.37 m (one global human scale). */
export const RAW_H = 2.73;
export const ADULT_SCALE = 0.62;
export const KID_SCALE = 0.5;
const LONG_BOTTOM: Outfit['bottom'][] = ['gamis', 'daster', 'sarung', 'kain'];
const KERUDUNG: Outfit['head'][] = ['pashmina', 'bergo', 'kerudungAnak'];

function B(w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), lam(color));
  m.position.set(x, y, z);
  return m;
}

export class HumanModel {
  root = new THREE.Group();
  /** scaled container (Kenney units inside) */
  inner = new THREE.Group();
  n: BlockyNodes;
  legL: THREE.Object3D;
  legR: THREE.Object3D;
  armL: THREE.Object3D;
  armR: THREE.Object3D;
  head: THREE.Object3D;
  hand = new THREE.Group(); // right hand slot
  holdSlot = new THREE.Group(); // in front of the chest (hug / carry)
  broom: THREE.Object3D | null = null;
  phase = 0;
  t = Math.random() * 10;
  mouth = 'smile';
  kid: boolean;
  height: number;
  o: Outfit;
  /** step swing: long garments take shorter steps so the legs stay inside the skirt */
  step: number;
  umbrella: THREE.Group | null = null;

  constructor(o: Outfit) {
    if (KERUDUNG.includes(o.head) && (!o.long || o.bottom === 'pendek')) throw new Error('kerudung needs long sleeves + long bottom');
    this.o = o;
    this.kid = !!o.kid;
    this.root.add(this.inner);
    const n = buildBlocky(o);
    this.n = n;
    this.inner.add(n.root);
    this.legL = n.legL;
    this.legR = n.legR;
    this.armL = n.armL;
    this.armR = n.armR;
    this.head = n.head;
    if (o.prop === 'sapuLidi') this.broom = n.armR.children.find((c) => (c as THREE.Group).isGroup) ?? null;
    if (this.broom) {
      // the sapu lidi is ~1.5 rig units from the grip; shorten it and lean it forward so the
      // bristles brush the ground instead of sinking into it
      this.broom.scale.setScalar(0.75);
      this.broom.rotation.z = 0;
    }
    this.hand.position.set(-0.2, -0.95, 0);
    this.armR.add(this.hand);
    this.holdSlot.position.set(0, 1.62, 0.78);
    n.root.add(this.holdSlot);
    const sc = this.kid ? KID_SCALE : ADULT_SCALE;
    this.inner.scale.setScalar(sc);
    this.height = RAW_H * sc;
    this.step = LONG_BOTTOM.includes(o.bottom) ? 0.28 : 0.6;
    // NPCs use blob shadows (phone budget)
    this.root.traverse((m) => {
      if ((m as THREE.Mesh).isMesh) m.castShadow = false;
    });
  }

  // Rainy days: a box umbrella held up in the right hand (built on first use).
  setUmbrella(on: boolean, color = 0xe53935) {
    if (!on && !this.umbrella) return;
    if (!this.umbrella) {
      const u = new THREE.Group();
      u.add(B(0.05, 1.25, 0.05, 0x5d4037, 0, 0.62, 0));
      u.add(B(0.12, 0.08, 0.06, 0x5d4037, 0.05, 0.02, 0));
      u.add(B(1.5, 0.08, 1.5, color, 0, 1.26, 0));
      u.add(B(1.1, 0.1, 1.1, shade(color, 1.18), 0, 1.34, 0));
      u.add(B(0.6, 0.1, 0.6, color, 0, 1.42, 0));
      u.add(B(0.08, 0.14, 0.08, 0xfafafa, 0, 1.52, 0));
      for (const [x, z] of [[0.72, 0], [-0.72, 0], [0, 0.72], [0, -0.72]]) u.add(B(0.1, 0.1, 0.1, 0xfafafa, x, 1.2, z));
      // held in the right hand; update() counter-rotates it so the pole stays upright
      u.position.copy(this.hand.position);
      u.scale.set(1.6, 1.95, 1.6); // tall pole: the canopy clears hats and helmets
      this.armR.add(u);
      this.umbrella = u;
    }
    this.umbrella.visible = on;
    if (on) {
      (this.umbrella.children[2] as THREE.Mesh).material = lam(color);
      (this.umbrella.children[4] as THREE.Mesh).material = lam(color);
      (this.umbrella.children[3] as THREE.Mesh).material = lam(shade(color, 1.18));
    }
  }

  /** Repaint the mouth on the face texture: smile | o | grin | frown. */
  setMouth(m: string) {
    if (this.mouth === m) return;
    this.mouth = m;
    const img = this.n.skin.image as HTMLCanvasElement;
    const g = img.getContext('2d')!;
    const k = img.width / 1024;
    g.setTransform(k, 0, 0, k, 0, 0);
    const o = this.o;
    const fy = 188;
    // clear the mouth area (below the nose) back to skin
    g.fillStyle = hex(o.skin);
    g.fillRect(166, fy + 31, 52, 31);
    if (o.mustache) {
      g.fillStyle = '#2b1b10';
      g.fillRect(166, fy + 33, 52, 9);
    }
    const lip = '#7a3b2e', dark = '#4a1a14';
    if (m === 'o') {
      g.fillStyle = dark;
      g.beginPath();
      g.ellipse(192, fy + 48, 9, 11, 0, 0, 7);
      g.fill();
    } else if (m === 'grin') {
      g.fillStyle = dark;
      g.beginPath();
      g.moveTo(172, fy + 42);
      g.lineTo(212, fy + 42);
      g.quadraticCurveTo(210, fy + 60, 192, fy + 60);
      g.quadraticCurveTo(174, fy + 60, 172, fy + 42);
      g.fill();
      g.fillStyle = '#fff';
      g.fillRect(177, fy + 43, 30, 6);
    } else if (m === 'frown') {
      g.strokeStyle = lip;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(192, fy + 60, 15, 1.2 * Math.PI, 1.8 * Math.PI);
      g.stroke();
    } else {
      g.strokeStyle = lip;
      g.lineWidth = 6;
      g.beginPath();
      g.arc(192, fy + 34, 17, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
    this.n.skin.needsUpdate = true;
  }

  update(dt: number, pose: HumanPose, speed = 1) {
    this.t += dt;
    const t = this.t;
    const st = this.step;
    let la = 0, ra = 0, laz = 0, raz = 0, ll = 0, lr = 0, hy = 0, hx = 0, bob = 0, rot = 0;
    if (pose === 'walk') {
      this.phase += dt * 7 * speed;
      const s = Math.sin(this.phase);
      ll = s * st;
      lr = -s * st;
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
      ll = s * st;
      lr = -s * st;
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
      ll = s * st;
      lr = -s * st;
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
    // open umbrella: the right hand holds it a little forward
    if (this.umbrella?.visible && (pose === 'walk' || pose === 'idle' || pose === 'sweep' || pose === 'laugh')) {
      ra = -0.45;
      raz = 0.25; // right hand out to the side: the pole stays clear of the face
    }
    // Kenney arm-left sits at +x like the old model, so the old pose angles carry over unchanged
    this.armL.rotation.set(la, 0, laz);
    this.armR.rotation.set(ra, 0, raz);
    if (this.umbrella?.visible) this.umbrella.quaternion.copy(this.armR.quaternion).invert(); // pole stays upright
    this.legL.rotation.x = ll;
    this.legR.rotation.x = lr;
    this.head.rotation.set(hx, hy, 0);
    this.inner.position.y = bob;
    this.inner.rotation.y = rot;
    // broom angle in the arm frame: arm + broom ~ -0.62 puts the bristles on the ground in front
    if (this.broom) this.broom.rotation.x = pose === 'shoo' ? 0.3 + Math.sin(t * 16) * 0.5 : pose === 'surprised' ? 0 : -0.62 - ra;
  }
}
