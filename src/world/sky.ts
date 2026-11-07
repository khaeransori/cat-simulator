import * as THREE from 'three';
import { mbox } from './builder';

type Key = { t: number; sky: number; fog: number; sun: number; sunI: number; hemi: number; ground: number; hc?: number };
// Day light: morning -> noon -> golden late afternoon ("sore").
const KEYS: Key[] = [
  { t: 0, sky: 0xa9dcff, fog: 0xc5e6ff, sun: 0xfff1d6, sunI: 1.5, hemi: 1.05, ground: 0x8a9a6a },
  { t: 0.45, sky: 0x86c9ff, fog: 0xb3dcff, sun: 0xffffff, sunI: 1.75, hemi: 1.15, ground: 0x8fa36f },
  { t: 0.8, sky: 0xffc98f, fog: 0xffd9ae, sun: 0xffc27a, sunI: 1.45, hemi: 0.95, ground: 0x9c7f5a },
  { t: 1, sky: 0xff9e7a, fog: 0xffb895, sun: 0xff9a5c, sunI: 1.2, hemi: 0.8, ground: 0x8a6048 },
];
// Rainy day: soft grey-blue, no harsh sun, a bit dimmer toward evening.
const RAIN: Key[] = [
  { t: 0, sky: 0x9fb0c2, fog: 0xa9b8c8, sun: 0xe6eef8, sunI: 0.75, hemi: 1.2, ground: 0x6f7f72, hc: 0xe8f0ff },
  { t: 0.6, sky: 0x92a3b8, fog: 0x9eadc0, sun: 0xe0e8f4, sunI: 0.7, hemi: 1.15, ground: 0x6a7a6e, hc: 0xe2ecff },
  { t: 1, sky: 0x8a8fa8, fog: 0x969bb4, sun: 0xe8d8d0, sunI: 0.6, hemi: 1.05, ground: 0x66667a, hc: 0xe6e0f4 },
];
// Cozy night: deep blue but bright enough to play (moonlight + blue sky light).
const NIGHT: Key[] = [
  { t: 0, sky: 0x34467f, fog: 0x3a4d86, sun: 0xc8d6ff, sunI: 0.8, hemi: 1.15, ground: 0x4a5577, hc: 0xa9bcff },
  { t: 0.5, sky: 0x26386e, fog: 0x2f4279, sun: 0xc0d0ff, sunI: 0.75, hemi: 1.1, ground: 0x45507a, hc: 0xa2b6ff },
  { t: 1, sky: 0x223266, fog: 0x2b3c72, sun: 0xbccbff, sunI: 0.72, hemi: 1.05, ground: 0x434d78, hc: 0x9fb2ff },
];
const SETS = { cerah: KEYS, hujan: RAIN, malam: NIGHT };
const CLOUD = { cerah: [0xffffff, 0.92], hujan: [0xa4adb9, 0.96], malam: [0x4b5b8f, 0.55] };

export class Sky {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  sunMesh: THREE.Mesh;
  clouds: THREE.Group;
  cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 });
  scene: THREE.Scene;
  c1 = new THREE.Color();
  c2 = new THREE.Color();
  /** day type look (see game/weather.ts) */
  mode: 'cerah' | 'hujan' | 'malam' = 'cerah';

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a6a, 1.1);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 1.6);
    scene.add(this.sun);
    scene.add(this.sun.target);
    this.sunMesh = new THREE.Mesh(new THREE.BoxGeometry(6, 6, 6), new THREE.MeshBasicMaterial({ color: 0xfff3b0, fog: false }));
    scene.add(this.sunMesh);
    scene.background = new THREE.Color(0xa9dcff);
    scene.fog = new THREE.Fog(0xc5e6ff, 45, 120);
    this.clouds = new THREE.Group();
    for (let i = 0; i < 14; i++) {
      const c = new THREE.Group();
      const n = 2 + Math.floor(Math.random() * 3);
      for (let j = 0; j < n; j++) c.add(mbox(3 + Math.random() * 4, 1 + Math.random() * 1, 2.5 + Math.random() * 2, 0xffffff, j * 2.2 - n, Math.random() * 0.6, Math.random() * 1.5));
      c.position.set(-60 + Math.random() * 140, 22 + Math.random() * 8, -50 + Math.random() * 100);
      c.traverse((o: any) => o.material && (o.material = this.cloudMat));
      this.clouds.add(c);
    }
    scene.add(this.clouds);
  }

  setMode(m: 'cerah' | 'hujan' | 'malam') {
    this.mode = m;
    const [col, op] = CLOUD[m];
    this.cloudMat.color.setHex(col);
    this.cloudMat.opacity = op;
    // rainy days: a thick, low cloud cover
    for (const c of this.clouds.children) c.scale.setScalar(m === 'hujan' ? 1.6 : 1);
    this.sunMesh.visible = m === 'cerah';
  }

  set(p: number, dt = 0) {
    // p: 0 morning .. 1 evening
    const K = SETS[this.mode];
    let a = K[0], b = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++)
      if (p >= K[i].t && p <= K[i + 1].t) {
        a = K[i];
        b = K[i + 1];
        break;
      }
    const k = (p - a.t) / Math.max(0.0001, b.t - a.t);
    const bg = this.scene.background as THREE.Color;
    bg.setHex(a.sky).lerp(this.c1.setHex(b.sky), k);
    (this.scene.fog as THREE.Fog).color.setHex(a.fog).lerp(this.c1.setHex(b.fog), k);
    this.sun.color.setHex(a.sun).lerp(this.c1.setHex(b.sun), k);
    this.sun.intensity = a.sunI + (b.sunI - a.sunI) * k;
    this.hemi.intensity = a.hemi + (b.hemi - a.hemi) * k;
    this.hemi.groundColor.setHex(a.ground).lerp(this.c1.setHex(b.ground), k);
    this.hemi.color.setHex(a.hc ?? 0xffffff).lerp(this.c1.setHex(b.hc ?? 0xffffff), k);
    // sun arc from east to west (at night: the moon, fixed high in the sky)
    const ang = this.mode === 'malam' ? 1.1 : 0.35 + p * 2.3;
    const x = Math.cos(ang) * 70, y = Math.sin(ang) * 55 + 8, z = -30;
    this.sun.position.set(x * 0.3, y * 0.3 + 10, z * 0.3);
    this.sun.target.position.set(0, 0, 0);
    this.sunMesh.position.set(x + 10, y, z - 40);
    (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(0xfff3b0).lerp(this.c2.setHex(0xff8a50), Math.max(0, p - 0.6) * 2.2);
    for (const c of this.clouds.children) {
      c.position.x += dt * (this.mode === 'hujan' ? 1.2 : 0.6);
      if (c.position.x > 90) c.position.x = -70;
    }
  }
}
