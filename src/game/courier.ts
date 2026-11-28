// Mas Bayu, the parcel courier (weekly drop "Pesta & Paket").
// - comes in along the street sidewalk with a parcel in his arms, walks into the home yard and
//   leaves it on the teras ("Paket! Ting tong!"), then goes on along the street to Bu Siti's gate
// - the parcel box on the teras: scratch it open (mischief 'kardus_paket', area rumah), then the
//   open box is a hideout: while the cat naps inside, nobody can see it (chasing grown-ups give up)
// - hiding in a box on 3 different days gives the sticker "Raja Kardus" (+ the Topi kardus hat)
// - daylight only (night: he is not working); umbrella in the rain
import * as THREE from 'three';
import { ctx, pick } from '../ctx';
import { Human } from '../entities/npc';
import { L, type Pair } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { mbox } from '../world/builder';
import { doMischief } from './mischief';
import { decorPlaced } from './decor';

const P = (id: string, en: string): Pair => ({ id, en });
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

/** where the parcel ends up: on the home teras, east of the door (clear of Mama's route at x -14.2) */
export const PARCEL_POS = V(-11.6, 0.2, -10.6);
/** route index of the teras stop */
const TERAS_I = 3;
/** the decor cardboard house inside (decor.ts 'kardus' sleep spot) */
const DECOR_BOX = V(-12.6, 0, -18.25);

const C = 0xc9955a, CT = 0xdcae72, TAPE = 0xe8d6a8;

const LINES = {
  idle: [P('Paket! Paket!', 'Parcel! Parcel!'), P('Permisi, paket!', 'Excuse me, delivery!'), P('Hari ini kirimannya banyak...', 'So many parcels today...')],
  meet: [P('Halo, pus! Aku Mas Bayu, kurir paket.', "Hi kitty! I'm Bayu, the parcel courier.")],
  before: [P('Ada paket buat rumahmu, lho. Nanti kutaruh di teras, ya!', "There's a parcel for your house. I'll leave it on the porch!")],
  after: [
    P('Paketnya sudah kutaruh di teras. Kardusnya enak buat ngumpet, lho!', "The parcel is on the porch. The box is great for hiding in!"),
    P('Psst... kalau kamu ngumpet di kardus, orang nggak bisa lihat kamu!', "Psst... hide in a box and nobody can see you!"),
  ],
  deliver: [P('Paket! Ting tong!', 'Delivery! Ding dong!'), P('Permisi, paketnya kutaruh di teras ya!', "Excuse me, I'll leave it on the porch!")],
};

export class Courier {
  npc: Human;
  parcel = new THREE.Group(); // closed parcel (in his arms or on the teras)
  open = new THREE.Group(); // opened box with flaps up (the hideout)
  state: 'hand' | 'teras' | 'open' = 'hand';
  talked = false;
  /** hid in a box today (counted once per day) */
  hidToday = false;
  /** colliders of the open box on the teras (walls; front stays open) */
  cols: any[] = [];

