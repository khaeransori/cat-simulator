import * as THREE from 'three';
import { ctx, rand } from '../ctx';
import { L, tr, type Pair } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { mbox } from '../world/builder';
import type { PropInfo } from '../world/map';

const P = (id: string, en: string): Pair => ({ id, en });

export interface MDef {
  id: string;
  area: 'rumah' | 'taman' | 'jalan' | 'pasar' | 'atap';
  icon: string;
  name: Pair;
  noise: number;
}

export const MISCHIEF: MDef[] = [
  { id: 'gelas', area: 'rumah', icon: '🥛', name: P('Jatuhin gelas', 'Knock over a glass'), noise: 9 },
  { id: 'pot_rumah', area: 'rumah', icon: '🪴', name: P('Jatuhin pot bunga', 'Topple a flowerpot'), noise: 9 },
  { id: 'tisu', area: 'rumah', icon: '🧻', name: P('Tarik gulungan tisu', 'Unroll the tissue'), noise: 0 },
  { id: 'laptop', area: 'rumah', icon: '💻', name: P('Tidur di laptop', 'Nap on the laptop'), noise: 0 },
  { id: 'ikan_dapur', area: 'rumah', icon: '🐟', name: P('Curi ikan goreng', 'Steal fried fish'), noise: 0 },
  { id: 'gorden', area: 'rumah', icon: '🪟', name: P('Cakar gorden', 'Shred the curtains'), noise: 3 },
  { id: 'pot_taman', area: 'taman', icon: '🌸', name: P('Jatuhin pot taman', 'Topple the park pot'), noise: 9 },
  { id: 'gali', area: 'taman', icon: '🌷', name: P('Gali taman bunga', 'Dig up the flower bed'), noise: 4 },
  { id: 'merpati_taman', area: 'taman', icon: '🕊️', name: P('Kagetin merpati', 'Spook the pigeons'), noise: 6 },
  { id: 'bola', area: 'taman', icon: '⚽', name: P('Curi bola anak-anak', "Steal the kids' ball"), noise: 0 },
  { id: 'anjing', area: 'jalan', icon: '🐕', name: P('Bikin Bleki menggonggong', 'Make Bleki bark'), noise: 0 },
  { id: 'koran', area: 'jalan', icon: '📰', name: P('Sobek koran Bu Siti', "Shred Mrs. Siti's paper"), noise: 4 },
  { id: 'sandal', area: 'jalan', icon: '🩴', name: P('Curi sandal', 'Steal a sandal'), noise: 0 },
  { id: 'motor', area: 'jalan', icon: '🛵', name: P('Tidur di jok motor', 'Nap on the motorbike'), noise: 14 },
  { id: 'pot_tetangga', area: 'jalan', icon: '🌻', name: P('Jatuhin pot tetangga', "Topple the neighbor's pot"), noise: 9 },
  { id: 'ikan_pasar', area: 'pasar', icon: '🐠', name: P('Curi ikan pasar', 'Steal a market fish'), noise: 0 },
  { id: 'ember', area: 'pasar', icon: '🪣', name: P('Tumpahin ember', 'Tip over a bucket'), noise: 8 },
  { id: 'tomat', area: 'pasar', icon: '🍅', name: P('Dorong keranjang tomat', 'Push the tomato basket'), noise: 9 },
  { id: 'jemuran', area: 'atap', icon: '👕', name: P('Jatuhin jemuran', 'Drop the laundry'), noise: 4 },
  { id: 'ikan_asin', area: 'atap', icon: '🐡', name: P('Curi ikan asin', 'Steal salted fish'), noise: 0 },
  { id: 'merpati_atap', area: 'atap', icon: '🐦', name: P('Kagetin merpati atap', 'Spook the roof pigeons'), noise: 6 },
];
export const MBY: Record<string, MDef> = Object.fromEntries(MISCHIEF.map((m) => [m.id, m]));
export const AREA_KEY: Record<string, string> = { rumah: 'ar_rumah', taman: 'ar_taman', jalan: 'ar_jalan', pasar: 'ar_pasar', atap: 'ar_atap' };

export function addCoins(n: number) {
  ctx.save.coins += n;
  if (ctx.day) ctx.day.coinsToday += n;
  ctx.ui?.coins(n);
  writeSave(ctx.save);
}

