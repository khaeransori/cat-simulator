// Blocky people: Kenney "Blocky Characters" (CC0, kenney.nl) rig, re-skinned at runtime with
// Indonesian outfits (painted CanvasTexture in the Kenney UV atlas + a few box extras).
// Rules: anyone wearing a kerudung has long sleeves and a long bottom. No family names.
import * as THREE from 'three';
import { RIG } from './blockyRig';

/** skin texture resolution (atlas is authored at 1024; 512 keeps phone GPU memory low) */
export const SKIN_RES = 512;

export type Top = 'kaos' | 'kaosBola' | 'koko' | 'blazer' | 'daster' | 'gamis' | 'kebaya' | 'seragam' | 'rompi' | 'tunik';
export type Bottom = 'celana' | 'pendek' | 'gamis' | 'daster' | 'sarung' | 'kain';
export type Head = 'pendek' | 'sanggul' | 'peci' | 'topi' | 'topiPet' | 'helm' | 'pashmina' | 'bergo' | 'kerudungAnak';
export type Pat = 'polos' | 'batik' | 'kotak' | 'bunga';
export interface Outfit {
  kid?: boolean; skin: number;
  top: Top; topC: number; topPat?: Pat; topC2?: number; long: boolean;
  bottom: Bottom; botC: number; botPat?: Pat; botC2?: number;
  head: Head; headC?: number; hair?: number;
  shoes: number; boots?: boolean; mustache?: boolean;
  prop?: 'sapuLidi' | 'tas' | 'keranjang' | 'peluit';
  apron?: number; towel?: boolean;
}


export const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');
export const shadeC = (c: number, k: number) => {
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v * k)));
  return (f((c >> 16) & 255) << 16) | (f((c >> 8) & 255) << 8) | f(c & 255);
};

export function fabric(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c: number, pat: Pat = 'polos', c2 = 0xffffff, s = 1) {
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.fillStyle = hex(c); g.fillRect(x, y, w, h);
  g.fillStyle = hex(c2); g.strokeStyle = hex(c2);
  if (pat === 'batik') {
    const st = 44 * s;
    let row = 0;
    for (let yy = y - st; yy < y + h + st; yy += st, row++) for (let xx = x - st; xx < x + w + st; xx += st) {
      const cx = xx + (row % 2 ? st / 2 : 0), cy = yy;
      g.lineWidth = 4 * s;
      for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2 + Math.PI / 4; g.beginPath(); g.ellipse(cx + Math.cos(a) * 9 * s, cy + Math.sin(a) * 9 * s, 8 * s, 4.5 * s, a, 0, 7); g.stroke(); }
      g.beginPath(); g.arc(cx, cy, 3 * s, 0, 7); g.fill();
    }
  } else if (pat === 'kotak') {
    const st = 46 * s;
    g.globalAlpha = 0.55;
    for (let xx = x; xx < x + w; xx += st) g.fillRect(xx, y, 16 * s, h);
    for (let yy = y; yy < y + h; yy += st) g.fillRect(x, yy, w, 16 * s);
    g.globalAlpha = 1; g.fillStyle = hex(shadeC(c, 0.6));
    for (let xx = x + 28 * s; xx < x + w; xx += st) g.fillRect(xx, y, 5 * s, h);
  } else if (pat === 'bunga') {
    let row = 0;
    for (let yy = y + 20; yy < y + h; yy += 50 * s, row++) for (let xx = x + 20 + (row % 2) * 25; xx < x + w; xx += 50 * s) {
      g.fillStyle = hex(c2);
      for (let k = 0; k < 5; k++) { const a = k * 1.2566; g.beginPath(); g.arc(xx + Math.cos(a) * 6 * s, yy + Math.sin(a) * 6 * s, 4.5 * s, 0, 7); g.fill(); }
      g.fillStyle = '#ffd54f'; g.beginPath(); g.arc(xx, yy, 3.5 * s, 0, 7); g.fill();
    }
  }
  g.restore();
}

export function patternTex(c: number, pat: Pat = 'polos', c2 = 0xffffff, rep = 1) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 256;
  fabric(cv.getContext('2d')!, 0, 0, 256, 256, c, pat, c2, 0.8);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep, rep);
  return t;
}

