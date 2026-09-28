import * as THREE from 'three';
import { mbox } from './builder';

// Day light: morning -> noon -> golden late afternoon ("sore").
const KEYS = [
  { t: 0, sky: 0xa9dcff, fog: 0xc5e6ff, sun: 0xfff1d6, sunI: 1.5, hemi: 1.05, ground: 0x8a9a6a },
  { t: 0.45, sky: 0x86c9ff, fog: 0xb3dcff, sun: 0xffffff, sunI: 1.75, hemi: 1.15, ground: 0x8fa36f },
  { t: 0.8, sky: 0xffc98f, fog: 0xffd9ae, sun: 0xffc27a, sunI: 1.45, hemi: 0.95, ground: 0x9c7f5a },
  { t: 1, sky: 0xff9e7a, fog: 0xffb895, sun: 0xff9a5c, sunI: 1.2, hemi: 0.8, ground: 0x8a6048 },
];

export class Sky {
  hemi: THREE.HemisphereLight;
  sun: THREE.DirectionalLight;
  sunMesh: THREE.Mesh;
  clouds: THREE.Group;
  scene: THREE.Scene;
  c1 = new THREE.Color();
  c2 = new THREE.Color();

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
      c.traverse((o: any) => o.material && (o.material = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false, transparent: true, opacity: 0.92 })));
      this.clouds.add(c);
    }
    scene.add(this.clouds);
  }

  set(p: number, dt = 0) {
    // p: 0 morning .. 1 evening
    let a = KEYS[0], b = KEYS[KEYS.length - 1];
    for (let i = 0; i < KEYS.length - 1; i++)
      if (p >= KEYS[i].t && p <= KEYS[i + 1].t) {
        a = KEYS[i];
        b = KEYS[i + 1];
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
    // sun arc from east to west
    const ang = 0.35 + p * 2.3;
    const x = Math.cos(ang) * 70, y = Math.sin(ang) * 55 + 8, z = -30;
    this.sun.position.set(x * 0.3, y * 0.3 + 10, z * 0.3);
    this.sun.target.position.set(0, 0, 0);
    this.sunMesh.position.set(x + 10, y, z - 40);
    (this.sunMesh.material as THREE.MeshBasicMaterial).color.setHex(0xfff3b0).lerp(this.c2.setHex(0xff8a50), Math.max(0, p - 0.6) * 2.2);
    for (const c of this.clouds.children) {
      c.position.x += dt * 0.6;
      if (c.position.x > 90) c.position.x = -70;
    }
  }
}