export function doMischief(id: string) {
  const def = MBY[id];
  if (!def) return;
  const day = ctx.day;
  const first = !ctx.save.mischief[id];
  const firstToday = !day.doneToday.has(id);
  ctx.save.mischief[id] = (ctx.save.mischief[id] || 0) + 1;
  day.doneToday.add(id);
  day.countToday++;
  if (def.area === 'rumah') day.homeMess = true;
  const cat = ctx.cat;
  cat.lastMischiefT = ctx.time;
  cat.lastMischiefPos.copy(cat.pos);
  if (def.noise) ctx.npcHear(cat.body.x, cat.body.z, def.noise);
  if (first) {
    sfx.jingle();
    ctx.ui.banner(def.icon, tr('newMischief'), L(def.name), 10);
    addCoins(10);
  } else if (firstToday) {
    sfx.coin();
    ctx.ui.toast(`${def.icon} ${L(def.name)}  +3`);
    addCoins(3);
  } else {
    ctx.ui.toast(`${def.icon} ${L(def.name)}`);
  }
  ctx.catHappy = true;
  ctx.after(1.2, () => (ctx.catHappy = false));
  ctx.quests.onMischief(id);
  writeSave(ctx.save);
}

// ---------- snapshot / reset of props ----------
interface Snap {
  o: THREE.Object3D;
  parent: THREE.Object3D | null;
  p: THREE.Vector3;
  r: THREE.Euler;
  s: THREE.Vector3;
  v: boolean;
}
const snaps: Snap[] = [];
function snapshot(root: THREE.Object3D) {
  root.traverse((o) => snaps.push({ o, parent: o.parent, p: o.position.clone(), r: o.rotation.clone(), s: o.scale.clone(), v: o.visible }));
}
export function resetProps() {
  for (const s of snaps) {
    if (s.parent && s.o.parent !== s.parent) s.parent.add(s.o);
    s.o.position.copy(s.p);
    s.o.rotation.copy(s.r);
    s.o.scale.copy(s.s);
    s.o.visible = s.v;
  }
  ctx.props.clear();
  drawLaptop(false);
  for (const l of ctx.world.props.motor.data.lights) (l.material as THREE.MeshLambertMaterial).emissive.setHex(0);
  const g = ctx.world.gates;
  const U = ctx.save.unlocked;
  g.pasar.open = U.pasar;
  g.pasar.obj.position.y = 0;
  g.pasar.obj.visible = !U.pasar;
  for (const c of g.pasar.cols) c.off = U.pasar;
  g.atap.open = U.atap;
  g.atap.obj.visible = U.atap;
  for (const c of g.atap.cols) c.off = !U.atap;
}

export function drawLaptop(zzz: boolean) {
  const d = ctx.world.props.laptop.data;
  const c: HTMLCanvasElement = d.canvas;
  const g = c.getContext('2d')!;
  if (!zzz) {
    const gr = g.createLinearGradient(0, 0, 256, 160);
    gr.addColorStop(0, '#5aa9e6');
    gr.addColorStop(1, '#7fc8f8');
    g.fillStyle = gr;
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#ffffff';
    g.font = 'bold 22px system-ui, sans-serif';
    g.fillText('Laporan_Kerja.doc', 16, 34);
    g.fillStyle = 'rgba(255,255,255,0.8)';
    for (let i = 0; i < 5; i++) g.fillRect(16, 52 + i * 18, 150 + (i % 2) * 60, 8);
  } else {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 256, 160);
    g.fillStyle = '#222';
    g.font = 'bold 16px monospace';
    const chars = 'zzzzzzmeowasdfghjkl;;;;;';
    for (let y = 0; y < 8; y++) {
      let s = '';
      for (let x = 0; x < 26; x++) s += chars[Math.floor(Math.random() * chars.length)];
      g.fillText(s, 6, 20 + y * 18);
    }
  }
  (d.screen.material.map as THREE.CanvasTexture).needsUpdate = true;
}

