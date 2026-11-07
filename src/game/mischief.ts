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
  area: 'rumah' | 'taman' | 'jalan' | 'pasar' | 'atap' | 'sekolah' | 'warung' | 'sungai';
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
  { id: 'papan', area: 'sekolah', icon: '🖍️', name: P('Coret-coret papan tulis', 'Scribble on the blackboard'), noise: 3 },
  { id: 'buku', area: 'sekolah', icon: '📚', name: P('Jatuhin tumpukan buku', 'Topple the book stack'), noise: 7 },
  { id: 'meja_guru', area: 'sekolah', icon: '🍎', name: P('Tidur di meja guru', "Nap on the teacher's desk"), noise: 0 },
  { id: 'bel', area: 'sekolah', icon: '🔔', name: P('Bunyiin bel sekolah', 'Ring the school bell'), noise: 20 },
  { id: 'kerupuk', area: 'warung', icon: '🍘', name: P('Curi kerupuk', 'Steal a cracker'), noise: 0 },
  { id: 'permen', area: 'warung', icon: '🍬', name: P('Jatuhin toples permen', 'Knock over the candy jar'), noise: 8 },
  { id: 'galon', area: 'warung', icon: '💧', name: P('Dorong galon sampai menggelinding', 'Roll the water jug'), noise: 7 },
  { id: 'kulkas', area: 'warung', icon: '🍦', name: P('Tidur di atas kulkas es krim', 'Nap on the ice cream freezer'), noise: 0 },
  { id: 'perahu', area: 'sungai', icon: '⛵', name: P('Dorong perahu kertas ke sungai', 'Launch the paper boat'), noise: 0 },
  { id: 'kupu', area: 'sungai', icon: '🦋', name: P('Kejar kupu-kupu', 'Chase the butterflies'), noise: 0 },
  { id: 'bebek', area: 'sungai', icon: '🦆', name: P('Ganggu bebek', 'Bother the ducks'), noise: 6 },
  { id: 'cebur', area: 'sungai', icon: '💦', name: P('Cebur-ceburan di batu', 'Splash on the stepping stones'), noise: 3 },
];
export const MBY: Record<string, MDef> = Object.fromEntries(MISCHIEF.map((m) => [m.id, m]));
export const AREAS = ['rumah', 'taman', 'jalan', 'pasar', 'atap', 'sekolah', 'warung', 'sungai'] as const;
export const AREA_KEY: Record<string, string> = Object.fromEntries(AREAS.map((a) => [a, 'ar_' + a]));

export function addCoins(n: number) {
  ctx.save.coins += n;
  if (ctx.day) ctx.day.coinsToday += n;
  if (n > 0) ctx.quests?.onEvent('coins', n);
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
  drawBoard(false);
  boatT = -1;
  rollRun++;
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

// classroom blackboard: a little lesson, or (after the cat) scribbles + paw prints
export function drawBoard(messy: boolean) {
  const d = ctx.world.props.papan?.data;
  if (!d) return;
  const c: HTMLCanvasElement = d.canvas;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2f5d45';
  g.fillRect(0, 0, 512, 128);
  g.fillStyle = 'rgba(255,255,255,0.9)';
  g.font = '700 40px "Baloo 2", system-ui, sans-serif';
  g.textBaseline = 'middle';
  if (!messy) {
    g.fillText('1 + 1 = 2', 24, 40);
    g.fillText('A  B  C  D', 24, 92);
    g.fillText('Ini Budi.', 280, 40);
    g.fillText('2 + 3 = 5', 280, 92);
  } else {
    g.globalAlpha = 0.35;
    g.fillText('1 + 1 = 2', 24, 40);
    g.fillText('A  B  C  D', 24, 92);
    g.globalAlpha = 1;
    // smudge stripes where the paws wiped
    g.fillStyle = 'rgba(200,220,210,0.35)';
    for (let i = 0; i < 6; i++) g.fillRect(40 + i * 70, 10 + (i % 2) * 20, 50, 100);
    g.strokeStyle = '#fff6b0';
    g.lineWidth = 5;
    g.beginPath();
    for (let i = 0; i < 40; i++) g.lineTo(250 + Math.sin(i * 0.9) * 80 + i * 4, 64 + Math.cos(i * 1.3) * 40);
    g.stroke();
    // cat face doodle
    g.strokeStyle = '#ffffff';
    g.lineWidth = 4;
    g.beginPath();
    g.arc(420, 64, 32, 0, Math.PI * 2);
    g.moveTo(394, 44);
    g.lineTo(398, 18);
    g.lineTo(414, 34);
    g.moveTo(446, 44);
    g.lineTo(442, 18);
    g.lineTo(426, 34);
    g.stroke();
    g.fillStyle = '#ffffff';
    g.fillRect(406, 56, 6, 6);
    g.fillRect(428, 56, 6, 6);
    g.fillText('MEONG!', 70, 64);
    // paw prints
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (const [x, y] of [[30, 110], [140, 20], [210, 100], [330, 24], [480, 108]]) {
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      for (let k = 0; k < 3; k++) g.arc(x - 9 + k * 9, y - 11, 3.5, 0, Math.PI * 2);
      g.fill();
    }
  }
  ((d.screen as THREE.Mesh).material as THREE.MeshLambertMaterial).map!.needsUpdate = true;
}
let boatT = -1;
let rollRun = 0; // bumps on day reset to stop the rolling gallon

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
  ctx.quests.onEvent('eat');
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

  setupEdgeMischief(flock);

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
  if (c.id === 'ikan_dapur' || c.id === 'ikan_asin' || c.id === 'kerupuk') return 'eat';
  if (c.id === 'ikan_pasar') return ctx.quests.wantsMarketFish() ? 'drop' : 'eat';
  return 'drop';
}

