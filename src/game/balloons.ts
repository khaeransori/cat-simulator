// Mas Dodi, the travelling balloon seller (weekly drop "Tukang Balon Keliling").
// - walks the park paths and the street sidewalk with a bunch of balloons in his left hand
// - every day one of his balloons flies off and gets stuck somewhere in the park:
//   take it (Ambil) and bring it back (Kasih) for coins; the first time he gives the
//   "Balon di punggung" cosmetic
// - after the first chat of the day the cat can pop a balloon from his bunch (mischief
//   'balon_pecah'): DOR! He jumps and shoos the cat (never hurts it)
import * as THREE from 'three';
import { ctx, pick } from '../ctx';
import { Human } from '../entities/npc';
import { L, tr, type Pair } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { lam } from '../world/builder';
import { doMischief, addCoins } from './mischief';
import { ADULT_SCALE } from '../entities/humanModel';

const P = (id: string, en: string): Pair => ({ id, en });
const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const BALLOON_COLORS = [0xff4d6d, 0xffd23f, 0x4cc9f0, 0x80ed99, 0xc77dff];

/** where today's runaway balloon can get stuck (all reachable by the cat) */
export const STUCK_SPOTS: { id: string; pos: THREE.Vector3; name: Pair }[] = [
  { id: 'perosotan', pos: V(2.6, 1.6, 21.8), name: P('di atas perosotan', 'on top of the slide') },
  { id: 'bangku', pos: V(3.4, 0.5, 14.8), name: P('di bangku taman', 'on the park bench') },
  { id: 'dermaga', pos: V(-16.2, 0.3, 25), name: P('di dermaga kolam', 'on the pond dock') },
];

const balloonGeo = new THREE.IcosahedronGeometry(0.26, 1);

/** one balloon on a string, string bottom at the group origin */
export function balloonMesh(color: number, len = 0.9) {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({ color, flatShading: true, emissive: color, emissiveIntensity: 0.12 });
  const b = new THREE.Mesh(balloonGeo, mat);
  b.scale.set(1, 1.2, 1);
  b.position.y = len + 0.28;
  const knot = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.06), mat);
  knot.position.y = len - 0.01;
  const str = new THREE.Mesh(new THREE.BoxGeometry(0.012, len, 0.012), lam(0xf5f5f5));
  str.position.y = len / 2;
  const shine = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.08, 0.02), lam(0xffffff));
  shine.position.set(-0.1, len + 0.38, 0.21);
  g.add(str, knot, b, shine);
  g.userData.ball = b;
  return g;
}

const LINES = {
  idle: [P('Balon! Balon warna-warni!', 'Balloons! Colourful balloons!'), P('Ayo, balonnya, adik-adik!', 'Balloons, kids, come get one!'), P('Ada merah, kuning, biru!', 'Red, yellow, blue!')],
  meet: [
    P('Eh, ada kucing! Halo, pus. Aku Mas Dodi, tukang balon keliling.', "Oh, a kitty! Hello there. I'm Dodi, the balloon seller."),
  ],
  ask: [
    P('Aduh, tadi satu balonku terbang lalu nyangkut {where}. Tolong ambilin, ya?', 'Oh dear, one of my balloons flew off and got stuck {where}. Could you fetch it?'),
  ],
  thanksFirst: [
    P('Wah, balonku kembali! Makasih, pus pintar!', 'My balloon is back! Thank you, clever kitty!'),
    P('Ini hadiah: balon kecil buat diikat di punggungmu. Cocok banget!', "Here's a prize: a little balloon to tie on your back. It suits you!"),
  ],
  thanks: [P('Makasih lagi, pus! Kamu memang penolong balon.', 'Thanks again, kitty! You are the balloon helper.'), P('Hore, balonnya pulang! Nih, ikan buat kamu.', "Yay, the balloon is home! Here's a fish for you.")],
  later: [P('Makasih ya tadi! Besok pasti ada balon yang nyangkut lagi, hehe.', 'Thanks for earlier! Tomorrow another one will surely get stuck, hehe.')],
  pop: [P('DOR! Waduh, balonku!', 'POP! Oh no, my balloon!'), P('Eh eh, jangan dipecahin!', "Hey hey, don't pop them!")],
};

export class BalloonMan {
  npc: Human;
  bunch = new THREE.Group();
  balloons: THREE.Group[] = [];
  stuck: THREE.Group;
  spotI = 0;
  /** returned today / talked today */
  returned = false;
  talked = false;
  color = BALLOON_COLORS[0];

