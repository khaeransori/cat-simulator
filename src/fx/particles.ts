import * as THREE from 'three';
import { ctx, rand } from '../ctx';
import { boxGeo } from '../world/builder';

// Glyph textures drawn on a canvas (hearts, stars, Z, sparkles, notes).
const texCache = new Map<string, THREE.Texture>();
export function glyphTex(ch: string, color = '#ffffff', outline = '#3b2a1a') {
  const k = ch + color + outline;
  let t = texCache.get(k);
  if (t) return t;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  g.font = 'bold 48px "Baloo 2", system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.lineWidth = 8;
  g.lineJoin = 'round';
  g.strokeStyle = outline;
  g.strokeText(ch, 32, 36);
  g.fillStyle = color;
  g.fillText(ch, 32, 36);
  t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.set(k, t);
  return t;
}

interface Part {
  m: THREE.Mesh;
  vx: number;
  vy: number;
  vz: number;
  rx: number;
  ry: number;
  life: number;
  max: number;
  g: number;
  floor: number;
  bounce: boolean;
  size: number;
  shrink: boolean;
}
interface Spr {
  s: THREE.Sprite;
  vx: number;
  vy: number;
  vz: number;
  life: number;
  max: number;
  scale: number;
  wobble: number;
}

export class FX {
  parts: Part[] = [];
  free: THREE.Mesh[] = [];
  sprites: Spr[] = [];
  freeS: THREE.Sprite[] = [];
  scene: THREE.Scene;
  geo = boxGeo(1, 1, 1);

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  burst(x: number, y: number, z: number, color: number, count: number, o: { speed?: number; size?: number; life?: number; g?: number; up?: number; floor?: number; shrink?: boolean; spread?: number } = {}) {
    const lowQ = ctx.save?.settings?.quality === 'low';
    if (lowQ) count = Math.ceil(count / 2);
    for (let i = 0; i < count; i++) {
      let m = this.free.pop();
      if (!m) {
        m = new THREE.Mesh(this.geo, new THREE.MeshLambertMaterial({ color }));
        this.scene.add(m);
      }
      (m.material as THREE.MeshLambertMaterial).color.setHex(color);
      m.visible = true;
      const s = (o.size ?? 0.08) * rand(0.6, 1.3);
      m.scale.set(s, s, s);
      const sp = (o.spread ?? 0.1);
      m.position.set(x + rand(-sp, sp), y + rand(-sp * 0.5, sp * 0.5), z + rand(-sp, sp));
      const a = Math.random() * Math.PI * 2;
      const v = (o.speed ?? 2) * rand(0.4, 1);
      this.parts.push({
        m,
        vx: Math.cos(a) * v,
        vz: Math.sin(a) * v,
        vy: (o.up ?? 3) * rand(0.5, 1.2),
        rx: rand(-10, 10),
        ry: rand(-10, 10),
        life: (o.life ?? 1.2) * rand(0.7, 1.2),
        max: 0,
        g: o.g ?? 12,
        floor: o.floor ?? -100,
        bounce: true,
        size: s,
        shrink: o.shrink !== false,
      });
      const p = this.parts[this.parts.length - 1];
      p.max = p.life;
    }
  }

  glyph(x: number, y: number, z: number, ch: string, color: string, o: { vy?: number; life?: number; scale?: number; spread?: number; wobble?: number; vx?: number; vz?: number } = {}) {
    let s = this.freeS.pop();
    if (!s) {
      s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      this.scene.add(s);
    }
    const mat = s.material as THREE.SpriteMaterial;
    mat.map = glyphTex(ch, color);
    mat.opacity = 1;
    mat.needsUpdate = true;
    s.visible = true;
    const sp = o.spread ?? 0;
    s.position.set(x + rand(-sp, sp), y, z + rand(-sp, sp));
    const sc = o.scale ?? 0.3;
    s.scale.set(sc, sc, sc);
    s.renderOrder = 5;
    this.sprites.push({ s, vx: o.vx ?? 0, vy: o.vy ?? 0.6, vz: o.vz ?? 0, life: o.life ?? 1.4, max: o.life ?? 1.4, scale: sc, wobble: o.wobble ?? 0 });
  }

  hearts(x: number, y: number, z: number, n = 4) {
    for (let i = 0; i < n; i++) this.glyph(x, y + i * 0.05, z, '♥', '#ff5d8f', { vy: rand(0.6, 1.1), spread: 0.25, life: 1.3, scale: 0.28, wobble: 2 });
  }
  stars(x: number, y: number, z: number, n = 5) {
    for (let i = 0; i < n; i++) this.glyph(x, y, z, '★', '#ffd84a', { vy: rand(0.8, 1.6), vx: rand(-1, 1), vz: rand(-1, 1), life: 0.9, scale: 0.3 });
  }
  zzz(x: number, y: number, z: number) {
    this.glyph(x, y, z, 'Z', '#ffffff', { vy: 0.45, vx: 0.15, life: 1.8, scale: 0.26, wobble: 1.5 });
  }
  notes(x: number, y: number, z: number) {
    this.glyph(x, y, z, '♪', '#7ad3ff', { vy: 0.8, spread: 0.2, life: 1.2, scale: 0.28, wobble: 2 });
  }
  sparkle(x: number, y: number, z: number, n = 6) {
    for (let i = 0; i < n; i++) this.glyph(x, y, z, '✦', '#fff4a8', { vy: rand(0.4, 1.2), vx: rand(-0.8, 0.8), vz: rand(-0.8, 0.8), life: 0.8, scale: 0.22 });
  }

  update(dt: number) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.m.visible = false;
        this.free.push(p.m);
        this.parts.splice(i, 1);
        continue;
      }
      p.vy -= p.g * dt;
      p.m.position.x += p.vx * dt;
      p.m.position.y += p.vy * dt;
      p.m.position.z += p.vz * dt;
      if (p.m.position.y < p.floor + p.size / 2) {
        p.m.position.y = p.floor + p.size / 2;
        if (p.bounce) {
          p.vy = Math.abs(p.vy) * 0.3;
          p.vx *= 0.5;
          p.vz *= 0.5;
          p.rx *= 0.3;
          p.ry *= 0.3;
          if (Math.abs(p.vy) < 0.3) p.bounce = false;
        } else {
          p.vy = 0;
          p.vx *= 0.8;
          p.vz *= 0.8;
        }
      }
      p.m.rotation.x += p.rx * dt;
      p.m.rotation.y += p.ry * dt;
      if (p.shrink) {
        const k = Math.min(1, p.life / (p.max * 0.4));
        const s = p.size * k;
        p.m.scale.set(s, s, s);
      }
    }
    for (let i = this.sprites.length - 1; i >= 0; i--) {
      const s = this.sprites[i];
      s.life -= dt;
      if (s.life <= 0) {
        s.s.visible = false;
        this.freeS.push(s.s);
        this.sprites.splice(i, 1);
        continue;
      }
      s.s.position.x += (s.vx + (s.wobble ? Math.sin(s.life * 6) * 0.3 * s.wobble * 0.3 : 0)) * dt;
      s.s.position.y += s.vy * dt;
      s.s.position.z += s.vz * dt;
      const k = s.life / s.max;
      (s.s.material as THREE.SpriteMaterial).opacity = Math.min(1, k * 2.5);
      const sc = s.scale * (0.6 + 0.4 * Math.min(1, (1 - k) * 6));
      s.s.scale.set(sc, sc, sc);
    }
  }
}