// ---------- new edge areas: Sekolah, Warung, Sungai ----------
function setupEdgeMischief(flock: (id: string, fl: any) => void) {
  const W = ctx.world;
  const I = ctx.interact;
  const props = W.props;
  const free = () => !ctx.cat.carrying;
  const home = (id: string) => props[id].obj.parent === ctx.scene && props[id].obj.visible && props[id].obj.position.distanceTo(props[id].home) < 0.01;
  const P3 = (id: string) => props[id].home.clone();
  const hop = (vy = 5) => {
    const b = ctx.cat.body;
    b.vy = vy;
    b.onGround = false;
  };
  drawBoard(false);

  // --- SEKOLAH ---
  I.add({
    id: 'papan',
    mischief: 'papan',
    label: 'a_scratch',
    icon: '🖍️',
    pos: W.pts.board,
    r: 1.8,
    yTol: 0.8,
    enabled: () => free() && !ctx.day.doneToday.has('papan'),
    act: () => {
      const cat = ctx.cat;
      cat.yaw = 0;
      hop(5.2);
      sfx.scratch();
      ctx.after(0.25, () =>
        cat.doAction('scratch', 1.0, () => {
          drawBoard(true);
          const p = W.pts.board;
          ctx.fx.burst(p.x, 1.6, p.z + 0.5, 0xffffff, 18, { speed: 1.2, up: 1, size: 0.05, g: 2, life: 1.6, floor: 0 });
          doMischief('papan');
        }),
      );
    },
  });
  I.add({
    id: 'buku',
    mischief: 'buku',
    label: 'a_push',
    icon: '🐾',
    pos: P3('buku'),
    r: 0.95,
    yTol: 0.6,
    enabled: () => free() && home('buku'),
    act: () =>
      pushOff('buku', (x, y, z) => {
        sfx.rollThuds();
        sfx.paper();
        const pr = props.buku;
        for (const b of [...pr.obj.children]) {
          const a = rand(0, Math.PI * 2);
          ctx.scene.add(b);
          b.position.set(x + rand(-0.2, 0.2), y + 0.2 + rand(0, 0.2), z + rand(-0.2, 0.2));
          ctx.props.fall(b, Math.cos(a) * rand(0.8, 2), rand(1, 2.5), Math.sin(a) * rand(0.8, 2), { r: 0.08, bounces: 1 });
        }
        ctx.camRig.shake = 0.15;
        doMischief('buku');
      }),
  });
  I.add({
    id: 'meja_guru',
    mischief: 'meja_guru',
    label: 'a_sleep',
    icon: '💤',
    pos: W.pts.teacherDesk,
    r: 1.1,
    yTol: 0.6,
    enabled: () => free(),
    act: () => {
      ctx.cat.sleepAt(W.pts.teacherDesk, Math.PI, () => {
        ctx.bubbles.say(ctx.cat.model.root, L(P('Bu Guru, aku ngantuk...', 'Teacher, I\'m sleepy...')), { ttl: 1.8, y: 1, kind: 'emote', key: 'catdesk' });
        doMischief('meja_guru');
      });
    },
  });
  let bellSwing = 0;
  I.add({
    id: 'bel',
    mischief: 'bel',
    label: 'a_pull',
    icon: '🔔',
    pos: W.pts.bell,
    r: 1.3,
    yTol: 0.8,
    enabled: () => free() && bellSwing <= 0,
    act: () => {
      hop(6.2);
      ctx.cat.doAction('paw', 0.4);
      ctx.after(0.3, () => {
        sfx.bell();
        const b = props.bel.obj;
        bellSwing = 1.8;
        const swing = () => {
          bellSwing -= 0.03;
          b.rotation.x = Math.sin(bellSwing * 14) * 0.5 * Math.max(0, bellSwing / 1.8);
          if (bellSwing > 0) ctx.after(0.03, swing);
          else b.rotation.x = 0;
        };
        swing();
        ctx.bubbles.say(b, L(P('TENG TENG TENG!', 'DING DING DING!')), { ttl: 1.8, y: 0.3, kind: 'shout', key: 'bel' });
        ctx.camRig.shake = 0.2;
        doMischief('bel');
      });
    },
  });

  // --- WARUNG ---
  I.add({
    id: 'kerupuk',
    mischief: 'kerupuk',
    label: 'a_grab',
    icon: '🍘',
    pos: P3('kerupuk'),
    r: 0.9,
    yTol: 0.6,
    enabled: () => free() && props.kerupuk.data.chip.parent === props.kerupuk.obj,
    act: () => {
      sfx.paper();
      carry('kerupuk', props.kerupuk.data.chip, 0, 0.9);
      doMischief('kerupuk');
    },
  });
  I.add({
    id: 'permen',
    mischief: 'permen',
    label: 'a_push',
    icon: '🐾',
    pos: P3('permen'),
    r: 0.95,
    yTol: 0.6,
    enabled: () => free() && home('permen'),
    act: () =>
      pushOff('permen', (x, y, z) => {
        sfx.glass();
        sfx.rollThuds();
        const pr = props.permen;
        pr.obj.children[0].visible = false; // the jar shatters (plastic-ish: no shards left)
        ctx.fx.burst(x, y + 0.1, z, 0xdff4ff, 10, { speed: 2, up: 2, size: 0.05, life: 1, floor: y });
        for (const c of [...pr.obj.children].slice(1, 7)) {
          const a = rand(0, Math.PI * 2);
          ctx.scene.add(c);
          c.position.set(x + rand(-0.15, 0.15), y + 0.15, z + rand(-0.15, 0.15));
          ctx.props.fall(c, Math.cos(a) * rand(1.5, 3), rand(1.5, 3), Math.sin(a) * rand(1.5, 3), { roll: true, r: 0.05, bounces: 2 });
        }
        pr.obj.rotation.z = Math.PI / 2;
        ctx.camRig.shake = 0.2;
        doMischief('permen');
      }),
  });
  I.add({
    id: 'galon',
    mischief: 'galon',
    label: 'a_push',
    icon: '🐾',
    pos: P3('galon'),
    r: 1.0,
    yTol: 0.6,
    enabled: () => free() && props.galon.data.mid.rotation.z === 0,
    act: () => {
      const cat = ctx.cat;
      cat.doAction('paw', 0.35);
      ctx.after(0.15, () => {
        const pr = props.galon;
        const o = pr.obj;
        const { mid, body } = pr.data;
        const cb = cat.body;
        let dx = o.position.x - cb.x, dz = o.position.z - cb.z;
        const l = Math.hypot(dx, dz) || 1;
        dx /= l;
        dz /= l;
        o.rotation.y = Math.atan2(dx, dz);
        sfx.thud(0.3);
        let k = 0;
        let v = 3.4;
        const run = rollRun;
        const step = () => {
          if (run !== rollRun) return;
          const dt = 0.02;
          if (k < 1) {
            k = Math.min(1, k + 0.12);
            mid.rotation.z = k * (Math.PI / 2);
            mid.position.y = 0.25 - k * 0.04;
          } else {
            const nx = o.position.x + dx * v * dt, nz = o.position.z + dz * v * dt;
            if (W.phys.free(nx - 0.22, 0.05, nz - 0.22, nx + 0.22, 0.4, nz + 0.22)) {
              o.position.x = nx;
              o.position.z = nz;
              body.rotation.y -= (v * dt) / 0.21;
            } else {
              v *= -0.3;
              sfx.thud(0.2);
            }
            v *= 1 - 1.1 * dt;
            if (Math.random() < 0.15) sfx.tone(140 + Math.random() * 40, 0.06, 'sine', 0.1, 0, 90);
          }
          if (Math.abs(v) > 0.08) ctx.after(dt, step);
        };
        step();
        ctx.props.puddle(o.position.x + dx * 0.5, 0, o.position.z + dz * 0.5, 0x8fd3ff, 0.8);
        doMischief('galon');
      });
    },
  });
  I.add({
    id: 'kulkas',
    mischief: 'kulkas',
    label: 'a_sleep',
    icon: '💤',
    pos: W.pts.freezerTop,
    r: 1.0,
    yTol: 0.6,
    enabled: () => free(),
    act: () => {
      ctx.cat.sleepAt(W.pts.freezerTop, Math.PI / 2, () => {
        ctx.bubbles.say(ctx.cat.model.root, L(P('Adem... brrr...', 'So cool... brrr...')), { ttl: 1.8, y: 1, kind: 'emote', key: 'catfreezer' });
        doMischief('kulkas');
      });
    },
  });

  // --- SUNGAI ---
  I.add({
    id: 'perahu',
    mischief: 'perahu',
    label: 'a_push',
    icon: '🐾',
    pos: P3('perahu'),
    r: 0.95,
    yTol: 0.6,
    enabled: () => free() && home('perahu'),
    act: () => {
      ctx.cat.doAction('paw', 0.35);
      ctx.after(0.15, () => {
        const o = props.perahu.obj;
        sfx.plop();
        boatT = 0;
        const x0 = o.position.x, z0 = o.position.z;
        const step = () => {
          if (boatT < 0) return; // day reset
          boatT += 0.03;
          const k = Math.min(1, boatT / 0.5);
          o.position.set(x0 + boatT * 1.1, k < 1 ? 0.2 + Math.sin(k * Math.PI) * 0.25 - k * 0.12 : 0.08 + Math.sin(boatT * 4) * 0.015, z0 + k * 1.6);
          o.rotation.z = Math.sin(boatT * 3) * 0.12;
          if (boatT > 0.5 && boatT < 0.56) {
            sfx.splash();
            ctx.fx.burst(o.position.x, 0.1, o.position.z, 0x8fd3ff, 8, { speed: 1.2, up: 1.5, size: 0.05, life: 0.6, floor: 0.05 });
          }
          if (o.position.x > 43) o.visible = false;
          else ctx.after(0.03, step);
        };
        step();
        ctx.bubbles.say(ctx.cat.model.root, L(P('Dadah, perahu!', 'Bye bye, boat!')), { ttl: 1.6, y: 1, kind: 'emote', key: 'catboat' });
        doMischief('perahu');
      });
    },
  });
  const bf = ctx.butterflies;
  I.add({
    id: 'kupu',
    mischief: 'kupu',
    label: 'a_chase',
    icon: '🦋',
    pos: bf.center,
    r: 2.6,
    yTol: 0.8,
    enabled: () => free() && bf.state === 'idle',
    act: () => {
      const cat = ctx.cat;
      const f = cat.forward();
      hop(5.5);
      cat.body.vx = f.x * 3;
      cat.body.vz = f.z * 3;
      sfx.meow(1.3);
      cat.doAction('paw', 0.4);
      if (bf.scare()) doMischief('kupu');
    },
  });
  flock('bebek', ctx.flocks[2]);
  I.add({
    id: 'cebur',
    mischief: 'cebur',
    label: 'a_splash',
    icon: '💦',
    pos: W.pts.riverStones,
    r: 0.9,
    yTol: 0.5,
    enabled: () => free(),
    act: () => {
      const cat = ctx.cat;
      hop(4);
      sfx.splash(true);
      const b = cat.body;
      for (const s of [-0.5, 0.5]) ctx.fx.burst(b.x + s, 0.15, b.z, 0x8fd3ff, 14, { speed: 2.4, up: 4, size: 0.08, life: 0.9, floor: 0.05 });
      ctx.props.puddle(b.x, 0.25, b.z, 0x6fb8e8, 0.7);
      ctx.bubbles.say(cat.model.root, L(P('Byur! Hihi, basah!', 'Splash! Hehe, wet!')), { ttl: 1.6, y: 1, kind: 'emote', key: 'catcebur' });
      doMischief('cebur');
    },
  });
}
