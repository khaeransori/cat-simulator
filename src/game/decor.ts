// Rumah Kucing: decorations bought with fish coins for the cat's corner of
// the living room. Every item has a fixed slot (no free placement), so the
// sofa, the front door and Mama's cutscene path always stay clear.
// Static parts of all placed items are merged into ONE mesh (one draw call);
// colliders are created once and simply switched on/off.
import * as THREE from 'three';
import { ctx, rand, clamp } from '../ctx';
import type { Pair } from '../i18n';
import { tr, L } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { StaticBuilder, mbox, type AABB } from '../world/builder';

const P = (id: string, en: string): Pair => ({ id, en });
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export interface DecorDef {
  id: string;
  icon: string;
  name: Pair;
  desc: Pair;
  price: number;
  pos: THREE.Vector3; // slot (floor point the camera looks at)
  cam?: THREE.Vector3; // shop camera position for this item
}

export const DECOR: DecorDef[] = [
  { id: 'bola', icon: '🧶', name: P('Bola benang', 'Yarn ball'), desc: P('Tendang, menggelinding!', 'Paw it and it rolls!'), price: 20, pos: V(-10.3, 0, -15.3) },
  { id: 'tikus', icon: '🐭', name: P('Tikus mainan', 'Toy mouse'), desc: P('Cicit! Cicit!', 'Squeak! Squeak!'), price: 20, pos: V(-11.4, 0, -15.75) },
  { id: 'mangkuk', icon: '🥣', name: P('Mangkuk makan', 'Food bowls'), desc: P('Ngemil kapan saja.', 'Snack any time.'), price: 25, pos: V(-15.5, 0, -18.4) },
  { id: 'tanaman', icon: '🪴', name: P('Tanaman hijau', 'Green plant'), desc: P('Rumah jadi segar.', 'Makes the room fresh.'), price: 25, pos: V(-21.3, 0, -18.0), cam: V(-18.4, 1.9, -15.6) },
  { id: 'karpet', icon: '🟠', name: P('Karpet bulat', 'Round rug'), desc: P('Empuk buat guling-guling.', 'Soft for rolling around.'), price: 30, pos: V(-11.5, 0, -16.3), cam: V(-14.2, 2.3, -14.3) },
  { id: 'poster', icon: '🖼️', name: P('Poster ikan', 'Fish poster'), desc: P('Ikan favorit di dinding.', 'Your favourite fish on the wall.'), price: 30, pos: V(-12.6, 1.6, -18.8) },
  { id: 'kardus', icon: '📦', name: P('Rumah kardus', 'Cardboard house'), desc: P('Tempat ngumpet rahasia.', 'A secret hideout.'), price: 35, pos: V(-12.6, 0, -18.3) },
  { id: 'lampu', icon: '💡', name: P('Lampu tidur', 'Night lamp'), desc: P('Cahaya hangat dekat pintu.', 'A warm glow by the door.'), price: 35, pos: V(-15.75, 0.6, -13.75), cam: V(-14.6, 1.6, -16.4) },
  { id: 'tiang', icon: '🪵', name: P('Tiang cakar', 'Scratching post'), desc: P('Cakar sepuasnya!', 'Scratch all you want!'), price: 40, pos: V(-7.0, 0, -15.6) },
  { id: 'kasur', icon: '🛏️', name: P('Kasur kucing', 'Cat bed'), desc: P('Bobo siang. Mama juga senang!', 'Nap time. Mom likes it too!'), price: 45, pos: V(-8.3, 0, -14.35) },
  { id: 'rak', icon: '📚', name: P('Rak dinding', 'Wall shelf'), desc: P('Lompat ke atas dari tiang cakar.', 'Jump up from the scratching post.'), price: 45, pos: V(-6.5, 1.6, -15.5) },
  { id: 'akuarium', icon: '🐠', name: P('Akuarium kecil', 'Little aquarium'), desc: P('Ikannya berenang lucu.', 'Cute swimming fish.'), price: 60, pos: V(-8.0, 0.6, -18.45) },
];
export const DECOR_BY: Record<string, DecorDef> = Object.fromEntries(DECOR.map((d) => [d.id, d]));

