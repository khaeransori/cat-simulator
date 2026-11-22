// House types for an Indonesian perumahan (inspired by Pamulang Permai I, Pamulang, Tangerang Selatan).
// Local frame: lot spans x in [-W/2, W/2], front fence at z=0, lot goes back to z=-D. Facades face +z (street).
// Ported verbatim from the approved mockup; game additions are marked `col` (colliders for the main masses,
// flat roofs, posts and fences so the cat can't walk through what it sees) and the sign text options.
import * as THREE from 'three';
import { B, region, hipRoof, gableRoof, shedRoof, frustum, win, roster, door, acUnit, toren, parabola, pot, bush, tree, palm, pisang, weeds, jemuran, fence, shade, rr, rnd } from './builder';

export const F = 0.35; // peil lantai (floor raised above yard)
export const H = 3.3; // per storey
const KERAMIK = 0xd9cfc0, PAVE = 0xb7b1a5, GRASS = 0x7cbf4f, TRIM = 0xf4efe4;

// ---------------- sign atlas ----------------
const font = (g: CanvasRenderingContext2D, px: number, w = 'bold') => { g.font = `${w} ${px}px DejaVu Sans, Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; };
function plate(name: string, txt: string, bg: string, fg: string, w = 96, h = 64) {
  region(name, w, h, (g) => { g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = fg; font(g, h * 0.5); g.fillText(txt, w / 2, h / 2 + 2); });
}
export function makeSigns() {
  const nums: [string, string, string][] = [['no1', 'C1/7', '#1b5e20'], ['no2', 'C1/8', '#0d47a1'], ['no3', 'C1/9', '#263238'], ['no4', 'C1/10', '#5d4037'], ['no5', 'C1/11', '#424242'], ['no6', 'C1/12', '#6d4c41'], ['no7', 'C2/3', '#1b5e20'], ['no8', 'C2/4', '#4a148c'], ['no9', 'C2/5', '#0d47a1'], ['no10', 'C2/6', '#bf360c']];
  nums.forEach(([n, t, c]) => plate(n, t, '#fafafa', c, 128, 64));
  plate('emas', 'No. 8', '#1d1d1d', '#e0b84a', 128, 64);
  // game: extra plates for the gameplay houses + backdrop variants
  const more: [string, string, string][] = [['noA', 'C1/3', '#bf360c'], ['noB', 'C1/4', '#1b5e20'], ['noC', 'C1/5', '#0d47a1'], ['no11', 'C3/1', '#263238'], ['no12', 'C3/2', '#4a148c'], ['no13', 'C3/4', '#1b5e20'], ['no14', 'C3/5', '#5d4037'], ['no15', 'C3/6', '#0d47a1'], ['no16', 'C3/7', '#bf360c']];
  more.forEach(([n, t, c]) => plate(n, t, '#fafafa', c, 128, 64));
  const warung = (name: string, txt: string) => region(name, 384, 96, (g, w, h) => {
    g.fillStyle = '#d32f2f'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff59d'; font(g, 36); g.fillText(txt, w / 2, 38);
    g.fillStyle = '#ffffff'; font(g, 22, 'normal'); g.fillText('sembako • pulsa • gas • galon', w / 2, 76);
  });
  warung('warung', 'WARUNG BU TINI');
  warung('warungInah', 'WARUNG BU INAH'); // the game's east-lot warung keeps its old name
  region('fotokopi', 384, 96, (g, w, h) => {
    g.fillStyle = '#1565c0'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffffff'; font(g, 46); g.fillText('FOTOKOPI', w / 2, 38);
    g.fillStyle = '#ffeb3b'; font(g, 22); g.fillText('ATK • JILID • PRINT WARNA', w / 2, 76);
  });
  region('dijual', 320, 128, (g, w, h) => {
    g.clearRect(0, 0, w, h); g.fillStyle = 'rgba(190,20,20,0.92)'; font(g, 62); g.save(); g.translate(w / 2, 46); g.rotate(-0.04); g.fillText('DIJUAL', 0, 0); g.restore();
    font(g, 30); g.fillText('HUB 0812-xxxx', w / 2, 102);
  });
  region('musholla', 384, 96, (g, w, h) => {
    g.fillStyle = '#1b5e20'; g.fillRect(0, 0, w, h); g.strokeStyle = '#e0b84a'; g.lineWidth = 5; g.strokeRect(6, 6, w - 12, h - 12);
    g.fillStyle = '#ffffff'; font(g, 26, 'normal'); g.fillText('MUSHOLLA', w / 2, 32); font(g, 36); g.fillText('AL-IKHLAS', w / 2, 66);
  });
  region('ronda', 256, 72, (g, w, h) => { g.fillStyle = '#fbc02d'; g.fillRect(0, 0, w, h); g.fillStyle = '#212121'; font(g, 30); g.fillText('POS RONDA', w / 2, 26); font(g, 22, 'normal'); g.fillText('RT 03 / RW 07', w / 2, 56); });
  region('tanah', 256, 128, (g, w, h) => {
    g.fillStyle = '#fafafa'; g.fillRect(0, 0, w, h); g.fillStyle = '#c62828'; font(g, 26); g.fillText('TANAH INI', w / 2, 30); g.fillText('MILIK', w / 2, 62);
    g.fillStyle = '#212121'; font(g, 22, 'normal'); g.fillText('H. Sobari', w / 2, 96); g.fillText('TIDAK DIJUAL', w / 2, 118);
  });
  region('rolling', 64, 64, (g, w, h) => { for (let y = 0; y < h; y += 8) { g.fillStyle = y % 16 ? '#b9bec4' : '#9aa1a8'; g.fillRect(0, y, w, 8); } });
  region('etalase', 256, 128, (g, w, h) => {
    g.fillStyle = '#3b2f2a'; g.fillRect(0, 0, w, h);
    const cs = ['#e53935', '#fdd835', '#43a047', '#1e88e5', '#ff7043', '#ffffff', '#8e24aa'];
    for (let r = 0; r < 4; r++) { g.fillStyle = '#6d5544'; g.fillRect(0, 30 + r * 30, w, 4); for (let x = 4; x < w - 10; x += 12 + (x % 7)) { g.fillStyle = cs[(x + r * 3) % cs.length]; g.fillRect(x, 10 + r * 30, 9, 20); } }
  });
}

// ---------------- shared helpers ----------------
function yard(b: B, W: number, zHouse: number, c = PAVE) { b.span(-W / 2 + 0.15, W / 2 - 0.15, 0, 0.08, -0.15, zHouse, c, { wob: 0.03, col: true }); }
function grassPatch(b: B, x0: number, x1: number, z0: number, z1: number) { b.span(x0, x1, 0, 0.11, z0, z1, GRASS, { wob: 0.06, col: true }); }
function plinth(b: B, x0: number, x1: number, z0: number, z1: number, h = F, c = KERAMIK) { b.span(x0, x1, 0, h, z0, z1, c, { bev: 0.03, wob: 0.03, col: true }); }
function steps(b: B, x: number, w: number, zf: number, h = F, c = KERAMIK) { const n = Math.max(1, Math.round(h / 0.18)); for (let i = 0; i < n; i++) b.span(x - w / 2, x + w / 2, 0, h - (i + 1) * (h / n) + h / n, zf, zf + 0.3 * (i + 1), shade(c, 0.97), { col: true }); }
/** mass with BOTTOM at 0 (walls continue into plinth) */
function mass(b: B, x0: number, x1: number, z0: number, z1: number, y0: number, y1: number, c: number) { b.span(x0, x1, y0, y1, z0, z1, c, { bev: 0.05, wob: 0.035, col: true }); }
const C = { col: true } as const, NC = { col: 'nocam' } as const;
function band(b: B, x0: number, x1: number, z0: number, z1: number, y: number, c: number, h = 0.18, out = 0.06) { b.span(x0 - out, x1 + out, y, y + h, z0 + out, z1 - out, c, { wob: 0.02 }); }

export interface HouseOpt { wall?: number; roof?: number; trim?: number; no?: string; fenceC?: number; roofType?: 'limasan' | 'pelana'; tank?: number; sign?: string; }

// =============== 1. Tipe 36 ===============
export function tipe36(b: B, o: HouseOpt = {}) {
  const W = 8, wall = o.wall ?? 0xa8dcc4, roof = o.roof ?? 0xc4553a, trim = o.trim ?? TRIM;
  yard(b, W, -2.9); grassPatch(b, -3.85, -1.2, -0.2, -2.9);
  plinth(b, -3.4, 3.0, -2.9, -10.6);
  steps(b, -1.9, 1.2, -2.9);
  mass(b, -3.2, 2.8, -4.4, -10.4, 0, F + 3.0, wall);
  band(b, -3.2, 2.8, -4.4, -10.4, 0.0, shade(wall, 0.75), 0.42, 0.03);
  for (const x of [-3.05, 2.65]) { b.bx(0.26, 3.0, 0.26, x, F, -3.15, trim, { bev: 0.03, col: 'nocam' }); b.bx(0.36, 0.25, 0.36, x, F, -3.15, shade(trim, 0.9)); }
  b.span(-3.25, 2.85, F + 2.78, F + 3.0, -3.0, -3.3, trim);
  if ((o.roofType ?? 'limasan') === 'limasan') hipRoof(b, -0.2, F + 3.0, -6.75, 7.0, 8.1, 2.1, roof);
  else gableRoof(b, -0.2, F + 3.0, -6.75, 6.4, 7.7, 2.0, roof, wall, { oh: 0.35, ohEnd: 0.35 });
  const zf = -4.4;
  door(b, -1.9, F, 0.9, 2.1, zf, 0x8a5a36); roster(b, -1.9, F + 2.25, 0.9, zf, trim);
  win(b, 0.6, F + 0.9, 1.6, 1.3, zf, { teralis: 0x2b2b2b, roster: trim });
  win(b, 2.15, F + 1.4, 0.6, 0.8, zf, { mullion: false });
  b.sign(o.no ?? 'no1', 0.5, 0.25, -2.75, F + 2.3, zf + 0.03);
  pot(b, 2.2, F, -3.7, 1.1); pot(b, -0.5, F, -3.6, 0.9, 0x6dbb52); pot(b, -3.4, F, -3.5, 0.8, 0xd65a8a);
  // teras bench
  b.bx(1.2, 0.08, 0.4, 0.4, F + 0.42, -3.9, 0x7a5232); for (const x of [-0.1, 0.9]) b.bx(0.08, 0.42, 0.35, x, F, -3.9, 0x5d3c22);
  toren(b, 2.6, 0, -11.2, o.tank ?? 0xf08a24, 4.2);
  fence(b, -3.95, 3.95, -0.12, { style: 'besi', barC: o.fenceC ?? 0x2b2b2b, gates: [[-0.9, 3.95]] });
  tree(b, -2.6, -1.6, 0.62);
  bush(b, -3.5, 0, -2.6, 0.7); bush(b, -1.6, 0, -0.6, 0.55, 0x6dbb52);
}

// =============== 2. Tipe 45 + carport + kanopi ===============
export function tipe45(b: B, o: HouseOpt = {}) {
  const W = 9, wall = o.wall ?? 0xf6d77a, roof = o.roof ?? 0x9c5a3c, trim = o.trim ?? TRIM;
  yard(b, W, -5.6); grassPatch(b, -4.35, -1.4, -0.2, -4.3);
  // main + front room projection + service wing (dapur) behind carport
  plinth(b, -4.4, 1.6, -4.0, -11.9);
  mass(b, -4.3, 1.5, -5.6, -11.8, 0, F + 3.0, wall);
  mass(b, -4.3, -1.3, -4.4, -5.7, 0, F + 3.0, wall);
  mass(b, 1.6, 4.3, -6.2, -11.8, 0, F + 2.9, shade(wall, 0.93));
  band(b, -4.3, 1.5, -5.6, -11.8, 0, shade(wall, 0.72), 0.42, 0.03);
  band(b, -4.3, -1.3, -4.4, -5.7, 0, shade(wall, 0.72), 0.42, 0.03);
  gableRoof(b, -1.4, F + 3.0, -8.7, 5.8, 6.2, 1.9, roof, wall, { oh: 0.45, ohEnd: 0.4 });
  gableRoof(b, -2.8, F + 3.0, -5.0, 3.6, 3.0, 1.45, roof, wall, { along: 'z', oh: 0.35, ohEnd: 0.35 });
  b.span(1.45, 4.4, F + 2.9, F + 3.1, -6.1, -11.9, 0xd8d2c6, { wob: 0.02, col: true }); // dak
  b.span(1.45, 4.4, F + 3.1, F + 3.45, -6.1, -6.3, 0xd8d2c6, C); // parapet
  toren(b, 3.3, F + 3.1, -10.6, o.tank ?? 0x2f7fc4);
  parabola(b, 2.4, F + 3.1, -8.2, 0.6, 0.9);
  // teras dak canopy over door
  b.span(-1.4, 1.6, F + 2.85, F + 3.05, -4.0, -5.65, trim, C);
  b.bx(0.22, 2.85, 0.22, 1.35, F, -4.15, trim, { bev: 0.03, col: 'nocam' });
  plinth(b, -1.3, 1.5, -4.0, -5.6);
  // facades
  win(b, -2.8, F + 0.9, 1.7, 1.35, -4.4, { roster: trim, teralis: 0x1f5e48 });
  door(b, -0.5, F, 0.9, 2.1, -5.6, 0x6d4528); roster(b, -0.5, F + 2.22, 0.9, -5.6, trim);
  win(b, 0.85, F + 0.95, 0.8, 1.25, -5.6, {});
  b.sign(o.no ?? 'no2', 0.5, 0.25, 0.85, F + 2.55, -5.56);
  win(b, 3.0, F + 1.1, 1.0, 1.0, -6.2, { mullion: false });
  // AC on the side wall facing the carport
  b.push(1.5, 0, -8.4, Math.PI / 2); acUnit(b, 0, F + 2.0, 0); win(b, 1.8, F + 1.0, 1.0, 1.2, 0, {}); b.pop();
  // carport kanopi (polycarbonate on steel)
  const kc = 0xb9dde8, st = 0x3d4146;
  for (const x of [1.75, 4.25]) b.bx(0.1, 2.7, 0.1, x, 0, -0.5, st, { wob: 0, col: 'nocam' });
  b.span(1.6, 4.4, 2.7, 2.82, -0.4, -6.1, st, { wob: 0.01 }); b.col(1.6, 4.4, 2.7, 2.9, -0.4, -6.1);
  b.span(1.6, 4.4, 2.82, 2.86, -0.35, -6.1, kc, { wob: 0.02 });
  for (let z = -1.0; z > -6; z -= 1.1) b.span(1.6, 4.4, 2.86, 2.9, z - 0.04, z + 0.04, st, { wob: 0 });
  pot(b, -1.0, F, -4.2, 0.9, 0xd65a8a); pot(b, 1.0, F, -4.2, 0.8);
  fence(b, -4.45, 4.45, -0.12, { style: 'besi', barC: o.fenceC ?? 0x1f5e48, pillarC: 0xf2ead8, gates: [[-1.6, -0.5], [1.5, 4.45]] });
  bush(b, -3.6, 0, -1.2, 0.8); bush(b, -2.3, 0, -3.4, 0.6, 0x6dbb52); tree(b, -3.4, -3.0, 0.55);
}

// =============== 3. Minimalis 2 lantai ===============
export function minimalis(b: B, o: HouseOpt = {}) {
  const W = 8, wall = o.wall ?? 0xf1e4c8, dark = 0x4a4f57, wood = 0xa06a42, roof = o.roof ?? 0x4f4a48;
  const y1 = F + 3.0, y2 = y1 + H;
  yard(b, W, -4.5, 0xa9a49b); grassPatch(b, -3.85, -0.6, -0.2, -2.6);
  plinth(b, -3.8, 0.6, -3.0, -4.6);
  mass(b, -3.8, 3.8, -4.5, -11.8, 0, y1, wall);
  b.span(-3.85, 3.85, y1 - 0.02, y1 + 0.25, -4.45, -11.85, 0xe6e1d8, C); // slab lt.2
  // upper box A: cantilever over carport, framed
  mass(b, -0.4, 3.8, -2.4, -8.0, y1 + 0.25, y2, shade(wall, 1.03));
  b.span(-0.55, 3.95, y1 + 0.1, y2 + 0.5, -2.2, -2.45, dark, { bev: 0.04, col: true }); // portal frame front ring (solid; window sits on top)
  b.span(-0.55, 3.95, y1 + 0.1, y1 + 0.4, -2.2, -8.1, dark, C);
  b.span(-0.55, 3.95, y2, y2 + 0.5, -2.2, -8.1, dark, C);
  b.span(-0.55, -0.35, y1 + 0.1, y2 + 0.5, -2.2, -8.1, dark, C);
  b.span(3.75, 3.95, y1 + 0.1, y2 + 0.5, -2.2, -8.1, dark, C);
  // wood panel + big window on A front (in front of frame ring face z=-2.2)
  b.span(-0.35, 0.95, y1 + 0.4, y2, -2.22, -2.14, wood, { wob: 0.04 });
  for (let x = -0.25; x < 0.95; x += 0.16) b.span(x, x + 0.05, y1 + 0.4, y2, -2.14, -2.1, shade(wood, 0.8), { wob: 0 });
  win(b, 2.35, y1 + 0.7, 2.6, 1.9, -2.2, { frame: 0x2b2b2b });
  b.bx(0.24, y1 + 0.1, 0.24, 3.65, 0, -2.4, dark, NC); b.bx(0.24, y1 + 0.1, 0.24, -0.25, F, -2.4, dark, NC);
  // flat dak on A with toren
  b.span(-0.35, 3.75, y2, y2 + 0.12, -2.45, -8.0, 0xcfcac2, C);
  toren(b, 2.6, y2 + 0.12, -6.9, o.tank ?? 0xece6d6);
  // upper box B behind balcony with shed roof
  mass(b, -3.8, -0.4, -6.0, -11.8, y1 + 0.25, y2, wall);
  shedRoof(b, -3.8, -0.4, -6.0, -11.8, y2, y2 + 0.05, y2 + 1.25, roof, wall, 0.35);
  door(b, -2.1, y1 + 0.25, 1.6, 2.2, -6.0, GLASS_DOOR, { frame: 0x2b2b2b });
  // balcony railing
  for (let x = -3.75; x <= -0.45; x += 0.12) b.bx(0.03, 1.0, 0.03, x, y1 + 0.25, -4.55, 0x2b2b2b, { wob: 0 });
  b.span(-3.8, -0.4, y1 + 1.2, y1 + 1.28, -4.5, -4.62, 0x2b2b2b, { wob: 0 }); b.col(-3.8, -0.4, y1 + 0.25, y1 + 1.28, -4.62, -4.5, false);
  pot(b, -3.4, y1 + 0.25, -4.9, 0.8, 0x6dbb52);
  // ground floor facade
  b.span(-3.8, -2.85, F, y1, -4.42, -4.5, 0x8d8479, { wob: 0.08 }); // batu alam
  for (let y = F + 0.2; y < y1; y += 0.3) b.span(-3.8, -2.85, y, y + 0.04, -4.4, -4.44, 0x6f675e, { wob: 0 });
  door(b, -2.25, F, 0.9, 2.2, -4.5, 0x5b3a24); win(b, -1.0, F + 0.6, 1.4, 1.8, -4.5, { frame: 0x2b2b2b });
  win(b, 2.2, F + 1.0, 1.6, 1.2, -4.5, { frame: 0x2b2b2b });
  b.sign(o.no ?? 'no3', 0.5, 0.25, -3.3, F + 2.3, -4.38);
  b.push(-3.8, 0, -8.5, -Math.PI / 2); acUnit(b, 1.0, y1 + 1.2, 0); acUnit(b, -1.5, F + 2.0, 0); b.pop();
  fence(b, -3.95, 3.95, -0.12, { style: 'slat', barC: dark, pillarC: 0xd9d4cb, gates: [[0.6, 3.95]] });
  pot(b, 0.2, F, -3.4, 0.9); bush(b, -3.3, 0, -1.6, 0.7); bush(b, -1.4, 0, -2.0, 0.55, 0x6dbb52);
}
const GLASS_DOOR = 0x8fc4dc;

// =============== 4. Ruko (2 lantai, rolling door) ===============
export function ruko(b: B, o: HouseOpt = {}) {
  const W = 9, cA = 0xb9d9ec, cB = 0xf1e1c0, y1 = F + 3.0, y2 = y1 + H;
  b.span(-4.5, 4.5, 0, 0.12, -0.15, -2.0, 0xc9c2b4, { wob: 0.03, col: true }); // teras parkir
  // game: the shops are closed boxes (the open warung front is a painted etalase)
  for (const [x0, x1, c] of [[-4.4, 0, cA], [0, 4.4, cB]] as [number, number, number][]) mass(b, x0, x1, -2.0, -12.0, 0, y2, c);
  b.span(-4.45, 4.45, y2, y2 + 0.9, -1.95, -2.3, 0xf3efe6, { bev: 0.04, col: true }); // front parapet
  b.span(-4.45, 4.45, y2, y2 + 0.5, -2.3, -12.0, 0xf3efe6); b.col(-4.45, 4.45, y2, y2 + 0.5, -2.3, -12.0);
  for (const x of [-4.3, 0, 4.3]) b.span(x - 0.18, x + 0.18, 0, y2 + 0.9, -1.85, -2.05, 0xf3efe6, { bev: 0.03, col: true });
  b.span(-4.45, 4.45, y1, y1 + 0.28, -1.86, -2.05, 0xf3efe6);
  b.span(-4.4, 4.4, 0, 0.35, -1.95, -2.05, 0x9a9590);
  // unit A: warung, rolling door open
  b.span(-3.95, -0.35, 0.35, y1 - 0.25, -1.95, -2.0, 0x2a2420);
  b.sign('etalase', 3.5, 2.3, -2.15, 0.35 + 1.2, -1.94);
  b.span(-4.0, -0.3, y1 - 0.45, y1 - 0.05, -1.75, -2.0, 0xa7adb3, { bev: 0.04 }); // rolled-up door box
  // unit B: rolling door closed
  b.span(0.35, 3.95, 0.35, y1 - 0.2, -1.94, -2.0, 0xb9bec4);
  b.sign('rolling', 3.6, y1 - 0.55, 2.15, 0.35 + (y1 - 0.55) / 2, -1.92);
  b.span(1.9, 2.4, 0.35, 0.45, -1.88, -1.94, 0x555555);
  // awnings (seng)
  b.push(-2.15, y1 - 0.1, -2.0); b.bx(4.3, 0.06, 1.7, 0, 0, 0.82, 0x2e7d32, { rx: -0.22 }); b.pop();
  b.push(2.15, y1 - 0.1, -2.0); b.bx(4.3, 0.06, 1.7, 0, 0, 0.82, 0x1565c0, { rx: -0.22 }); b.pop();
  for (const x of [-4.2, -0.15, 0.15, 4.2]) b.beam([x, y1 - 0.45, -2.0], [x, y1 - 0.33, -3.3], 0.05, 0x555555);
  // signboards on the slab band
  b.sign(o.sign ?? 'warung', 3.7, 0.75, -2.15, y1 + 0.75, -1.82);
  b.sign('fotokopi', 3.7, 0.75, 2.15, y1 + 0.75, -1.82);
  // hanging sachets from the warung awning
  const sc = [0xe53935, 0xfdd835, 0x43a047, 0x1e88e5, 0xff7043, 0x8e24aa];
  for (let i = 0; i < 9; i++) { const x = -3.8 + i * 0.42; for (let k = 0; k < 6; k++) b.bx(0.16, 0.2, 0.02, x, y1 - 0.62 - k * 0.22 - (i % 2) * 0.1, -2.95, sc[(i + k) % sc.length], { wob: 0.05 }); }
  // gas melon + galon + etalase
  for (let i = 0; i < 5; i++) b.cyl(0.16, 0.16, 0.4, -3.6 + i * 0.36, 0.12, -2.4, 0x7cb342, 8);
  for (let i = 0; i < 3; i++) { b.cyl(0.14, 0.14, 0.42, -1.4 + i * 0.32, 0.12, -2.45, 0x4fa3e0, 8); b.cyl(0.05, 0.05, 0.08, -1.4 + i * 0.32, 0.54, -2.45, 0x1e88e5, 6); }
  b.span(-2.9, -1.8, 0.12, 1.1, -2.2, -2.6, 0x9fd0e6); b.span(-2.95, -1.75, 1.1, 1.16, -2.18, -2.62, 0x6d5544);
  // upper floor
  for (const x of [-3.2, -1.1, 1.1, 3.2]) win(b, x, y1 + 1.15, 1.2, 1.3, -2.0, { teralis: 0x2b2b2b });
  b.push(0, 0, -2.0); acUnit(b, -2.15, y1 + 2.65, 0); acUnit(b, 2.15, y1 + 2.65, 0); b.pop();
  // rooftop: toren, parabola, jemuran
  toren(b, -3.2, y2 + 0.01, -10.5, 0xf08a24, 1.2); parabola(b, 3.2, y2, -4.0, 0.3, 0.9);
  jemuran(b, -2.2, 2.0, -8.2, y2);
  b.span(-4.45, -4.35, y2, y2 + 1.0, -2.3, -12.0, 0xf3efe6, C); b.span(4.35, 4.45, y2, y2 + 1.0, -2.3, -12.0, 0xf3efe6, C);
}

// =============== 5. Rumah lama (teras tiang kayu) ===============
export function rumahLama(b: B, o: HouseOpt = {}) {
  const W = 9, wall = o.wall ?? 0xf3efe2, green = o.trim ?? 0x3f8a5a, roof = o.roof ?? 0x8a4a32, wood = 0x7a5232, FL = 0.5, yT = FL + 3.2;
  yard(b, W, -2.0, 0xbfb7a6); grassPatch(b, -4.35, 4.35, -0.2, -1.0);
  plinth(b, -4.0, 4.0, -2.0, -11.6, FL, 0xb7a48c);
  steps(b, 0, 1.6, -2.0, FL, 0xb7a48c);
  mass(b, -3.6, 3.6, -4.6, -11.4, 0, yT, wall);
  band(b, -3.6, 3.6, -4.6, -11.4, 0, 0x8f8a80, FL + 0.55, 0.03);
  hipRoof(b, 0, yT, -8.0, 8.2, 7.8, 2.8, roof, shade(roof, 0.8), 0xf2ece0);
  // emper roof on wooden posts
  const zp = -2.25;
  for (const x of [-3.6, -1.2, 1.2, 3.6]) { b.bx(0.2, 0.18, 0.2, x, FL, zp, 0x9e9e9e); b.bx(0.16, yT - FL - 0.75, 0.16, x, FL + 0.18, zp, wood, { wob: 0.06, col: 'nocam' }); }
  b.span(-3.85, 3.85, yT - 0.6, yT - 0.4, zp + 0.1, zp - 0.1, wood);
  b.push(0, yT - 0.35, -4.6); b.bx(8.2, 0.12, 2.95, 0, 0, 1.4, roof, { rx: Math.atan2(0.75, 2.6), wob: 0.05 }); b.pop();
  for (let i = 1; i < 5; i++) { const t = i / 5; b.push(0, yT - 0.35 - 0.75 * t * 1.05 + 0.1, -4.6 + 2.7 * t); b.bx(8.2, 0.04, 0.1, 0, 0.02, 0, shade(roof, 0.85), { rx: Math.atan2(0.75, 2.6), wob: 0 }); b.pop(); }
  b.span(-4.1, 4.1, yT - 1.25, yT - 1.05, -1.75, -1.85, 0xf2ece0); // lisplang
  // low wooden railing
  for (const [a, c] of [[-3.5, -1.3], [1.3, 3.5]]) {
    b.span(a, c, FL + 0.6, FL + 0.68, zp - 0.05, zp + 0.05, wood); b.col(a, c, FL, FL + 0.68, zp - 0.05, zp + 0.05, false);
    for (let x = a + 0.1; x < c; x += 0.18) b.bx(0.05, 0.6, 0.05, x, FL, zp, shade(wood, 1.1), { wob: 0 });
  }
  const zf = -4.6;
  door(b, 0, FL, 1.4, 2.3, zf, green, { double: true, frame: 0x5d3c22 }); roster(b, 0, FL + 2.45, 1.4, zf, TRIM);
  for (const x of [-2.4, 2.4]) win(b, x, FL + 0.85, 1.0, 1.45, zf, { style: 'kayu', frame: 0x5d3c22, shutter: green, roster: TRIM });
  b.sign(o.no ?? 'no4', 0.5, 0.25, 1.15, FL + 2.0, zf + 0.03);
  // kursi rotan + meja
  for (const x of [-2.2, -1.0]) { b.bx(0.55, 0.42, 0.5, x, FL, -3.5, 0xc8a165, { bev: 0.04 }); b.bx(0.55, 0.45, 0.08, x, FL + 0.42, -3.75, 0xc8a165); }
  b.bx(0.5, 0.45, 0.5, -1.6, FL, -3.45, 0x8d6e4a, { bev: 0.03 });
  b.bx(1.6, 0.4, 0.7, 2.4, FL, -3.3, 0x8d6e4a, { bev: 0.03 }); // bale-bale
  // antena TV on bamboo pole + jemuran
  b.cyl(0.06, 0.07, 7.4, 3.9, 0, -5.2, 0xc9b06a, 6);
  b.bx(0.05, 0.05, 1.6, 3.9, 7.1, -5.2, 0x9e9e9e, { wob: 0 }); for (let k = 0; k < 6; k++) b.bx(0.9 - k * 0.1, 0.03, 0.03, 3.9, 7.12, -5.9 + k * 0.28, 0x9e9e9e, { wob: 0 });
  jemuran(b, -4.2, -2.3, -1.4);
  fence(b, -4.45, 4.45, -0.12, { style: 'rendah', barC: 0xf2f2f2, pillarC: 0xf2f2f2, gates: [[-0.8, 0.8]] });
  tree(b, 3.1, -1.3, 0.9, 0x4f9e44); bush(b, 1.6, 0, -0.6, 0.6); bush(b, -1.4, 0, -0.5, 0.55, 0x6dbb52);
}

// =============== 6. Rumah terbengkalai ===============
export function terbengkalai(b: B) {
  const W = 8, wall = 0xb5ae98, roof = 0x9c6f5e, trim = 0xc9c2b0;
  grassPatch(b, -3.85, 3.85, -0.2, -2.9); b.span(-1.6, 0.0, 0, 0.13, -0.3, -2.9, 0x9b8b70, { wob: 0.1 }); // dirt path
  plinth(b, -3.4, 3.0, -2.9, -10.6, F, 0xa79f90);
  mass(b, -3.2, 2.8, -4.4, -10.4, 0, F + 3.0, wall);
  band(b, -3.2, 2.8, -4.4, -10.4, 0, 0x7f826a, 0.9, 0.03); // lumut / stains
  for (const [x, w, h] of [[-0.3, 0.25, 1.1], [1.4, 0.35, 0.8], [-2.6, 0.3, 1.3], [2.3, 0.2, 0.9]]) b.span(x, x + w, F + 3.0 - h, F + 3.0 - 0.05, -4.4, -4.36, 0x8e8774, { wob: 0.05 });
  // teras: one post replaced by a wooden prop, beam sagging
  b.bx(0.26, 3.0, 0.26, -3.05, F, -3.15, trim, { bev: 0.03, col: 'nocam' });
  b.bx(0.14, 3.0, 0.14, 2.65, F, -3.15, 0x7a5a3c, { rz: 0.05 }); b.col(2.58, 2.72, F, F + 3.0, -3.22, -3.08, false);
  b.span(-3.25, 2.85, F + 2.78, F + 3.0, -3.0, -3.3, trim, { rz: -0.012 });
  hipRoof(b, -0.2, F + 3.0, -6.75, 7.0, 8.1, 2.1, roof, 0x7d5a4c, 0xb0a898);
  // hole in the front slope with rafters
  const d = 7.0, h = 2.1, a = Math.atan2(h, d / 2); // hip end: run = min(w,d)/2
  for (const [tx, tt, w, l] of [[0.9, 0.4, 2.0, 1.7], [-1.0, 0.66, 0.8, 0.7]]) {
    const zz = -6.75 + 4.05 - (d / 2) * tt, yy = F + 3.0 + h * tt;
    b.push(tx, yy + Math.cos(a) * 0.04, zz + Math.sin(a) * 0.04, 0, a);
    b.bx(w, 0.03, l, 0, 0, 0, 0x16110e, { wob: 0 }); for (let k = 0; k < 5; k++) b.bx(0.34, 0.06, 0.26, rr(-w / 2, w / 2), 0.01, (rnd() > 0.5 ? 1 : -1) * (l / 2 + 0.05), shade(0x9c6f5e, rr(0.8, 1.05)), { ry: rr(-0.5, 0.5) });
    for (let k = -1; k <= 1; k++) if (w > 1) b.bx(0.1, 0.12, l + 0.2, k * w * 0.33, -0.02, 0, 0x8a6446, { wob: 0.05 });
    b.bx(w + 0.1, 0.08, 0.08, 0, 0.02, l / 2 - 0.1, 0x6d4c33, { wob: 0.05 });
    b.pop();
  }
  // fallen roof tiles on the terrace + yard
  for (let i = 0; i < 7; i++) b.bx(0.32, 0.05, 0.24, rr(-2.5, 2.4), i < 4 ? F : 0.11, i < 4 ? rr(-3.4, -4.2) : rr(-1.0, -2.6), shade(roof, rr(0.85, 1.1)), { ry: rr(0, 3), rz: rr(-0.1, 0.1) });
  const zf = -4.4;
  // door: dark opening boarded with X planks
  b.bx(0.9, 2.1, 0.06, -1.9, F, zf, 0x241d18);
  b.bx(0.14, 2.3, 0.05, -1.9, F + 0.0, zf + 0.08, 0x9b8466, { rz: 0.42 }); b.bx(0.14, 2.3, 0.05, -1.9, F + 0.0, zf + 0.1, 0x8a7458, { rz: -0.42 });
  b.span(-2.42, -1.38, F + 2.1, F + 2.2, zf + 0.02, zf - 0.04, 0x6d5544);
  win(b, 0.6, F + 0.9, 1.6, 1.3, zf, { style: 'papan', frame: 0x5d5148 });
  win(b, 2.15, F + 1.4, 0.6, 0.8, zf, { style: 'pecah', frame: 0x5d5148, mullion: false });
  b.sign('dijual', 1.15, 0.46, -0.8, F + 1.55, zf + 0.025);
  // vines on wall corner
  for (let i = 0; i < 6; i++) b.ico(rr(0.25, 0.4), -3.2 + rr(-0.05, 0.25), F + 0.3 + i * 0.45, -4.4 + rr(0, 0.25), [0x5f8a3a, 0x6d9a3a][i % 2], [1, 1.2, 0.7]);
  // overturned plastic chair
  b.push(1.2, F + 0.2, -3.7, 0.4, 0, 1.4); b.bx(0.45, 0.04, 0.45, 0, 0, 0, 0x2e7d9a); b.bx(0.45, 0.45, 0.04, 0, 0, -0.22, 0x2e7d9a); b.pop();
  // leaning old TV antenna
  b.push(2.6, 0, -11.0, 0, 0, -0.25); b.cyl(0.05, 0.06, 5.5, 0, 0, 0, 0x8a7d5a, 6); b.bx(0.04, 0.04, 1.2, 0, 5.3, 0, 0x7f7f7f, { wob: 0 }); for (let k = 0; k < 4; k++) b.bx(0.7 - k * 0.12, 0.03, 0.03, 0, 5.32, -0.45 + k * 0.3, 0x7f7f7f, { wob: 0 }); b.pop();
  weeds(b, -3.8, 3.8, -0.3, -2.9, 70, 1.3);
  weeds(b, -3.3, 2.9, -2.95, -3.1, 18, 0.7);
  for (let i = 0; i < 5; i++) bush(b, rr(-3.6, 3.6), 0, rr(-0.5, -2.6), rr(0.6, 1.0), [0x7a9a44, 0x6d9a3a, 0x8fae3e][i % 3]);
  fence(b, -3.95, 3.95, -0.12, { style: 'karat', barC: 0x7b4b30, pillarC: 0xa69e8c, gates: [[-0.9, 1.9]], gateOpen: true });
  for (let i = 0; i < 4; i++) b.ico(rr(0.25, 0.4), rr(-3.8, 3.8), 1.5, -0.12, 0x5f8a3a, [1.4, 0.7, 0.8]);
}

// =============== 7. Rumah orang kaya (kavling dobel) ===============
export function mewah(b: B) {
  const W = 14, wall = 0xf7f2e8, cream = 0xe6d9bc, roof = 0x4e5866, y1 = 0.5 + 3.3, y2 = y1 + 3.3, FL = 0.5;
  b.span(-6.95, 6.95, 0, 0.1, -0.15, -4.8, 0x9e9a92, { wob: 0.03, col: true }); // andesit driveway
  grassPatch(b, -6.9, 0.6, -0.3, -3.2);
  for (let x = -6.2; x < 0.4; x += 0.9) b.span(x, x + 0.45, 0.1, 0.14, -3.3, -4.7, 0xd8d2c4); // stepping stones
  plinth(b, -6.8, 3.2, -3.2, -12.0, FL, 0xe9e2d2);
  steps(b, -1.8, 3.6, -3.2, FL, 0xe9e2d2);
  mass(b, -6.6, 3.0, -5.0, -11.8, 0, y2, wall);
  for (const y of [y1, y2 - 0.05]) band(b, -6.6, 3.0, -5.0, -11.8, y, cream, 0.26, 0.08);
  band(b, -6.6, 3.0, -5.0, -11.8, 0, 0xd8ccb0, FL + 0.3, 0.04);
  hipRoof(b, -1.8, y2 + 0.2, -8.4, 11.0, 8.0, 2.6, roof, shade(roof, 0.75), cream);
  // portico: 4 tall columns + pediment
  for (const x of [-4.0, -2.65, -0.95, 0.4]) {
    b.bx(0.6, 0.35, 0.6, x, FL, -3.55, cream, { bev: 0.04 });
    b.cyl(0.2, 0.24, y2 - FL - 0.7, x, FL + 0.35, -3.55, 0xfbf8f0, 10); b.col(x - 0.3, x + 0.3, FL, y2, -3.85, -3.25, false);
    b.bx(0.6, 0.35, 0.6, x, y2 - 0.35, -3.55, cream, { bev: 0.04 });
  }
  b.span(-4.45, 0.85, y2, y2 + 0.4, -3.15, -5.0, cream, { bev: 0.04, col: true });
  gableRoof(b, -1.8, y2 + 0.4, -4.3, 2.7, 5.6, 1.5, roof, 0xfbf8f0, { along: 'z', oh: 0.3, ohEnd: 0.25 });
  // balcony slab + balustrade
  b.span(-4.5, 0.9, y1, y1 + 0.3, -3.1, -5.0, cream, { bev: 0.04, col: true });
  for (let x = -4.3; x <= 0.75; x += 0.2) { if (Math.abs(x + 4.0) < 0.25 || Math.abs(x + 2.65) < 0.25 || Math.abs(x + 0.95) < 0.25 || Math.abs(x - 0.4) < 0.25) continue; b.cyl(0.05, 0.07, 0.7, x, y1 + 0.3, -3.2, 0xfbf8f0, 6); }
  b.span(-4.5, 0.9, y1 + 1.0, y1 + 1.1, -3.1, -3.3, cream); b.col(-4.5, 0.9, y1 + 0.3, y1 + 1.1, -3.3, -3.1, false);
  // facade
  const zf = -5.0;
  door(b, -1.8, FL, 1.8, 2.7, zf, 0x5a3420, { double: true, frame: cream });
  b.span(-2.9, -0.7, FL + 2.75, FL + 3.0, zf, zf + 0.12, cream);
  door(b, -1.8, y1 + 0.3, 1.6, 2.3, zf, GLASS_DOOR, { double: true, frame: 0xf4efe4 });
  for (const x of [-5.4, -3.7, 0.3, 1.9]) { win(b, x, FL + 0.7, 1.0, 2.0, zf, { style: 'klasik', frame: 0xf4efe4 }); win(b, x, y1 + 0.75, 1.0, 1.8, zf, { style: 'klasik', frame: 0xf4efe4 }); }
  b.sign('emas', 0.6, 0.3, 0.3 + 0.95, FL + 1.5, zf + 0.03);
  // wall lanterns
  for (const x of [-3.15, -0.45]) { b.bx(0.2, 0.3, 0.2, x, FL + 2.0, zf + 0.15, 0x222222); b.bx(0.14, 0.2, 0.14, x, FL + 2.04, zf + 0.15, 0xfff1b0, { wob: 0 }); }
  // garage wing with roof terrace
  mass(b, 3.0, 6.8, -4.6, -11.8, 0, 3.6, wall);
  band(b, 3.0, 6.8, -4.6, -11.8, 3.3, cream, 0.3, 0.08);
  b.span(2.95, 6.9, 3.6, 3.75, -4.55, -11.85, 0xd8d2c6, C);
  for (let x = 3.1; x <= 6.7; x += 0.22) b.cyl(0.04, 0.05, 0.6, x, 3.75, -4.7, 0xfbf8f0, 6);
  b.span(2.95, 6.9, 4.35, 4.45, -4.6, -4.8, cream); b.col(2.95, 6.9, 3.75, 4.45, -4.8, -4.6, false);
  b.span(3.4, 6.4, 0.1, 2.6, -4.55, -4.62, 0xeeeeea, { wob: 0.02 });
  for (let y = 0.5; y < 2.6; y += 0.42) b.span(3.4, 6.4, y, y + 0.04, -4.5, -4.54, 0xc9c9c4, { wob: 0 });
  b.span(3.25, 6.55, 2.6, 2.8, -4.5, -4.7, cream);
  // AC units on the left side wall
  b.push(-6.6, 0, -8.4, -Math.PI / 2); acUnit(b, -1.0, 2.2, 0); acUnit(b, 1.0, 2.2, 0); acUnit(b, 0, y1 + 2.0, 0); b.pop();
  toren(b, 5.6, 3.75, -10.6, 0xece6d6); parabola(b, 4.0, 3.75, -9.5, 0.4, 1.0);
  // garden
  palm(b, -5.6, -1.6, 6.2); palm(b, 2.0, -1.3, 5.2);
  for (const [x, z] of [[-3.8, -2.6], [-2.2, -1.2], [-0.6, -2.6], [-6.3, -3.8], [0.3, -4.5]]) { b.cyl(0.05, 0.05, 0.3, x, 0, z, 0x6d4c33, 5); b.ico(0.38, x, 0.65, z, 0x3f8f3a, [1, 1, 1]); }
  fence(b, -6.95, 6.95, -0.12, { style: 'mewah', barC: 0x1d1d1d, pillarC: 0xf4efe4, gates: [[1.2, 6.2]] });
  // pos satpam
  b.span(5.9, 6.9, 0, 2.4, -0.9, -2.2, wall, { bev: 0.04, col: true }); b.span(5.8, 7.0, 2.4, 2.55, -0.8, -2.3, roof, C);
  win(b, 6.4, 1.0, 0.7, 0.8, -0.9, { mullion: false });
}

// =============== extras: musholla, pos ronda, lahan kosong ===============
export function musholla(b: B) {
  const wall = 0xf7f7f0, green = 0x2e8b57, y1 = 0.6 + 3.3;
  b.span(-4.9, 4.9, 0, 0.08, -0.15, -3.6, 0xc8c2b6, C);
  plinth(b, -3.6, 3.6, -3.4, -11.2, 0.6, 0xe3ddd0);
  steps(b, 0, 2.0, -3.4, 0.6, 0xe3ddd0);
  mass(b, -3.0, 3.0, -5.0, -11.0, 0, y1, wall);
  band(b, -3.0, 3.0, -5.0, -11.0, 0, green, 0.75, 0.03);
  band(b, -3.0, 3.0, -5.0, -11.0, y1 - 0.3, green, 0.3, 0.05);
  // serambi with slim columns + flat roof
  for (const x of [-3.2, -1.1, 1.1, 3.2]) { b.cyl(0.13, 0.13, y1 - 0.9, x, 0.6, -3.6, 0xf2f2ea, 8); b.col(x - 0.13, x + 0.13, 0.6, y1 - 0.3, -3.73, -3.47, false); }
  b.span(-3.5, 3.5, y1 - 0.3, y1 - 0.05, -3.35, -5.05, wall, C);
  b.span(-3.55, 3.55, y1 - 0.32, y1 - 0.2, -3.3, -5.05, green);
  // tajug roof (2 tiers) + mustaka
  frustum(b, 0, y1 + 0.0, -8.0, 4.1, 2.0, 1.3, green);
  b.span(-1.75, 1.75, y1 + 1.3, y1 + 1.95, -6.25, -9.75, wall, C);
  frustum(b, 0, y1 + 1.95, -8.0, 2.5, 0.12, 1.6, green);
  b.cyl(0.08, 0.14, 0.5, 0, y1 + 3.5, -8.0, 0xd4af37, 6); b.geo(new THREE.SphereGeometry(0.14, 6, 4), 0xd4af37, 0, y1 + 4.05, -8.0, { wob: 0 });
  const zf = -5.0;
  door(b, 0, 0.6, 1.4, 2.3, zf, 0x3a7a55, { double: true, frame: 0xd4af37 });
  for (const x of [-2.0, 2.0]) win(b, x, 0.6 + 0.9, 0.9, 1.5, zf, { frame: green, roster: green });
  b.sign('musholla', 2.6, 0.65, 0, y1 - 0.68, -3.33);
  // toa speakers on pole
  b.cyl(0.07, 0.08, 7.5, 3.9, 0, -5.0, 0x9aa0a6, 6); b.col(3.82, 3.98, 0, 7.5, -5.08, -4.92, false);
  for (const ry of [0.6, -0.6]) { b.push(3.9, 7.0, -5.0, ry); b.geo(new CONE(0.28, 0.5, 8), 0xdcdcdc, 0, 0, 0.3, { rx: -Math.PI / 2 - 0.25 }); b.pop(); }
  // sandals on the terrace
  const sc = [0x1e88e5, 0xe53935, 0x43a047, 0x212121];
  for (let i = 0; i < 6; i++) b.bx(0.12, 0.03, 0.26, -1.0 + i * 0.32 + rr(-0.05, 0.05), 0.6, -3.75 + rr(-0.1, 0.1), sc[i % 4], { ry: rr(-0.3, 0.3) });
  fence(b, -4.95, 4.95, -0.12, { style: 'rendah', barC: green, pillarC: 0xf2f2ea, gates: [[-1.4, 1.4]] });
  tree(b, -3.9, -1.8, 0.75); bush(b, 3.6, 0, -1.6, 0.7);
}
const CONE = THREE.ConeGeometry;

export function posRonda(b: B) {
  const wood = 0x8a5a36;
  for (const [x, z] of [[-1.0, -0.8], [1.0, -0.8], [-1.0, -2.6], [1.0, -2.6]]) b.bx(0.14, 2.3, 0.14, x, 0, z, wood, { wob: 0.06, col: 'nocam' });
  b.span(-1.1, 1.1, 0.5, 0.62, -0.7, -2.7, 0xa87a4c, { wob: 0.05 }); b.col(-1.1, 1.1, 0, 0.65, -2.7, -0.7);
  for (let x = -1.0; x < 1.05; x += 0.22) b.span(x, x + 0.18, 0.62, 0.65, -0.75, -2.65, 0xb88a5a, { wob: 0.05 });
  b.span(-1.1, 1.1, 0.62, 1.2, -2.62, -2.7, 0xa87a4c, NC);
  gableRoof(b, 0, 2.3, -1.7, 2.4, 2.4, 0.8, 0x7f9aa8, 0xa87a4c, { oh: 0.35, ohEnd: 0.25, rows: 4 });
  b.sign('ronda', 1.4, 0.4, 0, 2.05, -0.7);
  // kentongan
  b.beam([1.0, 2.0, -0.8], [1.0, 1.4, -0.8], 0.02, 0x333333);
  b.geo(new THREE.CylinderGeometry(0.11, 0.11, 0.7, 8), 0x9c6b3e, 1.0, 1.05, -0.72, { wob: 0.05 });
  b.bx(0.04, 0.4, 0.03, 1.0, 0.85, -0.6, 0x2a1e14);
}

export function lahanKosong(b: B) {
  weeds(b, -4.3, 4.3, -0.5, -11.5, 150, 1.0);
  for (let i = 0; i < 6; i++) bush(b, rr(-4, 4), 0, rr(-1, -11), rr(0.7, 1.2), [0x7a9a44, 0x6d9a3a, 0x8fae3e][i % 3]);
  pisang(b, -2.8, -6.5, 1.1); pisang(b, -1.6, -8.5, 0.95); pisang(b, 2.6, -9.0, 1.05);
  b.bx(0.08, 1.6, 0.08, -0.7, 0, -1.0, 0x6d4c33); b.bx(0.08, 1.6, 0.08, 0.7, 0, -1.0, 0x6d4c33);
  b.span(-0.8, 0.8, 1.2, 2.0, -0.96, -1.0, 0xfafafa); b.col(-0.8, 0.8, 0, 2.0, -1.04, -0.92, false); b.sign('tanah', 1.55, 0.78, 0, 1.6, -0.94);
  // pile of building sand + bricks (someone's future house)
  b.geo(new THREE.ConeGeometry(1.1, 0.8, 7), 0xd9c08a, 2.2, 0.4, -3.0, { wob: 0.08 });
  for (let i = 0; i < 3; i++) for (let j = 0; j < 4 - i; j++) b.bx(0.22, 0.1, 0.45, 0.4 + j * 0.24 + i * 0.12, i * 0.1, -3.2, 0xb5563a, { wob: 0.1 });
}

void rnd; void TRIM; void C;
