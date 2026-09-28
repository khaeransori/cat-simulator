import * as THREE from 'three';
import { ctx, angleDiff } from '../ctx';
import { glyphTex } from '../fx/particles';

export interface Interactable {
  id: string;
  label: string | (() => string); // i18n key for the action label
  icon: string | (() => string);
  pos: THREE.Vector3;
  r: number;
  yTol?: number;
  dist?: () => number; // custom distance
  enabled: () => boolean;
  act: () => void;
  mischief?: string; // shows sparkle until done today
  priority?: number;
  facing?: boolean; // require roughly facing the target
}

export class InteractSystem {
  list: Interactable[] = [];
  current: Interactable | null = null;
  sparkles = new Map<string, THREE.Sprite>();
  marker: THREE.Sprite;

  constructor() {
    this.marker = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTex('▼', '#ffd84a'), transparent: true, depthTest: false }));
    this.marker.scale.set(0.3, 0.3, 0.3);
    this.marker.renderOrder = 10;
    ctx.scene.add(this.marker);
  }

  add(i: Interactable) {
    this.list.push(i);
    if (i.mischief) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glyphTex('✦', '#fff6b0', '#b8860b'), transparent: true, depthWrite: false }));
      s.scale.set(0.26, 0.26, 0.26);
      s.position.copy(i.pos).add(new THREE.Vector3(0, 0.75, 0));
      ctx.scene.add(s);
      this.sparkles.set(i.id, s);
    }
    return i;
  }

  update(dt: number) {
    const cat = ctx.cat;
    const b = cat.body;
    let best: Interactable | null = null;
    let bestS = 1e9;
    const canAct = ctx.mode === 'play' && (cat.state === 'free') && !ctx.dialogOpen;
    if (canAct) {
      for (const i of this.list) {
        if (!i.enabled()) continue;
        let d: number;
        if (i.dist) d = i.dist();
        else {
          if (Math.abs(b.y - i.pos.y) > (i.yTol ?? 0.7)) continue;
          d = Math.hypot(b.x - i.pos.x, b.z - i.pos.z);
        }
        if (d > i.r) continue;
        let s = d - (i.priority ?? 0) * 10;
        if (!i.dist) {
          const ang = Math.atan2(i.pos.x - b.x, i.pos.z - b.z);
          const ad = Math.abs(angleDiff(cat.yaw, ang));
          if (i.facing && ad > 1.6 && d > 0.5) continue;
          s += ad * 0.25;
        }
        if (s < bestS) {
          bestS = s;
          best = i;
        }
      }
    }
    this.current = best;
    // marker above selected target
    if (best && !best.dist) {
      this.marker.visible = true;
      this.marker.position.set(best.pos.x, best.pos.y + 0.75 + Math.sin(ctx.time * 6) * 0.06, best.pos.z);
    } else this.marker.visible = false;
    // sparkles on mischief not yet done today
    const doneToday: Set<string> = ctx.day?.doneToday || new Set();
    for (const i of this.list) {
      if (!i.mischief) continue;
      const s = this.sparkles.get(i.id)!;
      const vis = ctx.mode === 'play' && !doneToday.has(i.mischief) && i.enabled() && best !== i;
      s.visible = vis;
      if (vis) {
        const k = 0.2 + 0.08 * Math.sin(ctx.time * 4 + i.pos.x);
        s.scale.set(k, k, k);
        (s.material as THREE.SpriteMaterial).rotation = ctx.time * 0.8;
        s.position.set(i.pos.x, i.pos.y + 0.7 + Math.sin(ctx.time * 2 + i.pos.z) * 0.05, i.pos.z);
      }
    }
    void dt;
  }

  // move a sparkle when its prop moves (e.g. ball)
  moveSparkle(id: string, p: THREE.Vector3) {
    const it = this.list.find((i) => i.id === id);
    if (it) it.pos.copy(p);
  }
}