/** Paint a skin in the Kenney Blocky UV layout. */
export function paintSkin(o: Outfit) {
  const cv = document.createElement('canvas'); cv.width = cv.height = SKIN_RES;
  const g = cv.getContext('2d')!;
  g.scale(SKIN_RES / 1024, SKIN_RES / 1024); // painted in 1024 atlas coordinates
  const R = (x: number, y: number, w: number, h: number, c: number) => { g.fillStyle = hex(c); g.fillRect(x, y, w, h); };
  const covered = o.head === 'pashmina' || o.head === 'bergo' || o.head === 'kerudungAnak';
  const hair = o.hair ?? 0x1b1410;
  // head: cross at 0..512 x 0..384, front face x128..256 y128..256
  R(0, 0, 512, 384, covered ? o.headC! : o.skin);
  if (covered) {
    g.fillStyle = hex(o.skin); g.beginPath(); g.ellipse(192, 204, 50, 56, 0, 0, 7); g.fill();
    R(128, 128, 128, 26, o.headC!);
  } else {
    R(128, 0, 128, 128, hair); R(384, 128, 128, 128, hair);
    R(0, 128, 128, 56, hair); R(256, 128, 128, 56, hair); R(128, 128, 128, 34, hair);
  }
  const fy = 188;
  R(152, fy, 16, 20, 0x2b2118); R(216, fy, 16, 20, 0x2b2118);
  R(156, fy + 2, 6, 6, 0xffffff); R(220, fy + 2, 6, 6, 0xffffff);
  const brow = covered ? shadeC(o.skin, 0.55) : hair;
  R(148, fy - 13, 24, 6, brow); R(212, fy - 13, 24, 6, brow);
  R(186, fy + 20, 12, 10, shadeC(o.skin, 0.78));
  if (o.mustache) R(166, fy + 33, 52, 9, 0x2b1b10);
  g.strokeStyle = '#7a3b2e'; g.lineWidth = 6; g.beginPath(); g.arc(192, fy + 34, 17, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  g.fillStyle = 'rgba(255,120,120,.3)'; g.beginPath(); g.ellipse(150, fy + 34, 12, 7, 0, 0, 7); g.ellipse(234, fy + 34, 12, 7, 0, 0, 7); g.fill();

  // torso 0..448 x 688..1024 (front x96..224, y784..928)
  fabric(g, 0, 688, 448, 336, o.topC, o.topPat, o.topC2);
  const F = (x: number, y: number, w: number, h: number, c: number) => R(96 + x, 784 + y, w, h, c);
  switch (o.top) {
    case 'blazer': F(40, 0, 48, 144, o.topC2!); F(20, 100, 8, 8, 0x222222); F(100, 100, 8, 8, 0x222222); break;
    case 'koko':
      F(58, 0, 12, 144, o.topC2!); for (let k = 0; k < 4; k++) F(60, 20 + k * 30, 8, 8, 0x8d7b4a);
      F(30, 0, 68, 10, o.topC2!); for (let k = 0; k < 6; k++) { F(20 + k * 4, 30 + k * 10, 4, 4, o.topC2!); F(104 - k * 4, 30 + k * 10, 4, 4, o.topC2!); } break;
    case 'seragam':
      F(60, 0, 8, 144, shadeC(o.topC, 0.8)); F(14, 34, 34, 26, shadeC(o.topC, 0.88)); F(80, 34, 34, 26, shadeC(o.topC, 0.88));
      F(86, 22, 22, 10, 0xc62828); F(18, 26, 14, 14, 0xfdd835);
      R(0, 900, 448, 12, 0x2b2118);
      for (let k = 0; k < 4; k++) F(62, 14 + k * 30, 5, 5, 0x6d5a3a); break;
    case 'rompi':
      R(0, 688, 448, 336, o.topC2!);
      R(0, 784, 448, 144, o.topC);
      F(56, 0, 16, 144, o.topC2!);
      for (const yy of [60, 100]) R(0, 784 + yy, 448, 12, 0xe0f2f1);
      break;
    case 'kaosBola': for (let x = 0; x < 448; x += 40) R(x, 688, 16, 336, o.topC2!); F(40, 18, 48, 44, o.topC); g.fillStyle = '#fff'; g.font = 'bold 34px sans-serif'; g.fillText('10', 96 + 46, 784 + 52); break;
    case 'kaos': F(48, 0, 32, 10, shadeC(o.topC, 0.8)); break;
    case 'kebaya': F(44, 0, 40, 144, shadeC(o.topC, 0.85)); for (let k = 0; k < 3; k++) F(58, 30 + k * 36, 12, 10, 0xfdd835); break;
    default: break;
  }
  if (o.apron) { F(10, 36, 108, 108, o.apron); F(10, 0, 10, 36, o.apron); F(108, 0, 10, 36, o.apron); }
  if (o.towel) F(2, 0, 34, 80, 0xf5f5f5);
  // arms x480..736 / 768..1024, y534..768 (bottom 44 = hand)
  const sleeveC = o.top === 'rompi' ? o.topC2! : o.topC;
  for (const ax of [480, 768]) {
    fabric(g, ax, 534, 256, 234, sleeveC, o.top === 'rompi' ? 'polos' : o.topPat, o.topC2);
    if (o.top === 'kaosBola') R(ax, 534, 256, 234, o.topC);
    R(ax, 724, 256, 44, o.skin);
    if (!o.long) R(ax, 630, 256, 94, o.skin);
    else R(ax, 712, 256, 12, shadeC(sleeveC, 0.82));
  }
  // legs x480..736 / 768..1024, y800..1024 (bottom 40 = shoes)
  for (const lx of [480, 768]) {
    fabric(g, lx, 800, 256, 224, o.botC, o.botPat, o.botC2);
    if (o.bottom === 'pendek') R(lx, 880, 256, 104, o.skin);
    R(lx, o.boots ? 930 : 984, 256, o.boots ? 94 : 40, o.shoes);
    if (o.bottom === 'pendek' && o.kid) R(lx, 960, 256, 24, 0xffffff);
  }
  const t = new THREE.CanvasTexture(cv);
  t.flipY = false; t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

// 3D clothing pieces (Kenney units: torso node origin y=1.0 (root), mesh y 0.3..1.2 local; head node scaled 0.1, cube 8 units)
export function dress(root: THREE.Object3D, o: Outfit, seated = false) {
  const head = root.getObjectByName('head')!;
  const torso = root.getObjectByName('torso')!;
  const lam = (c: number, map?: THREE.Texture) => new THREE.MeshLambertMaterial({ color: map ? 0xffffff : c, map });
  const box = (p: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const mm = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); mm.position.set(x, y, z); mm.castShadow = true; p.add(mm); return mm;
  };
  const H = (v: number) => v * 10;
  // long garment from the hips down (gamis, daster, sarung, kain): tapered 4-sided prism
  const skirtTo: Partial<Record<Bottom, number>> = { gamis: 0.08, daster: 0.2, sarung: 0.1, kain: 0.08 };
  const to = skirtTo[o.bottom];
  if (to !== undefined && seated) {
    const map = o.botPat && o.botPat !== 'polos' ? patternTex(o.botC, o.botPat, o.botC2, 1) : undefined;
    for (const k of ['leg-left', 'leg-right']) {
      const leg = root.getObjectByName(k)!;
      const len = 1.0 - to;
      box(leg, 0.42, len, 0.44, lam(o.botC, map), 0, -len / 2 + 0.04, 0.0);
    }
    box(torso, 0.9, 0.3, 0.72, lam(o.botC, map), 0, -0.3, 0.02); // lap / hips
  } else if (to !== undefined) {
    const top = 1.0, h = top - to;
    const g = new THREE.CylinderGeometry(0.52, 0.64, h, 4, 1);
    g.rotateY(Math.PI / 4); g.scale(1.0, 1, 0.78);
    const map = o.botPat && o.botPat !== 'polos' ? patternTex(o.botC, o.botPat, o.botC2, 2) : undefined;
    const m = new THREE.Mesh(g, lam(o.botC, map)); m.castShadow = true;
    m.position.set(0, -0.7 + (top + to) / 2 - 0.3 + 0.3, 0);
    m.position.y = to + h / 2 - 0.7; // torso-local (torso node sits at root y 0.7 in parent "root")
    torso.add(m);
    if (o.bottom === 'sarung') box(torso, 0.86, 0.08, 0.66, lam(shadeC(o.botC, 0.75)), 0, 0.32, 0);
  }
  if (o.top === 'kebaya' || o.top === 'tunik') {
    const map = o.topPat && o.topPat !== 'polos' ? patternTex(o.topC, o.topPat, o.topC2, 1.5) : undefined;
    box(torso, 0.86, 0.36, 0.66, lam(o.topC, map), 0, 0.2, 0);
  }
  if (o.top === 'blazer') box(torso, 0.84, 0.18, 0.64, lam(o.topC), 0, 0.36, 0);
  const hc = o.headC ?? 0x222222;
  if (o.head === 'pashmina' || o.head === 'bergo' || o.head === 'kerudungAnak') {
    const m = lam(hc), m2 = lam(shadeC(hc, 0.9));
    box(head, H(0.88), H(0.06), H(0.88), m, 0, H(0.82), 0);
    box(head, H(0.88), H(0.82), H(0.06), m, 0, H(0.41), H(-0.44));
    box(head, H(0.05), H(0.82), H(0.86), m, H(0.43), H(0.41), H(-0.01));
    box(head, H(0.05), H(0.82), H(0.86), m, H(-0.43), H(0.41), H(-0.01));
    const len = o.head === 'bergo' ? 0.6 : 0.4;
    box(torso, 0.98, len, 0.74, m2, 0, 1.24 - len / 2, 0);
    box(torso, 0.9, 0.1, 0.7, m, 0, 1.24, 0);
    if (o.head === 'pashmina') box(torso, 0.18, 0.5, 0.06, m, 0.24, 0.84, 0.35);
    if (o.head === 'bergo') { const v = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.24, 4), m2); v.rotation.set(Math.PI, Math.PI / 4, 0); v.scale.set(1, 1, 0.3); v.position.set(0, 0.52, 0.34); torso.add(v); }
  }
  if (o.head === 'sanggul') box(head, H(0.34), H(0.3), H(0.3), lam(o.hair!), 0, H(0.66), H(-0.5));
  if (o.head === 'peci') box(head, H(0.84), H(0.28), H(0.84), lam(0x1b1b1b), 0, H(0.92), 0);
  if (o.head === 'topi') { box(head, H(0.84), H(0.2), H(0.84), lam(hc), 0, H(0.88), 0); box(head, H(0.6), H(0.05), H(0.34), lam(shadeC(hc, 0.8)), 0, H(0.8), H(0.58)); }
  if (o.head === 'topiPet') { box(head, H(0.9), H(0.24), H(0.9), lam(hc), 0, H(0.92), 0); box(head, H(0.7), H(0.05), H(0.3), lam(0x111111), 0, H(0.8), H(0.56)); box(head, H(0.16), H(0.12), H(0.02), lam(0xfdd835), 0, H(0.94), H(0.46)); }
  if (o.head === 'helm') {
    const hm = new THREE.Mesh(new THREE.CylinderGeometry(H(0.42), H(0.5), H(0.36), 8), lam(hc)); hm.position.set(0, H(0.96), 0); head.add(hm);
    box(head, H(1.1), H(0.05), H(1.1), lam(hc), 0, H(0.78), 0);
  }
  const armR = root.getObjectByName('arm-right')!, armL = root.getObjectByName('arm-left')!;
  if (o.prop === 'sapuLidi') {
    const s = new THREE.Group();
    box(s, 0.07, 0.9, 0.07, lam(0xa1887f), 0, -0.2, 0);
    box(s, 0.12, 0.1, 0.12, lam(0xc62828), 0, -0.62, 0);
    for (let k = 0; k < 9; k++) { const st = box(s, 0.025, 0.9, 0.025, lam(0xd4b26a), (k - 4) * 0.03, -1.1, 0); st.rotation.z = (k - 4) * 0.07; }
    s.position.set(-0.2, -0.85, 0.12); s.rotation.set(0.45, 0, 0.15); armR.add(s);
  }
  if (o.prop === 'tas') { box(armL, 0.42, 0.34, 0.16, lam(0x6d4c41), 0.22, -1.05, 0); box(armL, 0.06, 0.2, 0.06, lam(0x4e342e), 0.22, -0.82, 0); }
  if (o.prop === 'keranjang') { box(armL, 0.55, 0.3, 0.4, lam(0xc8a165), 0.3, -1.1, 0); box(armL, 0.12, 0.12, 0.12, lam(0x4caf50), 0.2, -0.9, 0); box(armL, 0.12, 0.1, 0.12, lam(0xe53935), 0.4, -0.9, 0.05); }
  if (o.prop === 'peluit') box(torso, 0.06, 0.06, 0.12, lam(0xc0c0c0), 0.18, 0.95, 0.34);
}