// ---------- helpers ----------
function supportEdgeDir(pr: PropInfo) {
  const p = pr.obj.position;
  const q = ctx.world.phys.query(p.x - 0.05, p.z - 0.05, p.x + 0.05, p.z + 0.05);
  let sup: any = null;
  for (const a of q) if (Math.abs(a.maxY - pr.surface) < 0.08 && p.x >= a.minX && p.x <= a.maxX && p.z >= a.minZ && p.z <= a.maxZ) sup = a;
  const f = ctx.cat.forward();
  const cb = ctx.cat.body;
  const away = new THREE.Vector3(p.x - cb.x, 0, p.z - cb.z).normalize();
  if (!sup) return { dir: away.lengthSq() > 0 ? away : f, dist: 0.3 };
  const opts = [
    { dir: new THREE.Vector3(-1, 0, 0), dist: p.x - sup.minX },
    { dir: new THREE.Vector3(1, 0, 0), dist: sup.maxX - p.x },
    { dir: new THREE.Vector3(0, 0, -1), dist: p.z - sup.minZ },
    { dir: new THREE.Vector3(0, 0, 1), dist: sup.maxZ - p.z },
  ];
  let best = opts[0], bs = 1e9;
  for (const o of opts) {
    const s = o.dist - 0.6 * o.dir.dot(f) - 0.4 * o.dir.dot(away);
    if (s < bs) {
      bs = s;
      best = o;
    }
  }
  return best;
}

function pushOff(id: string, onLand: (x: number, y: number, z: number) => void, o: { r?: number; roll?: boolean } = {}) {
  const pr = ctx.world.props[id];
  const cat = ctx.cat;
  cat.doAction('paw', 0.35);
  ctx.after(0.15, () => {
    sfx.swish();
    const e = supportEdgeDir(pr);
    const v = Math.max(1.8, (e.dist + 0.3) / 0.3);
    ctx.props.fall(pr.obj, e.dir.x * v, 1.6, e.dir.z * v, { onLand, r: o.r ?? 0.12, roll: o.roll });
  });
}

function breakFx(x: number, y: number, z: number, kind: 'glass' | 'pot', pr: PropInfo, color = 0xd9774a) {
  pr.obj.visible = false;
  if (kind === 'glass') {
    sfx.glass();
    ctx.fx.burst(x, y + 0.1, z, 0xcfeeff, 14, { speed: 2.4, up: 2.5, size: 0.06, life: 1.2, floor: y });
    ctx.props.puddle(x, y, z, 0xffa53d, 0.9);
  } else {
    sfx.potBreak();
    ctx.fx.burst(x, y + 0.1, z, color, 12, { speed: 2.2, up: 3, size: 0.1, life: 1.4, floor: y });
    ctx.fx.burst(x, y + 0.1, z, 0x5d4037, 10, { speed: 1.4, up: 2, size: 0.07, life: 1.2, floor: y });
    // the flower lying on the floor + soil pile stays for the day
    const g = new THREE.Group();
    g.add(mbox(0.5, 0.08, 0.4, 0x5d4037, 0, 0.04, 0));
    const fl = mbox(0.2, 0.16, 0.2, 0xff6f91, 0.25, 0.1, 0.05);
    const st = mbox(0.3, 0.05, 0.05, 0x388e3c, 0.05, 0.1, 0.05);
    g.add(fl, st);
    for (let i = 0; i < 4; i++) g.add(mbox(0.12, 0.05, 0.1, color, rand(-0.4, 0.4), 0.03, rand(-0.3, 0.3)));
    g.position.set(x, y, z);
    g.rotation.y = rand(0, 6);
    ctx.props.decal(g);
  }
  ctx.camRig.shake = 0.25;
}

function carry(id: string, obj: THREE.Object3D, rotY = Math.PI / 2, scale = 1) {
  const cat = ctx.cat;
  cat.model.carry.add(obj);
  obj.position.set(0, 0, 0);
  obj.rotation.set(0, rotY, 0);
  obj.scale.setScalar(scale);
  obj.visible = true;
  cat.carrying = { id, obj };
  sfx.pop();
}

export function dropCarried(silent = false) {
  const cat = ctx.cat;
  const c = cat.carrying;
  if (!c) return;
  cat.carrying = null;
  const f = cat.forward();
  const b = cat.body;
  const g = ctx.world.phys.groundAt(b.x + f.x * 0.4, b.z + f.z * 0.4, 0.05, b.y + 0.3);
  const p = new THREE.Vector3(b.x + f.x * 0.4, g, b.z + f.z * 0.4);
  if (c.id === 'bola') {
    ctx.kids.droppedBall(p);
    return;
  }
  if (c.id === 'ikan_pasar') {
    // Pak Ujang puts out another fish
    const pr = ctx.world.props.ikan_pasar;
    pr.obj.add(c.obj);
    c.obj.position.set(0, 0.07, 0);
    c.obj.rotation.set(0, 0, 0);
    c.obj.scale.setScalar(1);
    if (!silent) ctx.fx.sparkle(pr.obj.position.x, pr.obj.position.y + 0.2, pr.obj.position.z, 4);
    return;
  }
  ctx.scene.add(c.obj);
  c.obj.position.copy(p);
  c.obj.rotation.set(0, cat.yaw, 0);
  c.obj.scale.setScalar(1);
  if (!silent) sfx.thud(0.1);
}