  constructor() {
    const pts = ctx.world.pts;
    pts.kurir = V(17, 0, -4.3);
    pts.paket = PARCEL_POS.clone();
    // long-sleeved red courier shirt, long dark trousers, red cap, sneakers
    const h = new Human('bayu', { skin: 0xb87a4b, top: 'kaos', topC: 0xd32f2f, long: true, bottom: 'celana', botC: 0x263238, head: 'topi', headC: 0xc62828, hair: 0x1b1410, shoes: 0xeeeeee }, 'adult', pts.kurir, { x0: -24, z0: -14, x1: 19, z1: -2 }, 0.95);
    // in along the sidewalk -> into the home yard -> teras -> back out -> along to Bu Siti's gate -> back
    h.path = [V(17, 0, -4.3), V(-14, 0, -4.3), V(-14, 0, -6.6), V(-12.2, 0, -9.3), V(-14, 0, -6.6), V(-14, 0, -4.3), V(8, 0, -4.3), V(8, 0, -6.6), V(8, 0, -4.3)];
    h.speed = 1.35;
    h.idleLines = LINES.idle;
    h.owns = [];
    this.npc = h;
    ctx.npcs.push(h);

    this.buildParcel();
    this.buildOpen();
    // the open box's walls (switched on only while it stands open on the teras)
    const p = PARCEL_POS, hw = 0.5, hd = 0.42, t = 0.05, top = p.y + 0.72;
    const wall = (x0: number, z0: number, x1: number, z1: number) => ({ minX: x0, minY: p.y, minZ: z0, maxX: x1, maxY: top, maxZ: z1, cam: false, off: true, tag: 'kardus_paket' });
    this.cols = [wall(p.x - hw, p.z - hd, p.x + hw, p.z - hd + t), wall(p.x - hw, p.z - hd, p.x - hw + t, p.z + hd), wall(p.x + hw - t, p.z - hd, p.x + hw, p.z + hd)];
    for (const c of this.cols) ctx.world.phys.add(c);

    const I = ctx.interact;
    const near = (r: number) => Math.hypot(ctx.cat.body.x - h.body.x, ctx.cat.body.z - h.body.z) < r && Math.abs(ctx.cat.body.y - h.body.y) < 1.2;
    const calm = () => h.active && (h.state === 'patrol' || h.state === 'wait' || h.state === 'look');
    const npcPos = new THREE.Vector3();
    I.add({
      id: 'bayu',
      label: 'a_talk',
      icon: '💬',
      pos: npcPos,
      r: 1.7,
      yTol: 1.2,
      priority: 0.2,
      enabled: () => {
        npcPos.set(h.body.x, h.body.y, h.body.z);
        return calm() && !this.talked && !ctx.cat.carrying && near(1.7);
      },
      act: () => this.talk(),
    });
    I.add({
      id: 'kardus_paket',
      mischief: 'kardus_paket',
      label: 'a_unbox',
      icon: '📦',
      pos: V(p.x, p.y, p.z + 0.45),
      r: 1.0,
      yTol: 0.6,
      enabled: () => this.state === 'teras' && !ctx.cat.carrying,
      act: () => this.unbox(),
    });
    I.add({
      id: 'kardus_ngumpet',
      label: 'a_hide',
      icon: '📦',
      pos: V(p.x, p.y, p.z + 0.5),
      r: 0.95,
      yTol: 0.6,
      enabled: () => this.state === 'open' && !ctx.cat.carrying,
      act: () => this.hide(),
    });
    // hidden cats can't be seen (npc.ts asks this)
    ctx.catHidden = () => this.catHidden();
    this.reset();
  }

  private buildParcel() {
    const g = this.parcel;
    g.add(mbox(0.9, 0.6, 0.76, C, 0, 0.3, 0));
    g.add(mbox(0.91, 0.02, 0.77, CT, 0, 0.6, 0));
    g.add(mbox(0.16, 0.012, 0.78, TAPE, 0, 0.61, 0)); // tape over the top
    g.add(mbox(0.16, 0.36, 0.012, TAPE, 0, 0.43, 0.385));
    g.add(mbox(0.3, 0.18, 0.012, 0xffffff, 0.24, 0.26, 0.386)); // address label (blank)
    g.add(mbox(0.2, 0.02, 0.013, 0x546e7a, 0.24, 0.3, 0.387));
    g.add(mbox(0.14, 0.02, 0.013, 0x546e7a, 0.21, 0.24, 0.387));
    // "this way up" arrows
    g.add(mbox(0.04, 0.14, 0.012, 0x5d4037, -0.28, 0.32, 0.386), mbox(0.12, 0.03, 0.012, 0x5d4037, -0.28, 0.4, 0.386));
    ctx.scene.add(g);
  }