  constructor() {
    const pts = ctx.world.pts;
    pts.dodi = V(-11.5, 0, 9);
    const h = new Human('dodi', { skin: 0xc68e5f, top: 'kaos', topC: 0xff8f00, long: false, bottom: 'celana', botC: 0x3e4a59, head: 'topi', headC: 0x1565c0, hair: 0x1b1410, shoes: 0x5d4037, towel: true }, 'adult', pts.dodi, { x0: -30, z0: 3.2, x1: 12, z1: 39 }, 1.05);
    // park path → playground → back → out on the sidewalk and along the street → back into the park
    h.path = [V(-11.5, 0, 9), V(-11.5, 0, 17), V(-1, 0, 17), V(6.5, 0, 17.2), V(-6, 0, 17), V(-11.5, 0, 12), V(-11.5, 0, 4.3), V(-3.5, 0, 4.3), V(-11.5, 0, 4.3)];
    h.speed = 1.3;
    h.idleLines = LINES.idle;
    h.owns = [];
    this.npc = h;
    ctx.npcs.push(h);
    // the balloon bunch, held up in the left hand (world units inside a counter-scaled group)
    const hand = new THREE.Group();
    hand.position.set(0.2, -0.95, 0);
    h.model.armL.add(hand);
    hand.add(this.bunch);
    this.bunch.scale.setScalar(1 / ADULT_SCALE);
    const offs = [[0, 0, 1.75], [0.3, 0.12, 1.5], [-0.3, -0.05, 1.6], [0.12, -0.3, 1.4], [-0.15, 0.28, 1.9]];
    BALLOON_COLORS.forEach((c, i) => {
      const [x, z, len] = offs[i];
      const b = balloonMesh(c, len);
      b.rotation.set(z * 0.45, 0, -x * 0.45);
      this.bunch.add(b);
      this.balloons.push(b);
    });
    // today's runaway balloon (tied to its spot, bobbing)
    this.stuck = balloonMesh(this.color, 0.8);
    ctx.scene.add(this.stuck);

    const I = ctx.interact;
    const near = (r: number) => () => Math.hypot(ctx.cat.body.x - h.body.x, ctx.cat.body.z - h.body.z) < r && Math.abs(ctx.cat.body.y - h.body.y) < 1.2;
    const calm = () => h.active && (h.state === 'patrol' || h.state === 'wait' || h.state === 'look');
    const npcPos = new THREE.Vector3();
    I.add({
      id: 'dodi',
      label: () => (this.carrying() ? 'a_give' : 'a_talk'),
      icon: () => (this.carrying() ? '🎈' : '💬'),
      pos: npcPos,
      r: 1.9,
      yTol: 1.2,
      priority: 0.5,
      enabled: () => {
        npcPos.set(h.body.x, h.body.y, h.body.z);
        return calm() && near(1.9)() && (this.carrying() || (!ctx.cat.carrying && !this.talked));
      },
      act: () => this.talk(),
    });
    const popPos = new THREE.Vector3();
    I.add({
      id: 'balon_pecah',
      mischief: 'balon_pecah',
      label: 'a_pop',
      icon: '🎈',
      pos: popPos,
      r: 1.7,
      yTol: 1.2,
      enabled: () => {
        popPos.set(h.body.x, h.body.y, h.body.z);
        return calm() && this.talked && !ctx.cat.carrying && this.balloons.some((b) => b.visible) && near(1.7)();
      },
      act: () => this.pop(),
    });
    I.add({
      id: 'balon_ambil',
      label: 'a_take',
      icon: '🎈',
      pos: this.stuckPos(),
      r: 1.0,
      yTol: 0.7,
      priority: -0.3, // nearby mischief wins
      enabled: () => !this.returned && !ctx.cat.carrying && this.stuck.parent === ctx.scene,
      act: () => this.take(),
    });
    this.reset();
  }

  stuckPos() {
    return STUCK_SPOTS[this.spotI].pos;
  }
  carrying() {
    return ctx.cat.carrying?.id === 'balon';
  }

  /** new day: full bunch, a new runaway balloon at a random spot */
  reset() {
    for (const b of this.balloons) b.visible = true;
    this.returned = false;
    this.talked = false;
    this.spotI = ctx.forceBalloonSpot ?? Math.floor(Math.random() * STUCK_SPOTS.length);
    this.color = pick(BALLOON_COLORS);
    const it = ctx.interact.list.find((i: any) => i.id === 'balon_ambil');
    if (it) it.pos = this.stuckPos();
    this.recolor(this.color);
    this.home();
  }

  private recolor(c: number) {
    const ball = this.stuck.userData.ball as THREE.Mesh;
    const m = ball.material as THREE.MeshLambertMaterial;
    m.color.setHex(c);
    m.emissive.setHex(c);
  }

  /** put the runaway balloon back on its spot */
  home() {
    const p = this.stuckPos();
    ctx.scene.add(this.stuck);
    this.stuck.position.copy(p);
    this.stuck.rotation.set(0, 0, 0);
    this.stuck.scale.setScalar(1);
    this.stuck.visible = !this.returned;
  }

  /** the cat let go of the balloon: it floats back to where it was stuck */
  dropped() {
    this.home();
    const p = this.stuckPos();
    ctx.fx.sparkle(p.x, p.y + 1, p.z, 5);
    ctx.ui.toast('🎈 ' + tr('balloonBack'), 2.2);
  }