// ---------------- rig ----------------
export interface BlockyNodes {
  root: THREE.Group; // add this to the scene (feet at y=0, faces +z)
  body: THREE.Object3D; // Kenney "root" node
  legL: THREE.Object3D; legR: THREE.Object3D; torso: THREE.Object3D; armL: THREE.Object3D; armR: THREE.Object3D; head: THREE.Object3D;
  skin: THREE.Texture;
}
const GEO: Record<string, THREE.BufferGeometry> = {};
function rigGeo(name: string) {
  if (!GEO[name]) {
    const n = RIG[name];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(n.pos!, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(n.uv!, 2));
    g.setIndex(n.idx!);
    g.computeVertexNormals();
    GEO[name] = g;
  }
  return GEO[name];
}
function rigNode(name: string, mat: THREE.Material): THREE.Object3D {
  const n = RIG[name];
  const o: THREE.Object3D = n.pos ? new THREE.Mesh(rigGeo(name), mat) : new THREE.Group();
  o.name = name;
  o.position.fromArray(n.t); o.quaternion.fromArray(n.r); o.scale.fromArray(n.s);
  for (const c of n.c) o.add(rigNode(c, mat));
  return o;
}
/** Build one dressed Blocky person. Raw model is 2.73 tall; scale the returned root yourself. */
export function buildBlocky(o: Outfit, seated = false): BlockyNodes {
  const skin = paintSkin(o);
  const mat = new THREE.MeshLambertMaterial({ map: skin });
  const body = rigNode('root', mat);
  const root = new THREE.Group(); root.add(body);
  dress(body, o, seated);
  const q = (k: string) => body.getObjectByName(k)!;
  return { root, body, legL: q('leg-left'), legR: q('leg-right'), torso: q('torso'), armL: q('arm-left'), armR: q('arm-right'), head: q('head'), skin };
}
/** rigid-part pose: rotation.x < 0 swings forward; spread/armIn open sideways. */
export function poseBlocky(n: BlockyNodes, p: { legL?: number; legR?: number; spread?: number; armL?: number; armR?: number; armIn?: number; lean?: number }) {
  if (p.legL !== undefined) n.legL.rotation.set(p.legL, 0, -(p.spread || 0));
  if (p.legR !== undefined) n.legR.rotation.set(p.legR, 0, p.spread || 0);
  if (p.armL !== undefined) n.armL.rotation.set(p.armL, 0, -(p.armIn || 0));
  if (p.armR !== undefined) n.armR.rotation.set(p.armR, 0, p.armIn || 0);
  if (p.lean !== undefined) n.torso.rotation.x = p.lean;
}
/** Seated pose used for drivers/riders/passengers. */
export const SEATED = { legL: -1.35, legR: -1.35, spread: 0.15, armL: -1.05, armR: -1.05, armIn: 0.08, lean: 0.06 };
/** Two-box helmet on the head node (head node is scaled 0.1, so 10x units). */
export function helmetOn(n: BlockyNodes, c: number, visor = 0x263238) {
  const m = (col: number) => new THREE.MeshLambertMaterial({ color: col });
  const a = new THREE.Mesh(new THREE.BoxGeometry(9.4, 5.2, 9.4), m(c)); a.position.set(0, 6.4, -0.2); n.head.add(a);
  const b = new THREE.Mesh(new THREE.BoxGeometry(9.6, 2.0, 1.0), m(visor)); b.position.set(0, 5.0, 4.6); n.head.add(b);
}