  private buildOpen() {
    const g = this.open;
    const hw = 0.5, hd = 0.42, hh = 0.72, t = 0.05; // big enough for the whole cat (decor box is 1.1 x 0.9)
    g.add(mbox(hw * 2, hh, t, C, 0, hh / 2, -hd + t / 2)); // back
    g.add(mbox(t, hh, hd * 2, C, -hw + t / 2, hh / 2, 0));
    g.add(mbox(t, hh, hd * 2, C, hw - t / 2, hh / 2, 0));
    g.add(mbox(hw * 2 - t * 2, 0.02, hd * 2 - t, 0x7a5532, 0, 0.012, 0.02)); // dark floor
    g.add(mbox(hw * 2 - t * 2, hh - 0.06, 0.01, 0x8a6038, 0, hh / 2, -hd + t + 0.006)); // inside shade
    // front: a low lip (the cat steps over), flaps standing open
    g.add(mbox(hw * 2, 0.1, t, C, 0, 0.05, hd - t / 2));
    const flap = (x: number, z: number, w: number, d: number, rx: number, rz: number) => {
      const f = mbox(w, 0.03, d, CT, 0, 0, 0);
      f.position.set(x, hh + 0.02, z);
      f.rotation.set(rx, 0, rz);
      g.add(f);
      return f;
    };
    flap(-hw - 0.16, 0, 0.36, hd * 2, 0, 0.9);
    flap(hw + 0.16, 0, 0.36, hd * 2, 0, -0.9);
    flap(0, -hd - 0.13, hw * 2, 0.32, -0.8, 0);
    // a drawn cat face on the side + scraps of bubble wrap
    g.add(mbox(0.012, 0.2, 0.26, 0x5b3a1e, -hw - 0.004, 0.42, 0.02));
    for (const [x, z] of [[0.68, 0.5], [-0.72, 0.46], [0.25, 0.62]]) g.add(mbox(0.16, 0.02, 0.12, 0xe3f2fd, x, 0.012, z));
    g.position.copy(PARCEL_POS);
    g.visible = false;
    ctx.scene.add(g);
  }

  /** new day: he is back on his round with a fresh parcel */
  reset() {
    this.talked = false;
    this.hidToday = false;
    this.setState('hand');
  }

  setState(s: Courier['state']) {
    this.state = s;
    const h = this.npc;
    if (s === 'hand') {
      h.model.holdSlot.add(this.parcel);
      // the hold slot lives in rig units (x ADULT_SCALE): counter-scale to world size
      this.parcel.scale.setScalar(0.75 / h.model.inner.scale.x); // a bit smaller in his arms
      this.parcel.position.set(0, -0.6, 0.1);
      this.parcel.rotation.set(0, 0, 0);
      this.parcel.visible = true;
    } else if (s === 'teras') {
      ctx.scene.add(this.parcel);
      this.parcel.scale.setScalar(1);
      this.parcel.position.copy(PARCEL_POS);
      this.parcel.rotation.set(0, 0.15, 0);
      this.parcel.visible = true;
    } else this.parcel.visible = false;
    this.open.visible = s === 'open';
    for (const c of this.cols) c.off = s !== 'open';
  }

  /** the cat naps inside a box: the teras parcel, or the Rumah Kucing cardboard house */
  catHidden() {
    const c = ctx.cat;
    if (c.state !== 'sleep') return false;
    const b = c.body;
    if (this.state === 'open' && Math.hypot(b.x - PARCEL_POS.x, b.z - PARCEL_POS.z) < 0.5) return true;
    return decorPlaced('kardus') && Math.hypot(b.x - DECOR_BOX.x, b.z - DECOR_BOX.z) < 0.45;
  }

  /** count a hiding day (sticker "Raja Kardus") */
  countHide() {
    if (this.hidToday) return;
    this.hidToday = true;
    const s = ctx.save.kurir;
    s.hid++;
    ctx.album?.check();
    writeSave(ctx.save);
  }