function eatCarried() {
  const cat = ctx.cat;
  const c = cat.carrying;
  if (!c) return;
  cat.doAction('eat', 1.2, () => {
    c.obj.visible = false;
    c.obj.parent?.remove(c.obj);
    ctx.fx.hearts(cat.body.x, cat.body.y + 0.8, cat.body.z, 4);
    sfx.purr();
    // eaten market fish: stall gets a new one
    if (c.id === 'ikan_pasar') {
      const pr = ctx.world.props.ikan_pasar;
      pr.obj.add(c.obj);
      c.obj.visible = true;
      c.obj.position.set(0, 0.07, 0);
      c.obj.rotation.set(0, 0, 0);
      c.obj.scale.setScalar(1);
    }
  });
  cat.carrying = null;
  sfx.eat();
}

// ---------- registration ----------
export function setupMischief() {
  const W = ctx.world;
  const I = ctx.interact;
  const props = W.props;
  for (const k of Object.keys(props)) snapshot(props[k].obj);
  const free = () => !ctx.cat.carrying;
  const home = (id: string) => props[id].obj.parent === ctx.scene && props[id].obj.visible && props[id].obj.position.distanceTo(props[id].home) < 0.01;
  const P3 = (id: string) => props[id].home.clone();

  // --- push & break ---
  const pot = (id: string, color: number) =>
    I.add({
      id,
      mischief: id,
      label: 'a_push',
      icon: '🐾',
      pos: P3(id),
      r: 0.95,
      yTol: 0.66,
      enabled: () => free() && home(id),
      act: () =>
        pushOff(id, (x, y, z) => {
          breakFx(x, y, z, 'pot', props[id], color);
          doMischief(id);
        }),
    });
  pot('pot_rumah', 0xd9774a);
  pot('pot_taman', 0xc75b39);
  pot('pot_tetangga', 0x8d6e63);
  I.add({
    id: 'gelas',
    mischief: 'gelas',
    label: 'a_push',
    icon: '🐾',
    pos: P3('gelas'),
    r: 0.95,
    yTol: 0.5,
    enabled: () => free() && home('gelas'),
    act: () =>
      pushOff('gelas', (x, y, z) => {
        breakFx(x, y, z, 'glass', props.gelas);
        doMischief('gelas');
      }),
  });
  I.add({
    id: 'tomat',
    mischief: 'tomat',
    label: 'a_push',
    icon: '🐾',
    pos: P3('tomat'),
    r: 0.95,
    yTol: 0.6,
    enabled: () => free() && home('tomat'),
    act: () => {
      pushOff('tomat', (x, y, z) => {
        sfx.rollThuds();
        const d = props.tomat.data;
        for (const t of d.toms as THREE.Mesh[]) {
          const a = rand(0, Math.PI * 2);
          const wp = new THREE.Vector3();
          t.getWorldPosition(wp);
          ctx.scene.add(t);
          t.position.set(x + rand(-0.2, 0.2), y + 0.3, z + rand(-0.2, 0.2));
          ctx.props.fall(t, Math.cos(a) * rand(1.5, 3.5), rand(1.5, 3), Math.sin(a) * rand(1.5, 3.5), { roll: true, r: 0.08, bounces: 2 });
        }
        props.tomat.obj.rotation.z = Math.PI / 2;
        doMischief('tomat');
      });
    },
  });
  I.add({
    id: 'ember',
    mischief: 'ember',
    label: 'a_push',
    icon: '🐾',
    pos: P3('ember'),
    r: 1.25,
    yTol: 0.6,
    enabled: () => free() && props.ember.obj.rotation.z === 0,
    act: () => {
      const cat = ctx.cat;
      cat.doAction('paw', 0.35);
      ctx.after(0.15, () => {
        const e = props.ember.obj;
        const f = cat.forward();
        let k = 0;
        const tip = () => {
          k += 0.1;
          e.rotation.z = -Math.min(1, k) * (Math.PI / 2) * Math.sign(f.x || 1);
          e.position.y = Math.min(1, k) * 0.27;
          if (k < 1) ctx.after(0.02, tip);
        };
        tip();
        sfx.splash(true);
        ctx.fx.burst(e.position.x + f.x * 0.5, 0.3, e.position.z + f.z * 0.5, 0x8fd3ff, 22, { speed: 3, up: 3, size: 0.08, life: 1, floor: 0.02 });
        ctx.props.puddle(e.position.x + f.x * 0.9, 0, e.position.z + f.z * 0.9, 0x6fb8e8, 2.0);
        doMischief('ember');
      });
    },
  });

  // --- tissue ---
  I.add({
    id: 'tisu',
    mischief: 'tisu',
    label: 'a_pull',
    icon: '🐾',
    pos: P3('tisu'),
    r: 0.9,
    yTol: 0.6,
    enabled: () => free() && home('tisu'),
    act: () => {
      const cat = ctx.cat;
      cat.doAction('paw', 0.35, () => {
        sfx.paper();
        const pr = props.tisu;
        ctx.props.fall(pr.obj, (ctx.cat.body.x - pr.obj.position.x) * 1.5, 1.5, (ctx.cat.body.z - pr.obj.position.z) * 1.5, { r: 0.1, roll: true });
        ctx.props.startTrail(pr.obj.position.clone().setY(0));
        doMischief('tisu');
      });
    },
  });

  // --- grabs ---
  I.add({
    id: 'ikan_dapur',
    mischief: 'ikan_dapur',
    label: 'a_grab',
    icon: '🐟',
    pos: P3('ikan_dapur'),
    r: 0.9,
    yTol: 0.6,
    enabled: () => free() && props.ikan_dapur.data.fish.parent === props.ikan_dapur.obj,
    act: () => {
      carry('ikan_dapur', props.ikan_dapur.data.fish, Math.PI / 2, 0.8);
      doMischief('ikan_dapur');
    },
  });
  I.add({
    id: 'ikan_pasar',
    mischief: 'ikan_pasar',
    label: 'a_grab',
    icon: '🐟',
    pos: P3('ikan_pasar'),
    r: 0.9,
    yTol: 0.6,
    enabled: () => free() && props.ikan_pasar.data.fish.parent === props.ikan_pasar.obj,
    act: () => {
      carry('ikan_pasar', props.ikan_pasar.data.fish, Math.PI / 2, 0.75);
      doMischief('ikan_pasar');
    },
  });
  I.add({
    id: 'ikan_asin',
    mischief: 'ikan_asin',
    label: 'a_grab',
    icon: '🐟',
    pos: P3('ikan_asin'),
    r: 1.2,
    yTol: 0.6,
    enabled: () => free() && props.ikan_asin.obj.children.some((c, i) => i > 0 && c.parent === props.ikan_asin.obj && c.visible),
    act: () => {
      const tray = props.ikan_asin.obj;
      const f = tray.children.find((c, i) => i > 0 && c.visible)!;
      carry('ikan_asin', f, Math.PI / 2, 1);
      doMischief('ikan_asin');
    },
  });
  I.add({
    id: 'sandal',
    mischief: 'sandal',
    label: 'a_grab',
    icon: '🩴',
    pos: P3('sandal'),
    r: 0.8,
    yTol: 0.6,
    enabled: () => free() && home('sandal'),
    act: () => {
      carry('sandal', props.sandal.obj, Math.PI / 2, 0.7);
      doMischief('sandal');
    },
  });
  const ballPos = new THREE.Vector3();
  I.add({
    id: 'bola',
    mischief: 'bola',
    label: 'a_grab',
    icon: '⚽',
    pos: ballPos,
    r: 0.9,
    yTol: 0.8,
    enabled: () => {
      ballPos.copy(ctx.kids.ball.position).setY(0);
      return free() && ctx.kids.ballGrabbable();
    },
    act: () => {
      ctx.kids.grabBall();
      carry('bola', ctx.kids.ball, 0, 0.75);
      ctx.kids.ball.position.set(0, 0.05, 0.05);
      doMischief('bola');
    },
  });

  // --- naps ---
  I.add({
    id: 'laptop',
    mischief: 'laptop',
    label: 'a_sleep',
    icon: '💤',
    pos: P3('laptop'),
    r: 0.9,
    yTol: 0.6,
    enabled: () => free() && !ctx.day.doneToday.has('laptop'),
    act: () => {
      const p = props.laptop.obj.position;
      ctx.cat.sleepAt(new THREE.Vector3(p.x, p.y + 0.05, p.z + 0.05), Math.PI, () => {
        drawLaptop(true);
        sfx.tick();
        doMischief('laptop');
      });
    },
  });
  I.add({
    id: 'motor',
    mischief: 'motor',
    label: 'a_sleep',
    icon: '💤',
    pos: W.pts.motorSeat,
    r: 1.5,
    yTol: 1.05,
    enabled: () => free(),
    act: () => {
      ctx.cat.sleepAt(W.pts.motorSeat, 0, () => {
        sfx.alarm();
        ctx.bubbles.say(props.motor.obj, L(P('TIIT TIIT TIIT!', 'BEEP BEEP BEEP!')), { ttl: 1.6, y: 1.7, kind: 'shout', key: 'motor' });
        const lights = props.motor.data.lights as THREE.Mesh[];
        let n = 0;
        const blink = () => {
          n++;
          for (const l of lights) (l.material as THREE.MeshLambertMaterial).emissive.setHex(n % 2 ? 0xffaa00 : 0);
          if (n < 14) ctx.after(0.14, blink);
        };
        blink();
        doMischief('motor');
        ctx.after(0.5, () => {
          const c = ctx.cat;
          if (c.state === 'sleep') {
            c.setState('free');
            c.body.vy = 5.5;
            c.body.vx = 2.5;
            c.body.onGround = false;
            c.dizzy = 1;
            sfx.meow(1.5);
            ctx.bubbles.say(c.model.root, L(P('Kaget sendiri!', 'Startled myself!')), { ttl: 1.6, y: 1, kind: 'emote', key: 'catkaget' });
          }
        });
      }, 1.2);
    },
  });

  // --- scratches ---
  I.add({
    id: 'gorden',
    mischief: 'gorden',
    label: 'a_scratch',
    icon: '🐾',
    pos: new THREE.Vector3(-21.1, 0, -16),
    r: 1.3,
    yTol: 1.0,
    enabled: () => free() && props.gorden.data.panels[0].visible,
    act: () => {
      const cat = ctx.cat;
      cat.yaw = -Math.PI / 2;
      sfx.scratch();
      cat.doAction('scratch', 1.0, () => {
        const g = props.gorden.obj;
        for (const p of props.gorden.data.panels as THREE.Mesh[]) {
          p.visible = false;
          const strips = new THREE.Group();
          for (let i = 0; i < 6; i++) {
            const h = rand(0.8, 2.1);
            const s = mbox(0.07, h, 0.16, 0xef7c8e, 0, 2.6 - h / 2, p.position.z - 0.55 + i * 0.22);
            s.rotation.x = rand(-0.08, 0.08);
            strips.add(s);
          }
          strips.position.copy(g.position);
          ctx.props.decal(strips);
        }
        ctx.fx.burst(-21.3, 1.2, -16, 0xffb3c1, 18, { speed: 1.5, up: 1.5, size: 0.06, g: 3, life: 1.8, floor: 0 });
        doMischief('gorden');
      });
    },
  });
  I.add({
    id: 'koran',
    mischief: 'koran',
    label: 'a_scratch',
    icon: '🐾',
    pos: P3('koran'),
    r: 0.9,
    yTol: 0.7,
    enabled: () => free() && home('koran'),
    act: () => {
      sfx.paper();
      ctx.cat.doAction('scratch', 0.8, () => {
        const k = props.koran.obj;
        k.visible = false;
        ctx.fx.burst(k.position.x, k.position.y + 0.1, k.position.z, 0xf5f5f5, 16, { speed: 2, up: 2.5, size: 0.08, g: 4, life: 2, floor: 0.2 });
        for (let i = 0; i < 4; i++) {
          const piece = mbox(rand(0.1, 0.25), 0.01, rand(0.1, 0.2), 0xf0f0f0, k.position.x + rand(-0.6, 0.6), 0.21, k.position.z + rand(0.2, 0.9));
          piece.rotation.y = rand(0, 3);
          ctx.props.decal(piece);
        }
        doMischief('koran');
      });
    },
  });

  // --- dig ---
  I.add({
    id: 'gali',
    mischief: 'gali',
    label: 'a_dig',
    icon: '🐾',
    pos: W.pts.flowerBed,
    r: 2.3,
    yTol: 0.6,
    enabled: () => free() && !props.bunga.data.mound.visible,
    act: () => {
      sfx.dig();
      ctx.cat.doAction('dig', 1.1, () => {
        const d = props.bunga.data;
        d.mound.visible = true;
        const cb = ctx.cat.body;
        d.mound.position.set(cb.x, 0.3, cb.z);
        for (const f of d.flowers as THREE.Object3D[]) {
          f.rotation.z = rand(-1.3, 1.3);
          f.rotation.x = rand(-0.6, 0.6);
        }
        ctx.fx.burst(cb.x, 0.35, cb.z, 0x6d4c41, 20, { speed: 2, up: 3, size: 0.08, life: 1.2, floor: 0.22 });
        doMischief('gali');
      });
    },
  });

  // --- dog ---
  I.add({
    id: 'anjing',
    mischief: 'anjing',
    label: 'a_poke',
    icon: '🐾',
    pos: W.pts.dogFence,
    r: 1.4,
    dist: () => {
      const b = ctx.cat.body;
      if (b.x < 19.8 || b.x > 39.4 || b.z < -5.25 || b.y > 1.2) return 99;
      return b.z + 5.25;
    },
    enabled: () => free() && ctx.dog.state !== 'bark',
    act: () => {
      ctx.cat.yaw = Math.PI;
      ctx.cat.doAction('paw', 0.35, () => {
        ctx.dog.poke();
        doMischief('anjing');
      });
    },
  });

  // --- pigeons ---
  const flock = (id: string, fl: any) =>
    I.add({
      id,
      mischief: id,
      label: 'a_scare',
      icon: '🐾',
      pos: fl.center,
      r: 2.4,
      yTol: 0.8,
      enabled: () => free() && fl.state === 'ground',
      act: () => {
        const cat = ctx.cat;
        const f = cat.forward();
        cat.body.vy = 4.5;
        cat.body.vx = f.x * 3;
        cat.body.vz = f.z * 3;
        cat.body.onGround = false;
        sfx.meow(1.2);
        if (fl.scare()) doMischief(id);
      },
    });
  flock('merpati_taman', ctx.flocks[0]);
  flock('merpati_atap', ctx.flocks[1]);
  ctx.onFlockScared = (fl: any) => doMischief(fl.mischiefId);

  // --- laundry ---
  I.add({
    id: 'jemuran',
    mischief: 'jemuran',
    label: 'a_pull',
    icon: '🐾',
    pos: W.pts.jemuran,
    r: 2.8,
    yTol: 0.5,
    enabled: () => free() && props.jemuran.data.cloths[0].parent === props.jemuran.obj,
    act: () => {
      const cat = ctx.cat;
      cat.body.vy = 5;
      cat.body.onGround = false;
      cat.doAction('paw', 0.35);
      sfx.cloth();
      ctx.after(0.2, () => {
        for (const c of props.jemuran.data.cloths as THREE.Object3D[]) {
          c.rotation.y = rand(-0.5, 0.5);
          ctx.props.fall(c, rand(-0.8, 0.8), rand(0, 1), rand(-0.5, 1.5), { g: 3, drag: 1.2, flutter: 0.6, r: 0.2, bounces: 0, bottom: 0.64, flat: true });
        }
        doMischief('jemuran');
      });
    },
  });

  // --- carried item action (eat / drop / give) ---
  I.add({
    id: 'carry',
    label: () => (carryAction() === 'eat' ? 'a_eat' : 'a_drop'),
    icon: () => (carryAction() === 'eat' ? '😋' : '⬇️'),
    pos: new THREE.Vector3(),
    r: 1,
    priority: -1,
    dist: () => 0,
    enabled: () => !!ctx.cat.carrying,
    act: () => {
      const c = ctx.cat.carrying;
      if (!c) return;
      if (carryAction() === 'eat') eatCarried();
      else dropCarried();
    },
  });
}

export function carryAction(): 'eat' | 'drop' {
  const c = ctx.cat.carrying;
  if (!c) return 'drop';
  if (c.id === 'ikan_dapur' || c.id === 'ikan_asin') return 'eat';
  if (c.id === 'ikan_pasar') return ctx.quests.wantsMarketFish() ? 'drop' : 'eat';
  return 'drop';
}
