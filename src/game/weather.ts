// Weather & time of day ("Cuaca & waktu").
//
// Every new day rolls a day type:
//   'cerah' (sunny, default, ~65%), 'hujan' (rain, ~20%), 'malam' (night, ~15%).
// The first FIRST_SUNNY_DAYS days are always sunny, and the setting
// "Cuaca: Selalu cerah" (save.settings.weather === 'cerah') forces sunny days.
//
// Other systems read the current day type from `ctx.weather` (kept in sync by
// WeatherSystem.apply) or with the helper `weatherNow()` below, e.g.
//   if (weatherNow() === 'hujan') ...   // quests, fishing, NPC lines
// Debug/tests: set `window.__cat.forceWeather = 'hujan'` before a day starts.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ctx, rand, clamp } from '../ctx';
import { sfx } from '../audio';
import { tr } from '../i18n';
import type { Human } from '../entities/npc';

export type Weather = 'cerah' | 'hujan' | 'malam';
export const WEATHERS: Weather[] = ['cerah', 'hujan', 'malam'];
export const WEATHER_ICON: Record<Weather, string> = { cerah: '☀️', hujan: '🌧️', malam: '🌙' };
/** Localized day-type name, e.g. 'Hari Hujan' */
export const weatherName = (w: Weather) => tr('wx_' + w);
const FIRST_SUNNY_DAYS = 3;

/** Current day type ('cerah' when no day is running yet). */
export function weatherNow(): Weather {
  return (ctx.weather as Weather) || 'cerah';
}

// Rain/night send the kids home (and rain the pigeons): don't roll those days
// while Lisa's active quest can only be finished with them.
const KIDS_ONLY = ['bola'];
const BIRDS = ['merpati_taman', 'merpati_atap'];
function blocked(d: any, prog: any, away: string[], hugBlocked: boolean) {
  if (!d) return false;
  if (d.type === 'event' && d.ev === 'hug') return hugBlocked;
  if (d.type === 'set' && d.set) {
    const done: string[] = prog?.set || [];
    const left = d.set.filter((id: string) => !done.includes(id) && !away.includes(id)).length;
    return done.length + left < d.goal;
  }
  return false;
}
// Lisa's quest, the friends' quests (Si Belang, Mpus) and today's daily challenges
function questNeeds(away: string[], hugBlocked: boolean) {
  const s = ctx.save;
  if (ctx.quests && s.quest.stage === 'active' && blocked(ctx.quests.q, s.quest.prog, away, hugBlocked)) return true;
  for (const g of Object.values(s.givers || {}) as any[]) if (g.stage === 'active' && blocked(g.gen, g.prog, away, hugBlocked)) return true;
  for (const e of (s.daily?.list || []) as any[]) if (e.stage === 'active' && blocked(e.q, e.prog, away, hugBlocked)) return true;
  return false;
}

/** Pick the day type for day `n`. */
export function rollWeather(n: number): Weather {
  const f = ctx.forceWeather as Weather | undefined;
  if (ctx.save.settings.weather === 'cerah') return 'cerah';
  if (f && WEATHERS.includes(f)) return f;
  if (n <= FIRST_SUNNY_DAYS) return 'cerah';
  const r = Math.random();
  let w: Weather = r < 0.65 ? 'cerah' : r < 0.85 ? 'hujan' : 'malam';
  if (w === 'hujan' && questNeeds([...KIDS_ONLY, ...BIRDS], true)) w = 'cerah';
  if (w === 'malam' && questNeeds(KIDS_ONLY, true)) w = 'cerah';
  return w;
}

function radialTex(inner: string, outer: string) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  gr.addColorStop(0, inner);
  gr.addColorStop(1, outer);
  g.fillStyle = gr;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const RAIN_MAX = 420;
const STAR_N = 260;
const FLY_MAX = 40;
const RR = 13; // rain box half size around the camera
const RH = 16; // rain box height

// spots where puddles form on rainy days (street, front path, park paths)
const PUDDLES: [number, number, number, number][] = [
  [-14, 0.024, -7.6, 0.75],
  [-25, 0.02, 1.4, 1.1],
  [-9, 0.02, -2.0, 0.9],
  [4.5, 0.02, 1.9, 1.2],
  [21, 0.02, -1.6, 1.0],
  [38, 0.02, 1.2, 1.1],
  [-11.5, 0.02, 9.5, 0.8],
  [-4, 0.02, 17, 0.9],
  [-11.4, 0.02, 20.5, 0.7],
  [4, 0.02, 17.2, 0.75],
];

