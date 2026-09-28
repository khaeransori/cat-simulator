import * as THREE from 'three';
import { ctx } from '../ctx';

interface Bubble {
  el: HTMLDivElement;
  obj: THREE.Object3D;
  yOff: number;
  ttl: number;
  key: string;
}

// Speech / emote bubbles in the DOM, pinned above 3D objects.
export class Bubbles {
  layer: HTMLElement;
  list: Bubble[] = [];
  v = new THREE.Vector3();

  constructor(layer: HTMLElement) {
    this.layer = layer;
  }

  say(obj: THREE.Object3D, text: string, o: { ttl?: number; y?: number; kind?: 'speech' | 'emote' | 'shout' | 'lisa'; key?: string } = {}) {
    const key = o.key ?? obj.uuid;
    this.clear(key);
    const el = document.createElement('div');
    el.className = 'bubble ' + (o.kind ?? 'speech');
    el.textContent = text;
    this.layer.appendChild(el);
    const b = { el, obj, yOff: o.y ?? 2.5, ttl: o.ttl ?? 2.5, key };
    this.list.push(b);
    return b;
  }

  clear(key: string) {
    for (let i = this.list.length - 1; i >= 0; i--)
      if (this.list[i].key === key) {
        this.list[i].el.remove();
        this.list.splice(i, 1);
      }
  }

  clearAll() {
    for (const b of this.list) b.el.remove();
    this.list.length = 0;
  }

  update(dt: number, cam: THREE.Camera, w: number, h: number) {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const b = this.list[i];
      b.ttl -= dt;
      if (b.ttl <= 0) {
        b.el.remove();
        this.list.splice(i, 1);
        continue;
      }
      b.obj.getWorldPosition(this.v);
      this.v.y += b.yOff;
      const d = this.v.distanceTo(cam.position);
      this.v.project(cam);
      if (this.v.z > 1 || d > 30) {
        b.el.style.display = 'none';
        continue;
      }
      b.el.style.display = '';
      const x = (this.v.x * 0.5 + 0.5) * w;
      const y = (-this.v.y * 0.5 + 0.5) * h;
      b.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -100%)`;
      b.el.style.opacity = String(Math.min(1, b.ttl * 3));
    }
    void ctx;
  }
}