  dialog(lines: Pair[], done: () => void) {
    ctx.ui.dialog(
      lines.map((l) => ({ who: L(P('Mas Bayu', 'Bayu')), text: L(l), face: 'bayu' })),
      done,
    );
  }

  talk() {
    const h = this.npc;
    const s = ctx.save.kurir;
    const b = ctx.cat.body;
    h.state = 'look';
    h.stateT = -60;
    h.lookAt.set(b.x, 0, b.z);
    h.model.setMouth('grin');
    this.talked = true;
    const lines: Pair[] = [];
    if (!s.met) lines.push(...LINES.meet);
    s.met = true;
    lines.push(this.state === 'hand' ? LINES.before[0] : pick(LINES.after));
    sfx.voice(0.95, 0.1);
    this.dialog(lines, () => {
      h.state = 'wait';
      h.stateT = 0;
      h.waitT = 1.2;
      h.model.setMouth('smile');
      writeSave(ctx.save);
    });
  }

  /** at the teras stop: put the parcel down, ring the bell */
  deliver() {
    const h = this.npc;
    this.setState('teras');
    h.say(LINES.deliver, 2.2, 'shout');
    sfx.tone(1320, 0.22, 'sine', 0.16, 0);
    sfx.tone(1050, 0.3, 'sine', 0.16, 0.26);
    ctx.fx.sparkle(PARCEL_POS.x, PARCEL_POS.y + 0.6, PARCEL_POS.z, 6);
    const c = ctx.cat.body;
    if (Math.hypot(c.x - PARCEL_POS.x, c.z - PARCEL_POS.z) < 25) ctx.ui.toast('📦 ' + L(P('Ada paket di teras!', 'A parcel on the porch!')), 2.6);
  }

  unbox() {
    const cat = ctx.cat;
    const b = cat.body;
    cat.yaw = Math.atan2(PARCEL_POS.x - b.x, PARCEL_POS.z - b.z);
    sfx.scratch();
    cat.doAction('scratch', 1.1, () => {
      this.setState('open');
      sfx.paper();
      ctx.after(0.15, () => sfx.pop());
      ctx.after(0.3, () => sfx.pop());
      ctx.fx.burst(PARCEL_POS.x, PARCEL_POS.y + 0.6, PARCEL_POS.z, 0xe3f2fd, 14, { speed: 2.2, up: 2.5, size: 0.07, life: 1.0 });
      ctx.fx.burst(PARCEL_POS.x, PARCEL_POS.y + 0.6, PARCEL_POS.z, C, 8, { speed: 2, up: 2, size: 0.05, life: 0.8 });
      doMischief('kardus_paket');
      ctx.after(1.6, () => ctx.ui.toast('💡 ' + L(P('Masuk ke kardus buat ngumpet!', 'Get in the box to hide!')), 2.8));
    });
  }

  hide() {
    ctx.cat.sleepAt(PARCEL_POS.clone(), 0); // facing out of the open front
    ctx.ui.toast('📦 ' + L(P('Ssst... ngumpet di kardus! Nggak ada yang bisa lihat kamu.', "Shh... hiding in the box! Nobody can see you.")), 2.8);
    this.countHide();
  }

  update(dt: number) {
    const h = this.npc;
    // drop the parcel when he reaches the teras stop
    // (or, if something blocked him there, as soon as he moves on past it)
    if (this.state === 'hand' && h.active && ((h.state === 'wait' && h.pathI === TERAS_I && Math.hypot(h.body.x - h.path[TERAS_I].x, h.body.z - h.path[TERAS_I].z) < 0.6) || h.pathI > TERAS_I)) {
      this.deliver();
    }
    // he walks with the parcel held in both arms
    h.walkPose = this.state === 'hand' ? 'carry' : 'walk';
    // the decor cardboard house counts as hiding too
    if (this.catHidden()) this.countHide();
    void dt;
  }
}