export class WeatherSystem {
  kind: Weather = 'cerah';
  rain: THREE.LineSegments;
  rainPos: Float32Array;
  rainSpd = new Float32Array(RAIN_MAX);
  puddles: THREE.Group = new THREE.Group();
  stars: THREE.Points;
  moon = new THREE.Group();
  windows: THREE.Mesh;
  lampHeads: THREE.Mesh;
  lampHalo: THREE.Points;
  lampPools: THREE.Mesh;
  flies: THREE.Points;
  flyBase: Float32Array;
  flyPos: Float32Array;
  flyCol: Float32Array;
  catGlow: THREE.Mesh;
  wet = 0;
  wetShown = -1;
  wetToast = false;
  baseCol: number[] | null = null;
  splashT = 0;
  baseSpeed = new Map<Human, number>();
  baseRange = new Map<Human, number>();
  baseChase = new Map<Human, number>();
  private wetTint = new THREE.Color(0.3, 0.38, 0.5);

  constructor() {
    const scene = ctx.scene as THREE.Scene;
    const W = ctx.world;
    // ---- rain: streaks that wrap around the camera (one draw call) ----
    this.rainPos = new Float32Array(RAIN_MAX * 6);
    for (let i = 0; i < RAIN_MAX; i++) {
      const x = rand(-RR, RR), y = rand(0, RH), z = rand(-RR, RR);
      this.rainPos.set([x, y, z, x + 0.08, y + 0.75, z + 0.03], i * 6);
      this.rainSpd[i] = rand(15, 20);
    }
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.BufferAttribute(this.rainPos, 3));
    this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0xf2f7ff, transparent: true, opacity: 0.75, depthWrite: false }));
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 3;
    scene.add(this.rain);
    // ---- puddles: two merged layers (dark water + light sheen) ----
    const pg: THREE.BufferGeometry[] = [], hg: THREE.BufferGeometry[] = [];
    for (const [x, y, z, r] of PUDDLES) {
      const a = new THREE.CircleGeometry(r, 14).rotateX(-Math.PI / 2).scale(1, 1, 0.72).translate(x, y, z);
      const b = new THREE.CircleGeometry(r * 0.45, 10).rotateX(-Math.PI / 2).scale(1.4, 1, 0.5).translate(x - r * 0.2, y + 0.004, z - r * 0.15);
      pg.push(a);
      hg.push(b);
    }
    const pm = new THREE.Mesh(mergeGeometries(pg), new THREE.MeshLambertMaterial({ color: 0x5f7f9e, transparent: true, opacity: 0.62, depthWrite: false }));
    const hm = new THREE.Mesh(mergeGeometries(hg), new THREE.MeshBasicMaterial({ color: 0xc8dcf0, transparent: true, opacity: 0.35, depthWrite: false }));
    pm.renderOrder = hm.renderOrder = 1;
    this.puddles.add(pm, hm);
    scene.add(this.puddles);
    // ---- night sky: stars + moon (follow the camera, never fogged) ----
    const sp = new Float32Array(STAR_N * 3);
    for (let i = 0; i < STAR_N; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.12 + Math.random() * 1.3;
      sp[i * 3] = Math.cos(a) * Math.cos(e) * 75;
      sp[i * 3 + 1] = Math.sin(e) * 75;
      sp[i * 3 + 2] = Math.sin(a) * Math.cos(e) * 75;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xfff8d8, size: 2.2, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.9, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);
    const moonMat = new THREE.MeshBasicMaterial({ color: 0xfff6c8, fog: false });
    const moon = new THREE.Mesh(new THREE.BoxGeometry(5, 5, 5), moonMat);
    const crater = new THREE.MeshBasicMaterial({ color: 0xe8dca8, fog: false });
    for (const [x, y, s] of [[-1, 1, 1.2], [1.2, -0.6, 1], [-0.4, -1.4, 0.7]]) {
      const c = new THREE.Mesh(new THREE.BoxGeometry(s, s, 0.2), crater);
      c.position.set(x, y, 2.55);
      moon.add(c);
    }
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTex('rgba(255,246,200,0.55)', 'rgba(255,246,200,0)'), fog: false, depthWrite: false, transparent: true }));
    halo.scale.set(22, 22, 1);
    this.moon.add(halo, moon);
    scene.add(this.moon);
    // ---- glowing windows (one merged mesh) ----
    const indoor = W.glow.indoor as { x0: number; z0: number; x1: number; z1: number }[];
    const wg: THREE.BufferGeometry[] = [];
    for (const w of W.glow.windows) {
      if (indoor.some((r) => w.px > r.x0 && w.px < r.x1 && w.pz > r.z0 && w.pz < r.z1)) continue;
      wg.push(new THREE.BoxGeometry(w.x1 - w.x0, w.y1 - w.y0, w.z1 - w.z0).translate((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2, (w.z0 + w.z1) / 2));
    }
    this.windows = new THREE.Mesh(mergeGeometries(wg), new THREE.MeshBasicMaterial({ color: 0xffd47a }));
    scene.add(this.windows);
    // ---- street lamps: bright heads + soft halo + light pool on the ground ----
    const lh: THREE.BufferGeometry[] = [], lp: THREE.BufferGeometry[] = [];
    const hp = new Float32Array(W.glow.lamps.length * 3);
    W.glow.lamps.forEach((p: THREE.Vector3, i: number) => {
      lh.push(new THREE.BoxGeometry(0.44, 0.16, 0.26).translate(p.x, p.y + 0.06, p.z));
      const onWalk = Math.abs(p.z) > 3.4 && Math.abs(p.z) < 5.2;
      lp.push(new THREE.CircleGeometry(onWalk ? 1.6 : 2.2, 16).rotateX(-Math.PI / 2).translate(p.x, onWalk ? 0.162 : 0.03, p.z));
      hp.set([p.x, p.y - 0.1, p.z], i * 3);
    });
    this.lampHeads = new THREE.Mesh(mergeGeometries(lh), new THREE.MeshBasicMaterial({ color: 0xfff4c0 }));
    scene.add(this.lampHeads);
    this.lampPools = new THREE.Mesh(mergeGeometries(lp), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,220,140,0.55)', 'rgba(255,220,140,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lampPools.renderOrder = 2;
    scene.add(this.lampPools);
    const hgeo = new THREE.BufferGeometry();
    hgeo.setAttribute('position', new THREE.BufferAttribute(hp, 3));
    this.lampHalo = new THREE.Points(hgeo, new THREE.PointsMaterial({ map: radialTex('rgba(255,230,160,0.9)', 'rgba(255,230,160,0)'), size: 3.2, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.lampHalo.renderOrder = 4;
    scene.add(this.lampHalo);
    // ---- fireflies in the park ----
    this.flyBase = new Float32Array(FLY_MAX * 4);
    this.flyPos = new Float32Array(FLY_MAX * 3);
    this.flyCol = new Float32Array(FLY_MAX * 3);
    for (let i = 0; i < FLY_MAX; i++) {
      let x = 0, z = 0;
      do {
        x = rand(-28, 10);
        z = rand(7, 37);
      } while (x > -26.5 && x < -14.5 && z > 18.5 && z < 31.5 && Math.random() < 0.6); // fewer over the pond
      this.flyBase.set([x, rand(0.4, 2.2), z, rand(0, 100)], i * 4);
    }
    const fg = new THREE.BufferGeometry();
    fg.setAttribute('position', new THREE.BufferAttribute(this.flyPos, 3));
    fg.setAttribute('color', new THREE.BufferAttribute(this.flyCol, 3));
    this.flies = new THREE.Points(fg, new THREE.PointsMaterial({ map: radialTex('rgba(255,255,255,1)', 'rgba(255,255,255,0)'), size: 0.45, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.flies.frustumCulled = false;
    this.flies.renderOrder = 4;
    scene.add(this.flies);
    // ---- soft glow ring under the cat at night ----
    this.catGlow = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.7), new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,236,170,0.75)', 'rgba(255,236,170,0)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.catGlow.rotation.x = -Math.PI / 2;
    this.catGlow.renderOrder = 2;
    scene.add(this.catGlow);
    this.apply('cerah');
  }

  /** Switch the whole world to a day type (called by Day.resetWorld, and with 'cerah' for menus). */
  apply(kind: Weather) {
    this.kind = kind;
    ctx.weather = kind;
    const rain = kind === 'hujan', night = kind === 'malam';
    ctx.sky.setMode(kind);
    // rain closes the view in a little (also cheaper to draw)
    const fog = ctx.scene.fog as THREE.Fog;
    const low = ctx.save.settings.quality === 'low';
    fog.near = (low ? 28 : 45) * (rain ? 0.6 : 1);
    fog.far = (low ? 75 : 120) * (rain ? 0.7 : 1);
    this.rain.visible = rain;
    this.puddles.visible = rain;
    this.stars.visible = this.moon.visible = night;
    this.windows.visible = night;
    this.lampHeads.visible = this.lampHalo.visible = this.lampPools.visible = night;
    this.flies.visible = night;
    this.catGlow.visible = night;
    this.setWet(0);
    this.wetToast = false;
    // adults: umbrellas + slower in the rain; at night Bu Siti is asleep and everyone hears/sees less
    const umb: Record<string, number> = { siti: 0xff7043, ujang: 0x1e88e5, tini: 0xfdd835, satpam: 0x455a64, buwarung: 0x43a047 };
    for (const h of ctx.npcs as Human[]) {
      if (!this.baseSpeed.has(h)) {
        this.baseSpeed.set(h, h.speed);
        this.baseRange.set(h, h.range);
        this.baseChase.set(h, h.chaseSpeed);
      }
      h.chaseSpeed = this.baseChase.get(h)! * (rain ? 0.85 : 1);
      h.speed = this.baseSpeed.get(h)! * (rain ? 0.72 : 1);
      h.range = this.baseRange.get(h)! * (night ? 0.7 : 1);
      h.hearK = night ? 0.55 : 1;
      h.model.setUmbrella(rain, umb[h.name]);
      h.active = !(night && h.name === 'siti');
    }
    ctx.day?.mama.model.setUmbrella(rain, 0xf06292);
    // kids stay home when it rains or at night (no ball game)
    ctx.kids.setAway(rain || night);
    // pigeons hide from the rain
    ctx.flocks[0].setHidden(rain);
    ctx.flocks[1].setHidden(rain);
  }

  setWet(w: number) {
    this.wet = w;
    const q = Math.round(w * 20) / 20;
    if (q === this.wetShown) return;
    this.wetShown = q;
    const m = ctx.cat.model;
    const mats = [m.furMat, m.lightMat, m.pawMat, m.tailTipMat, m.tailMidMat];
    if (q > 0 && !this.baseCol) this.baseCol = mats.map((x) => x.color.getHex());
    if (!this.baseCol) return;
    if (q === 0) {
      // dry again: restore the real look (also picks up any outfit change)
      this.baseCol = null;
      m.setLook(m.look);
      return;
    }
    const k = 1 - 0.3 * q;
    mats.forEach((x, i) => x.color.setHex(this.baseCol![i]).multiplyScalar(k).lerp(this.wetTint, 0.12 * q));
  }

  ambience() {
    const on = (ctx.mode === 'play' || ctx.mode === 'cutscene') && (!ctx.paused || !!ctx.photoMode); // photo mode: rain freezes in the shot, sound keeps going
    sfx.setAmbience(!on ? 'none' : this.kind === 'hujan' ? 'rain' : this.kind === 'malam' ? 'night' : 'none');
  }

  update(dt: number) {
    const cam = ctx.camera as THREE.PerspectiveCamera;
    const cat = ctx.cat;
    const b = cat.body;
    const low = ctx.save.settings.quality === 'low';
    const t = ctx.time;
    this.ambience();
    const home = (ctx.world.glow.indoor as any[]).some((r) => b.x > r.x0 && b.x < r.x1 && b.z > r.z0 && b.z < r.z1);
    if (this.kind === 'hujan') {
      // rain streaks: fall, wrap in a box around the camera (world space, so walking feels right)
      const n = low ? 170 : RAIN_MAX;
      this.rain.geometry.setDrawRange(0, n * 2);
      this.rain.visible = !home || cam.position.y > 3.4;
      const P = this.rainPos;
      const cx = cam.position.x, cy = cam.position.y - 5, cz = cam.position.z;
      for (let i = 0; i < n; i++) {
        const o = i * 6;
        let y = P[o + 1] - this.rainSpd[i] * dt;
        let x = P[o] + 1.1 * dt;
        let z = P[o + 2];
        if (y < cy) y += RH;
        else if (y > cy + RH) y -= RH;
        if (x < cx - RR) x += RR * 2;
        else if (x > cx + RR) x -= RR * 2;
        if (z < cz - RR) z += RR * 2;
        else if (z > cz + RR) z -= RR * 2;
        P[o] = x;
        P[o + 1] = y;
        P[o + 2] = z;
        P[o + 3] = x + 0.08;
        P[o + 4] = y + 0.75;
        P[o + 5] = z + 0.03;
      }
      (this.rain.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      // puddle splashes
      this.splashT -= dt;
      if (ctx.mode === 'play' && b.onGround && cat.speed01 > 0.15 && this.splashT < 0 && b.y < 0.3) {
        for (const [x, , z, r] of PUDDLES) {
          const dx = (b.x - x) / r, dz = (b.z - z) / (r * 0.72);
          if (dx * dx + dz * dz < 1) {
            this.splashT = 0.32 - cat.speed01 * 0.12;
            ctx.fx.burst(b.x, 0.06, b.z, 0x9cc8ee, 5, { speed: 1.4, up: 2.2, size: 0.05, life: 0.5, floor: 0.03 });
            sfx.puddle();
            ctx.quests?.onEvent?.('puddle');
            break;
          }
        }
      }
      // the cat gets wet outside, dries indoors
      if (ctx.mode === 'play') {
        const covered = home || ctx.world.phys.ceilAt(b.x, b.z, 0.05, b.y + 0.6) < b.y + 8;
        let w = this.wet;
        if (home) w -= dt * 0.22;
        else if (!covered) w += dt * 0.09;
        else w -= dt * 0.03;
        w = clamp(w, 0, 1);
        if (w > 0.6 && !this.wetToast) {
          this.wetToast = true;
          ctx.ui.toast('💧 ' + tr('wetCat'), 3);
        }
        if (this.wetToast && w === 0 && this.wet > 0) {
          this.wetToast = false;
          ctx.ui.toast('✨ ' + tr('dryCat'), 2.4);
          ctx.fx.sparkle(b.x, b.y + 0.5, b.z, 5);
        }
        this.setWet(w);
        if (w > 0.25 && Math.random() < dt * w * 5) ctx.fx.burst(b.x + rand(-0.15, 0.15), b.y + 0.35, b.z + rand(-0.15, 0.15), 0x8fc6f0, 1, { speed: 0.2, up: 0.2, size: 0.035, life: 0.5, g: 9, floor: b.y + 0.02 });
      }
    }
    if (this.kind === 'malam') {
      this.stars.position.copy(cam.position);
      this.moon.position.set(cam.position.x - 28, cam.position.y + 42, cam.position.z - 48);
      this.moon.lookAt(cam.position);
      (this.stars.material as THREE.PointsMaterial).opacity = 0.75 + Math.sin(t * 1.3) * 0.15;
      const n = low ? 20 : FLY_MAX;
      this.flies.geometry.setDrawRange(0, n);
      const F = this.flyBase, P = this.flyPos, C = this.flyCol;
      for (let i = 0; i < n; i++) {
        const o = i * 4, ph = F[o + 3];
        P[i * 3] = F[o] + Math.sin(t * 0.37 + ph) * 1.4 + Math.sin(t * 1.1 + ph * 2) * 0.3;
        P[i * 3 + 1] = F[o + 1] + Math.sin(t * 0.9 + ph * 3) * 0.35;
        P[i * 3 + 2] = F[o + 2] + Math.cos(t * 0.31 + ph) * 1.4;
        const k = Math.max(0, Math.sin(t * 1.7 + ph * 5)) * 0.85 + 0.15;
        C[i * 3] = 0.85 * k;
        C[i * 3 + 1] = 1.0 * k;
        C[i * 3 + 2] = 0.35 * k;
      }
      (this.flies.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (this.flies.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      this.catGlow.visible = cat.model.root.visible && ctx.mode !== 'menu';
      this.catGlow.position.set(cat.shadow.position.x, cat.shadow.position.y + 0.006, cat.shadow.position.z);
    }
  }
}