interface Part {
  S: StaticBuilder; // static geometry (+ colliders, kept off until placed)
  cols: AABB[];
  objs: THREE.Object3D[]; // separate (animated / textured) parts
}

export function decorOwned(id: string) {
  return !!ctx.save.decor?.[id];
}
export function decorPlaced(id: string) {
  return decorOwned(id) && !ctx.save.decorOff?.[id];
}

export class DecorSystem {
  parts: Record<string, Part> = {};
  mesh: THREE.Mesh | null = null;
  mat = new THREE.MeshLambertMaterial({ vertexColors: true });
  previewId: string | null = null;
  // yarn ball
  ball = new THREE.Group();
  ballV = new THREE.Vector3();
  ballHome = V(-10.3, 0.13, -15.3);
  // toy mouse
  mouse = new THREE.Group();
  mouseHop = 0;
  // aquarium fish
  fish: THREE.Object3D[] = [];
  fishFast = 0;

  constructor() {
    const scene = ctx.scene;
    for (const d of DECOR) {
      const S = new StaticBuilder();
      const objs: THREE.Object3D[] = [];
      this.build(d.id, S, objs);
      for (const o of objs) {
        o.visible = false;
        scene.add(o);
      }
      for (const c of S.colliders) {
        c.off = true;
        ctx.world.phys.add(c);
      }
      this.parts[d.id] = { S, cols: S.colliders, objs };
    }
    this.setupInteract();
    this.refresh();
    ctx.world.anim.push((dt: number, t: number) => this.anim(dt, t));
  }

  isShown(id: string) {
    return decorPlaced(id) || this.previewId === id;
  }

  /** Rebuild the merged mesh and switch colliders after buying / toggling. */
  refresh() {
    const pos: number[] = [], nrm: number[] = [], col: number[] = [], idx: number[] = [];
    for (const d of DECOR) {
      const p = this.parts[d.id];
      const on = this.isShown(d.id);
      // a previewed (not yet bought) item is only for looking: no colliders
      for (const c of p.cols) c.off = !decorPlaced(d.id);
      for (const o of p.objs) o.visible = on;
      if (!on) continue;
      const base = pos.length / 3;
      pos.push(...p.S.pos);
      nrm.push(...p.S.nrm);
      col.push(...p.S.col);
      for (const i of p.S.idx) idx.push(i + base);
    }
    if (this.mesh) {
      ctx.scene.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (idx.length) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
      g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      g.setIndex(idx);
      g.computeBoundingSphere();
      this.mesh = new THREE.Mesh(g, this.mat);
      this.mesh.matrixAutoUpdate = false;
      ctx.scene.add(this.mesh);
    }
  }

  preview(id: string | null) {
    if (this.previewId === id) return;
    this.previewId = id;
    this.refresh();
  }

  buy(id: string): boolean {
    const d = DECOR_BY[id];
    const s = ctx.save;
    if (!d || decorOwned(id)) return false;
    if (s.coins < d.price) return false;
    s.coins -= d.price;
    s.decor[id] = true;
    delete s.decorOff[id];
    writeSave(s);
    this.refresh();
    return true;
  }

  toggle(id: string) {
    if (!decorOwned(id)) return;
    const s = ctx.save;
    if (s.decorOff[id]) delete s.decorOff[id];
    else s.decorOff[id] = true;
    writeSave(s);
    this.refresh();
  }

  /** New day: put the toys back in their spots. */
  reset() {
    this.ball.position.copy(this.ballHome);
    this.ballV.set(0, 0, 0);
    this.mouse.position.set(-11.4, 0.03, -15.75);
    this.mouse.rotation.set(0, 0.6, 0);
    this.mouseHop = 0;
  }