  take() {
    const cat = ctx.cat;
    cat.model.carry.add(this.stuck);
    this.stuck.position.set(0, 0, 0);
    this.stuck.rotation.set(0, 0, 0);
    this.stuck.scale.setScalar(0.85);
    cat.carrying = { id: 'balon', obj: this.stuck };
    sfx.pop();
    ctx.ui.toast('🎈 ' + tr('balloonGot'), 2.4);
  }

  dialog(lines: Pair[], done: () => void, vars: Record<string, string> = {}) {
    const fill = (s: string) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
    ctx.ui.dialog(
      lines.map((l) => ({ who: L(P('Mas Dodi', 'Dodi')), text: fill(L(l)), face: 'dodi' })),
      done,
    );
  }

  talk() {
    const h = this.npc;
    const s = ctx.save.balon;
    const b = ctx.cat.body;
    // he stops and turns to the cat while they chat
    h.state = 'look';
    h.stateT = -60;
    h.lookAt.set(b.x, 0, b.z);
    h.model.setMouth('grin');
    const end = () => {
      h.state = 'wait';
      h.stateT = 0;
      h.waitT = 1.2;
      h.model.setMouth('smile');
    };
    if (this.carrying()) {
      // give the balloon back
      const obj = this.stuck;
      ctx.cat.carrying = null;
      obj.parent?.remove(obj);
      this.returned = true;
      this.talked = true;
      // it joins his bunch again (the popped slot comes back, if any)
      const gone = this.balloons.find((x) => !x.visible);
      if (gone) gone.visible = true;
      s.n++;
      const first = !s.got;
      s.got = true;
      s.met = true;
      ctx.fx.hearts(h.body.x, h.body.y + 2, h.body.z, 5);
      sfx.jingle();
      ctx.quests?.onEvent?.('balloon');
      this.dialog(first ? LINES.thanksFirst : [pick(LINES.thanks)], () => {
        end();
        if (first) {
          ctx.save.owned['back:balon'] = true;
          addCoins(15);
          ctx.ui.banner('🎈', tr('reward', { r: '' }).replace(':', '').trim(), `${tr('balloonItem')} · +15 🐟`, 0);
        } else {
          addCoins(5);
          ctx.ui.toast('🎈 +5 🐟', 2);
        }
        ctx.album?.check();
        writeSave(ctx.save);
      });
      return;
    }
    this.talked = true;
    const lines: Pair[] = [];
    if (!s.met) lines.push(...LINES.meet);
    s.met = true;
    if (this.returned) lines.push(...LINES.later);
    else lines.push(...LINES.ask);
    sfx.voice(1.05, 0.1);
    this.dialog(lines, () => {
      end();
      writeSave(ctx.save);
      if (!this.returned) ctx.ui.toast('🎈 ' + L(STUCK_SPOTS[this.spotI].name), 2.6);
    }, { where: L(STUCK_SPOTS[this.spotI].name) });
  }

  pop() {
    const h = this.npc;
    const vis = this.balloons.filter((b) => b.visible);
    const b = vis[vis.length - 1];
    if (!b) return;
    const wp = new THREE.Vector3();
    (b.userData.ball as THREE.Object3D).getWorldPosition(wp);
    b.visible = false;
    const cb = ctx.cat.body;
    cb.vy = 6; // a big hop up to the balloons
    cb.onGround = false;
    ctx.cat.doAction('paw', 0.35);
    sfx.tone(180, 0.12, 'square', 0.18, 0, 60);
    sfx.pop();
    const col = ((b.userData.ball as THREE.Mesh).material as THREE.MeshLambertMaterial).color.getHex();
    ctx.fx.burst(wp.x, wp.y, wp.z, col, 16, { speed: 3, up: 2, size: 0.07, life: 1.1 });
    ctx.fx.burst(wp.x, wp.y, wp.z, 0xffffff, 8, { speed: 2.5, up: 2, size: 0.05, life: 0.9 });
    doMischief('balon_pecah');
    h.say(LINES.pop, 1.6, 'shout');
    h.alert();
  }

  update(dt: number) {
    const h = this.npc;
    // keep the bunch upright whatever the arm does, swaying gently
    if (h.active) {
      const q = h.model.armL.quaternion.clone().invert();
      this.bunch.quaternion.copy(q);
      this.bunch.rotateZ(Math.sin(ctx.time * 1.3) * 0.06);
    }
    const t = ctx.time;
    if (this.stuck.parent === ctx.scene) {
      const p = this.stuckPos();
      this.stuck.position.set(p.x, p.y, p.z);
      this.stuck.rotation.set(Math.sin(t * 1.7) * 0.12, 0, Math.cos(t * 1.3) * 0.12);
    } else if (this.carrying()) {
      this.stuck.rotation.set(-0.15 + Math.sin(t * 3) * 0.08, 0, Math.sin(t * 2.2) * 0.1);
    }
    void dt;
  }
}