  // ---------------- geometry ----------------
  build(id: string, S: StaticBuilder, objs: THREE.Object3D[]) {
    switch (id) {
      case 'kasur': {
        const x = -8.3, z = -14.35;
        S.box(x, 0, z, 1.1, 0.2, 0.86, 0x8e5bb5, { top: 0xa070c8 }); // walkable base (step-up height)
        S.box(x, 0.2, z, 0.86, 0.04, 0.62, 0xf8e3ff, { collide: false }); // cushion
        S.mm(x - 0.55, 0.2, z - 0.43, x + 0.55, 0.36, z - 0.31, 0x9d6ac4, { collide: false });
        S.mm(x - 0.55, 0.2, z + 0.31, x + 0.55, 0.42, z + 0.43, 0x9d6ac4, { collide: false });
        S.mm(x - 0.55, 0.2, z - 0.31, x - 0.43, 0.36, z + 0.31, 0x9d6ac4, { collide: false });
        S.mm(x + 0.43, 0.2, z - 0.31, x + 0.55, 0.36, z + 0.31, 0x9d6ac4, { collide: false });
        // paw print on the cushion
        S.box(x + 0.15, 0.241, z, 0.14, 0.01, 0.12, 0xd9a8ef, { collide: false, jitter: 0 });
        for (const [dx, dz] of [[-0.02, -0.11], [0.06, -0.12], [0.12, -0.09], [-0.07, -0.07]]) S.box(x + 0.15 + dx, 0.241, z + dz + 0.02, 0.05, 0.01, 0.05, 0xd9a8ef, { collide: false, jitter: 0 });
        break;
      }
      case 'tiang': {
        const x = -7.0, z = -15.6;
        S.box(x, 0, z, 0.62, 0.1, 0.62, 0xc9b28a, { top: 0xe4d2ae });
        for (let i = 0; i < 6; i++) S.box(x, 0.1 + i * 0.18, z, 0.19, 0.18, 0.19, i % 2 ? 0xd8b984 : 0xc7a46c, { collide: i === 0 });
        S.mm(x - 0.09, 0.1, z - 0.09, x + 0.09, 1.18, z + 0.09, 0, { visible: false });
        S.box(x, 1.18, z, 0.52, 0.08, 0.52, 0xc9b28a, { top: 0xe4d2ae });
        // dangling pompom
        S.box(x + 0.22, 0.95, z + 0.22, 0.02, 0.23, 0.02, 0xffffff, { collide: false });
        S.box(x + 0.22, 0.86, z + 0.22, 0.11, 0.11, 0.11, 0xff6f91, { collide: false });
        break;
      }
      case 'kardus': {
        // open-front box: the cat can walk inside and hide
        const x0 = -13.15, x1 = -12.05, z0 = -18.82, z1 = -17.92, h = 0.78, t = 0.05;
        const c = 0xc9955a, ct = 0xdcae72;
        S.mm(x0, 0, z0, x1, h, z0 + t, c);
        S.mm(x0, 0, z0, x0 + t, h, z1, c);
        S.mm(x1 - t, 0, z0, x1, h, z1, c);
        S.mm(x0, h - 0.05, z0, x1, h, z1, c, { top: ct });
        S.mm(x0 + t, 0.6, z1 - t, x1 - t, h - 0.05, z1, c, { collide: false }); // lintel
        // flaps
        S.rot(x0 + 0.27, h + 0.09, (z0 + z1) / 2, 0.5, 0.03, 0.88, 0, ct, 0, 0.45);
        S.rot(x1 - 0.27, h + 0.09, (z0 + z1) / 2, 0.5, 0.03, 0.88, 0, ct, 0, -0.45);
        // dark inside + cat face drawing + tape
        S.mm(x0 + t, 0.012, z0 + t, x1 - t, 0.016, z1, 0x7a5532, { collide: false, jitter: 0 });
        S.mm(x0 + t, t, z0 + t, x1 - t, h - 0.06, z0 + t + 0.01, 0x8a6038, { collide: false, jitter: 0 });
        S.mm(x0 - 0.005, 0.25, z1 - 0.5, x0, 0.55, z1 - 0.15, 0x5b3a1e, { collide: false, jitter: 0 });
        S.mm((x0 + x1) / 2 - 0.08, h, z0, (x0 + x1) / 2 + 0.08, h + 0.005, z1, 0xe8d6a8, { collide: false, jitter: 0 });
        break;
      }
      case 'bola': {
        const g = this.ball;
        const cols = [0xff5c8a, 0xe8467a, 0xff7aa0];
        g.add(mbox(0.24, 0.24, 0.24, cols[0]));
        g.add(mbox(0.28, 0.06, 0.2, cols[1], 0, 0.03, 0));
        g.add(mbox(0.06, 0.2, 0.28, cols[2], 0.03, 0, 0));
        g.add(mbox(0.2, 0.28, 0.06, cols[1], 0, 0, 0.03));
        const tail = mbox(0.25, 0.02, 0.02, cols[0], -0.2, -0.1, 0.05);
        g.add(tail);
        g.position.copy(this.ballHome);
        objs.push(g);
        break;
      }
      case 'tikus': {
        const g = this.mouse;
        g.add(mbox(0.12, 0.09, 0.2, 0x9e9ea8, 0, 0.045, 0));
        g.add(mbox(0.08, 0.07, 0.07, 0xa9a9b3, 0, 0.05, 0.12));
        g.add(mbox(0.03, 0.03, 0.02, 0xff8fb0, 0, 0.05, 0.165));
        g.add(mbox(0.05, 0.05, 0.01, 0xffb3c8, 0.04, 0.11, 0.08));
        g.add(mbox(0.05, 0.05, 0.01, 0xffb3c8, -0.04, 0.11, 0.08));
        g.add(mbox(0.02, 0.02, 0.22, 0xff8fb0, 0, 0.02, -0.2));
        g.position.set(-11.4, 0.03, -15.75);
        g.rotation.y = 0.6;
        objs.push(g);
        break;
      }
      case 'mangkuk': {
        const x = -15.5, z = -18.4;
        S.box(x, 0.0, z, 1.0, 0.02, 0.55, 0xffd54f, { collide: false, jitter: 0 }); // mat
        for (const [dx, c, rim, fill] of [[-0.24, 0xff7043, 0xff8a65, 0xa0522d], [0.24, 0x42a5f5, 0x64b5f6, 0x7fd0ff]] as [number, number, number, number][]) {
          S.box(x + dx, 0.02, z, 0.36, 0.12, 0.36, c, { collide: false });
          S.box(x + dx, 0.14, z, 0.4, 0.03, 0.4, rim, { collide: false });
          S.box(x + dx, 0.13, z, 0.28, 0.02, 0.28, fill, { collide: false, jitter: 0 });
        }
        // fish bone print
        S.box(x, 0.022, z + 0.2, 0.2, 0.005, 0.03, 0xffffff, { collide: false, jitter: 0 });
        break;
      }
      case 'tanaman': {
        const x = -21.3, z = -18.0;
        S.box(x, 0, z, 0.5, 0.45, 0.5, 0x5d8fc9, { top: 0x4a3526 });
        S.box(x, 0.4, z, 0.56, 0.08, 0.56, 0x4c7bb3, { collide: false });
        S.box(x, 0.48, z, 0.08, 0.6, 0.08, 0x3f7f3a, { collide: false });
        S.rot(x + 0.18, 0.8, z, 0.42, 0.06, 0.2, 0, 0x4caf50, 0, 0.5);
        S.rot(x - 0.18, 0.95, z, 0.42, 0.06, 0.2, 0, 0x5fbf5a, 0, -0.5);
        S.rot(x, 1.05, z + 0.17, 0.2, 0.06, 0.42, 0, 0x43a047, -0.5, 0);
        S.rot(x, 0.75, z - 0.17, 0.2, 0.06, 0.42, 0, 0x66bb6a, 0.5, 0);
        S.box(x, 1.1, z, 0.22, 0.22, 0.22, 0x4caf50, { collide: false });
        break;
      }
      case 'karpet': {
        // stepped circle
        const cx = -11.5, cz = -16.3, R = 1.05;
        for (let i = -6; i <= 6; i++) {
          const zz = cz + (i / 6.5) * R;
          const w = Math.sqrt(Math.max(0, R * R - ((i / 6.5) * R) ** 2)) * 2;
          const c = Math.abs(i) % 3 === 0 ? 0xffa94d : 0xff8a3d;
          S.mm(cx - w / 2, 0.016, zz - R / 13, cx + w / 2, 0.03, zz + R / 13, c, { collide: false, jitter: 0 });
        }
        for (let i = -3; i <= 3; i++) {
          const zz = cz + (i / 3.5) * 0.5;
          const w = Math.sqrt(Math.max(0, 0.25 - ((i / 3.5) * 0.5) ** 2)) * 2;
          S.mm(cx - w / 2, 0.03, zz - 0.075, cx + w / 2, 0.034, zz + 0.075, 0xffe08a, { collide: false, jitter: 0 });
        }
        break;
      }
      case 'poster': {
        S.mm(-13.15, 1.25, -18.86, -12.05, 2.05, -18.82, 0x2f5d8a, { collide: false });
        const c = document.createElement('canvas');
        c.width = 256;
        c.height = 192;
        const g = c.getContext('2d')!;
        g.fillStyle = '#bfe8ff';
        g.fillRect(0, 0, 256, 192);
        g.fillStyle = '#7fd0ff';
        for (let y = 130; y < 192; y += 14) g.fillRect(0, y, 256, 6);
        // big blocky fish
        g.fillStyle = '#ff9f45';
        g.fillRect(60, 60, 110, 56);
        g.fillRect(170, 70, 22, 36);
        g.beginPath();
        g.moveTo(60, 88);
        g.lineTo(26, 58);
        g.lineTo(26, 118);
        g.closePath();
        g.fill();
        g.fillStyle = '#fff';
        g.fillRect(150, 72, 16, 16);
        g.fillStyle = '#22304a';
        g.fillRect(156, 76, 8, 8);
        g.fillStyle = '#ffd23f';
        g.fillRect(96, 60, 10, 56);
        g.fillRect(124, 60, 10, 56);
        g.fillStyle = '#22304a';
        g.font = '800 34px "Baloo 2", system-ui, sans-serif';
        g.textAlign = 'center';
        g.fillText('IKAN!', 128, 40);
        const tex = new THREE.CanvasTexture(c);
        tex.colorSpace = THREE.SRGBColorSpace;
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.98, 0.7), new THREE.MeshLambertMaterial({ map: tex }));
        m.position.set(-12.6, 1.65, -18.815);
        objs.push(m);
        break;
      }
      case 'lampu': {
        const x = -15.75, z = -13.75;
        S.box(x, 0, z, 0.36, 0.06, 0.36, 0x6d4c41);
        S.box(x, 0.06, z, 0.07, 0.95, 0.07, 0x8d6e63, { collide: false });
        S.mm(x - 0.06, 0.06, z - 0.06, x + 0.06, 1.0, z + 0.06, 0, { visible: false });
        S.box(x, 1.0, z, 0.42, 0.34, 0.42, 0xfff1b8, { collide: false, jitter: 0 });
        S.box(x, 1.32, z, 0.3, 0.06, 0.3, 0xffe082, { collide: false, jitter: 0 });
        // warm glow on the floor (soft sprite)
        const cv = document.createElement('canvas');
        cv.width = cv.height = 64;
        const g = cv.getContext('2d')!;
        const gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
        gr.addColorStop(0, 'rgba(255,214,120,0.75)');
        gr.addColorStop(1, 'rgba(255,214,120,0)');
        g.fillStyle = gr;
        g.fillRect(0, 0, 64, 64);
        const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
        glow.rotation.x = -Math.PI / 2;
        glow.position.set(x, 0.035, z - 0.2);
        objs.push(glow);
        break;
      }
      case 'rak': {
        const x0 = -6.78, x1 = -6.3, z0 = -16.1, z1 = -14.9, y = 1.6;
        S.mm(x0, y, z0, x1, y + 0.08, z1, 0xa8733f, { top: 0xd4a46a });
        S.mm(x1 - 0.06, y - 0.3, z0 + 0.1, x1, y, z0 + 0.16, 0x7a4f2a, { collide: false });
        S.mm(x1 - 0.06, y - 0.3, z1 - 0.16, x1, y, z1 - 0.1, 0x7a4f2a, { collide: false });
        // books + little cat statue
        const bc = [0xe57373, 0x64b5f6, 0xffd54f];
        for (let i = 0; i < 3; i++) S.mm(x1 - 0.3, y + 0.08, z1 - 0.12 - i * 0.09, x1 - 0.05, y + 0.38 - i * 0.04, z1 - 0.04 - i * 0.09, bc[i], { collide: false });
        S.box(x1 - 0.18, y + 0.08, z1 - 0.48, 0.14, 0.16, 0.12, 0xf3c33c, { collide: false });
        S.box(x1 - 0.18, y + 0.24, z1 - 0.48, 0.12, 0.1, 0.12, 0xf3c33c, { collide: false });
        S.box(x1 - 0.18, y + 0.34, z1 - 0.44, 0.03, 0.04, 0.03, 0xf3c33c, { collide: false });
        S.box(x1 - 0.18, y + 0.34, z1 - 0.52, 0.03, 0.04, 0.03, 0xf3c33c, { collide: false });
        break;
      }
      case 'akuarium': {
        const x = -8.0, z = -18.45;
        S.box(x, 0, z, 0.8, 0.6, 0.6, 0x5d4037, { top: 0x795548 });
        S.box(x, 0.6, z, 0.72, 0.04, 0.46, 0x37474f, { collide: false });
        S.box(x, 0.64, z, 0.66, 0.06, 0.4, 0xf3dfa5, { collide: false, jitter: 0 }); // sand
        S.box(x - 0.2, 0.7, z - 0.08, 0.04, 0.22, 0.04, 0x43a047, { collide: false });
        S.box(x - 0.14, 0.7, z - 0.1, 0.04, 0.15, 0.04, 0x66bb6a, { collide: false });
        S.box(x + 0.18, 0.7, z - 0.06, 0.1, 0.07, 0.08, 0x9e9e9e, { collide: false });
        S.box(x, 1.06, z, 0.72, 0.04, 0.46, 0x37474f, { collide: false });
        S.mm(x - 0.36, 0.6, z - 0.23, x + 0.36, 1.1, z + 0.23, 0, { visible: false });
        const glass = mbox(0.68, 0.42, 0.42, new THREE.MeshLambertMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.38, depthWrite: false }), x, 0.85, z);
        glass.renderOrder = 2;
        objs.push(glass);
        const fc = [0xff8f00, 0xff5c8a, 0xffd54f];
        for (let i = 0; i < 3; i++) {
          const f = new THREE.Group();
          f.add(mbox(0.09, 0.05, 0.03, fc[i]));
          f.add(mbox(0.03, 0.05, 0.02, fc[i], -0.06, 0, 0));
          f.add(mbox(0.012, 0.012, 0.034, 0x111111, 0.03, 0.01, 0));
          f.position.set(x, 0.8 + i * 0.08, z);
          f.userData.k = i;
          this.fish.push(f);
          objs.push(f);
        }
        break;
      }
    }
  }

  // ---------------- interaction ----------------
  setupInteract() {
    const I = ctx.interact;
    const on = (id: string) => () => decorPlaced(id) && ctx.mode === 'play' && !ctx.cat.carrying;
    const face = (p: THREE.Vector3) => {
      const b = ctx.cat.body;
      ctx.cat.yaw = Math.atan2(p.x - b.x, p.z - b.z);
    };
    const happy = (t = 1.2) => {
      ctx.catHappy = true;
      ctx.after(t, () => (ctx.catHappy = false));
    };
    const tiang = DECOR_BY.tiang.pos;
    I.add({
      id: 'decor_tiang',
      label: 'a_scratch',
      icon: '🪵',
      pos: tiang,
      r: 0.85,
      enabled: on('tiang'),
      act: () => {
        face(tiang);
        sfx.scratch();
        ctx.cat.doAction('scratch', 1.1, () => {
          happy();
          ctx.fx.sparkle(tiang.x, 0.9, tiang.z, 6);
          ctx.fx.hearts(ctx.cat.body.x, ctx.cat.body.y + 0.7, ctx.cat.body.z, 2);
          sfx.sparkle();
          ctx.ui.toast('🪵 ' + L({ id: 'Kuku jadi rapi! Nggak perlu cakar gorden.', en: 'Nice claws! No need for the curtains.' }));
        });
      },
    });
    const bed = V(-8.3, 0.2, -14.4);
    I.add({
      id: 'decor_kasur',
      label: 'a_nap',
      icon: '😴',
      pos: V(-8.3, 0.1, -14.35),
      r: 0.95,
      enabled: on('kasur'),
      act: () => {
        ctx.cat.sleepAt(bed, Math.PI);
        ctx.ui.toast('🛏️ ' + tr('napToast'));
      },
    });
    I.add({
      id: 'decor_bola',
      label: 'a_kick',
      icon: '🧶',
      pos: this.ball.position,
      r: 0.75,
      yTol: 0.6,
      enabled: on('bola'),
      act: () => {
        face(this.ball.position);
        ctx.cat.doAction('paw', 0.35);
        sfx.swish();
        const f = ctx.cat.forward();
        this.ballV.set(f.x * rand(3.6, 4.6), 0, f.z * rand(3.6, 4.6));
        happy(0.8);
        ctx.after(0.15, () => sfx.rollThuds());
      },
    });
    I.add({
      id: 'decor_tikus',
      label: 'a_poke',
      icon: '🐭',
      pos: this.mouse.position,
      r: 0.7,
      enabled: on('tikus'),
      act: () => {
        face(this.mouse.position);
        ctx.cat.doAction('paw', 0.35);
        this.mouseHop = 0.6;
        sfx.tone(2200, 0.06, 'sine', 0.15, 0.05, 2600);
        sfx.tone(2400, 0.06, 'sine', 0.15, 0.16, 2900);
        ctx.fx.glyph(this.mouse.position.x, 0.45, this.mouse.position.z, '!', '#fff', { vy: 0.6, life: 0.8, scale: 0.25 });
        happy(0.8);
      },
    });
    const bowl = DECOR_BY.mangkuk.pos;
    I.add({
      id: 'decor_mangkuk',
      label: 'a_eat',
      icon: '🥣',
      pos: bowl,
      r: 0.85,
      enabled: on('mangkuk'),
      act: () => {
        face(bowl);
        sfx.eat();
        ctx.cat.doAction('eat', 1.2, () => {
          happy();
          ctx.fx.hearts(ctx.cat.body.x, ctx.cat.body.y + 0.7, ctx.cat.body.z, 3);
          ctx.ui.toast('🥣 ' + L({ id: 'Nyam! Kenyang.', en: 'Yum! Full tummy.' }));
        });
      },
    });
    const kardus = V(-12.6, 0, -18.25);
    I.add({
      id: 'decor_kardus',
      label: 'a_hide',
      icon: '📦',
      pos: V(-12.6, 0, -17.8),
      r: 0.85,
      enabled: on('kardus'),
      act: () => {
        ctx.cat.sleepAt(kardus, 0);
        ctx.ui.toast('📦 ' + L({ id: 'Ssst... ngumpet di kardus!', en: 'Shh... hiding in the box!' }));
      },
    });
    const tank = DECOR_BY.akuarium.pos;
    I.add({
      id: 'decor_akuarium',
      label: 'a_watch',
      icon: '🐠',
      pos: V(-8.0, 0, -17.95),
      r: 0.85,
      yTol: 0.8,
      enabled: on('akuarium'),
      act: () => {
        face(tank);
        this.fishFast = 2;
        ctx.cat.doAction('watch', 1.4, () => happy());
        sfx.plop();
        ctx.fx.glyph(tank.x, 1.15, tank.z, '○', '#d8f3ff', { vy: 0.5, life: 0.9, scale: 0.16, spread: 0.15 });
      },
    });
  }

  /** Napping in the cat bed also counts as "asleep at home" when Mama comes. */
  sleepingInBed() {
    const c = ctx.cat;
    return decorPlaced('kasur') && c.state === 'sleep' && Math.hypot(c.body.x + 8.3, c.body.z + 14.4) < 0.6;
  }

  anim(dt: number, t: number) {
    // yarn ball rolls with friction and bounces off walls/furniture
    if (decorPlaced('bola')) {
      const v = this.ballV;
      const sp = Math.hypot(v.x, v.z);
      if (sp > 0.02) {
        const b = this.ball.position;
        const body = { x: b.x, y: 0, z: b.z, vx: v.x, vy: 0, vz: v.z, r: 0.12, h: 0.24, onGround: true, stepH: 0.05, climbH: 0, g: 18 } as any;
        ctx.world.phys.move(body, dt);
        const ex = b.x + v.x * dt, ez = b.z + v.z * dt;
        if (Math.abs(body.x - ex) > 1e-4) v.x *= -0.6;
        if (Math.abs(body.z - ez) > 1e-4) v.z *= -0.6;
        b.x = body.x;
        b.z = body.z;
        b.y = Math.max(0, body.y) + 0.13;
        const k = Math.exp(-1.6 * dt);
        v.x *= k;
        v.z *= k;
        this.ball.rotation.x += (v.z / 0.12) * dt;
        this.ball.rotation.z -= (v.x / 0.12) * dt;
        // stay inside the living room
        if (b.x < -21.4 || b.x > -6.6 || b.z < -18.7 || b.z > -13.5) {
          b.x = clamp(b.x, -21.4, -6.6);
          b.z = clamp(b.z, -18.7, -13.5);
          v.multiplyScalar(-0.5);
        }
      } else v.set(0, 0, 0);
    }
    // toy mouse hop
    if (this.mouseHop > 0) {
      this.mouseHop = Math.max(0, this.mouseHop - dt);
      const k = this.mouseHop / 0.6;
      this.mouse.position.y = 0.03 + Math.sin(k * Math.PI) * 0.25;
      this.mouse.rotation.y += dt * 12;
    }
    // aquarium fish
    if (this.fish.length && decorPlaced('akuarium')) {
      this.fishFast = Math.max(0, this.fishFast - dt);
      const sp = 1 + this.fishFast * 1.5;
      for (const f of this.fish) {
        const k = f.userData.k as number;
        const a = t * (0.7 + k * 0.25) * sp + k * 2.1;
        f.position.x = -8.0 + Math.sin(a) * 0.24;
        f.position.z = -18.45 + Math.cos(a * 0.7) * 0.1;
        f.position.y = 0.78 + k * 0.08 + Math.sin(t * 1.3 + k) * 0.03;
        f.rotation.y = Math.cos(a) > 0 ? 0 : Math.PI;
      }
    }
  }
}
