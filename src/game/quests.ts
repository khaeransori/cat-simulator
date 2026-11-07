import * as THREE from 'three';
import { ctx } from '../ctx';
import { L, tr, type Pair } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { addCoins, MBY, dropCarried } from './mischief';
import { ITEMS, key, type Slot } from '../cosmetics';
import { genQuest, specialQuest } from './questgen';

const P = (id: string, en: string): Pair => ({ id, en });

export interface QDef {
  id: string;
  type: 'fish' | 'set' | 'bring' | 'gold' | 'perfect' | 'combo' | 'event' | 'sneaky' | 'visit';
  goal: number;
  set?: string[];
  title: Pair;
  intro: Pair[];
  remind: Pair;
  done: Pair[];
  coins: number;
  items: string[]; // slot:id
  unlock?: 'pasar' | 'atap';
  target?: string; // point name for the guide arrow
  fish?: string; // fish quests: only this species counts
  kind?: string; // generated bonus quests: template name
  window?: number; // combo: max seconds between mischiefs
  ev?: 'eat' | 'hug' | 'shoo' | 'meow' | 'coins'; // event quests
  distinct?: boolean; // event quests: count each source once
  spots?: string[]; // visit: world point names
  spotNames?: Pair[];
  special?: boolean; // ⭐ special challenge (harder, cosmetic reward)
}

// ----- shared progress tracking (Lisa, the other cat friends and the daily challenges) -----
export type QSt = { stage: string; prog: any };

export function qProgress(q: QDef, st: QSt): { n: number; g: number } {
  const pr = st.prog || {};
  if (q.type === 'set') return { n: (pr.set || []).length, g: q.goal };
  if (q.type === 'perfect') return { n: ctx.day ? ctx.day.doneToday.size : 0, g: q.goal };
  if (q.type === 'visit') return { n: (pr.v || []).length, g: q.goal };
  return { n: pr.n || 0, g: q.goal };
}

export function tFish(q: QDef, s: QSt, type: string) {
  if (q.type === 'fish') {
    if (q.fish ? type !== q.fish : type === 'sepatu') return false;
    s.prog.n = (s.prog.n || 0) + 1;
    return true;
  }
  if (q.type === 'gold' && type === 'emas') {
    s.prog.n = 1;
    return true;
  }
  return false;
}

export function tMischief(q: QDef, s: QSt, id: string, loud = true) {
  if (q.type === 'set' && (!q.set || q.set.includes(id))) {
    s.prog.set = s.prog.set || [];
    if (s.prog.set.includes(id)) return false;
    s.prog.set.push(id);
    return true;
  }
  if (q.type === 'sneaky') {
    s.prog.n = (s.prog.n || 0) + 1;
    return true;
  }
  if (q.type === 'combo') {
    const t = ctx.day ? ctx.day.playT : ctx.time;
    const gap = t - (s.prog.t ?? -1e9);
    s.prog.n = gap >= 0 && gap <= (q.window || 40) ? (s.prog.n || 0) + 1 : 1;
    s.prog.t = t;
    if (loud && s.prog.n > 1 && s.prog.n < q.goal) ctx.ui.toast(`⚡ ${s.prog.n}/${q.goal}`, 1.2);
    return true;
  }
  return false;
}

/** 0 = nothing, 1 = progress, 2 = ninja count was reset */
export function tEvent(q: QDef, s: QSt, ev: string, amount = 1, key = '', loud = true): 0 | 1 | 2 {
  if (q.type === 'sneaky' && ev === 'shoo' && (s.prog.n || 0) > 0) {
    s.prog.n = 0;
    if (loud) ctx.ui.toast('🥷 0/' + q.goal, 1.6);
    return 2;
  }
  if (q.type !== 'event' || q.ev !== ev) return 0;
  if (q.distinct) {
    if (!key) return 0;
    s.prog.k = s.prog.k || [];
    if (s.prog.k.includes(key)) return 0;
    s.prog.k.push(key);
    s.prog.n = s.prog.k.length;
    if (loud) ctx.ui.toast(`🗣️ ${s.prog.n}/${q.goal}`, 1.2);
  } else s.prog.n = (s.prog.n || 0) + amount;
  return 1;
}

/** Visit quests: tick off spots the cat reaches. True when a new spot was reached. */
export function tVisit(q: QDef, s: QSt, loud = true) {
  if (q.type !== 'visit' || !q.spots) return false;
  const cb = ctx.cat.body;
  const W = ctx.world;
  s.prog.v = s.prog.v || [];
  let hit = false;
  q.spots.forEach((p, i) => {
    if (s.prog.v.includes(p)) return;
    const pt = W.pts[p];
    if (!pt) return;
    if (Math.hypot(pt.x - cb.x, pt.z - cb.z) < 2.4 && Math.abs(pt.y - cb.y) < 1.6) {
      s.prog.v.push(p);
      hit = true;
      if (loud) {
        sfx.coin();
        ctx.ui.toast(`📍 ${q.spotNames ? L(q.spotNames[i]) : ''}  ${s.prog.v.length}/${q.goal}`, 1.8);
      }
    }
  });
  return hit;
}

/** Guide-arrow target for an active quest; `home` is where the quest giver sits. */
export function questTarget(q: QDef, s: QSt, home: THREE.Vector3): THREE.Vector3 | null {
  const W = ctx.world;
  if (q.type === 'bring') return ctx.cat.carrying?.id === 'ikan_pasar' ? home : ctx.save.unlocked.pasar ? W.props.ikan_pasar.home : W.pts.pasarGate;
  if (q.type === 'visit') {
    const left = (q.spots || []).filter((p) => !(s.prog.v || []).includes(p));
    if (!left.length) return null;
    const cb = ctx.cat.body;
    left.sort((a, b) => W.pts[a].distanceToSquared(cb as any) - W.pts[b].distanceToSquared(cb as any));
    const p = left[0];
    // rooftop spots: guide to the crates first while on the ground
    if (W.pts[p].y > 3 && cb.y < 3.2) return W.pts.crates;
    return W.pts[p];
  }
  if (q.target === 'kids') return ctx.kids?.a?.body ? new THREE.Vector3(ctx.kids.a.body.x, 0, ctx.kids.a.body.z) : W.pts.kidA;
  if (q.target === 'pasar') return ctx.save.unlocked.pasar ? W.pts.pasarIn : W.pts.pasarGate;
  if (q.target === 'dock') return W.pts.dock;
  if (q.target === 'parkCenter') return W.pts.flowerBed;
  if (q.target === 'crates') {
    const cb = ctx.cat.body;
    return cb.y > 3.2 ? W.pts.jemuran : W.pts.crates;
  }
  return null;
}

export function cardLine(q: QDef, st: QSt) {
  const { n, g } = qProgress(q, st);
  return L(q.title) + (q.type === 'bring' || q.type === 'gold' ? '' : `  (${Math.min(n, g)}/${g})`);
}

/** Round number of a Lisa bonus quest that is a ⭐ special one (every 4th). */
export const isSpecialRound = (round: number) => round % 4 === 3;

export const QUESTS: QDef[] = [
  {
    id: 'q1',
    type: 'fish',
    goal: 3,
    title: P('Mancing 3 ikan di kolam', 'Catch 3 fish in the pond'),
    intro: [
      P('Hai! Aku Lisa. Kamu kucing baru di kompleks ini ya?', "Hi! I'm Lisa. Are you new around here?"),
      P('Aku lapar banget... Di kolam ini banyak ikan, tapi aku nggak bisa mancing.', "I'm sooo hungry... This pond has lots of fish, but I can't fish."),
      P('Tolong mancingin 3 ikan buat aku, ya! Pergi ke ujung dermaga kayu itu.', 'Please catch 3 fish for me! Go to the end of that wooden dock.'),
    ],
    remind: P('Ikannya sudah {n} dari {g}. Semangat! Mancingnya di ujung dermaga.', "That's {n} of {g} fish. You can do it! Fish from the end of the dock."),
    done: [
      P('Wah, 3 ikan! Kamu hebat banget!', 'Wow, 3 fish! You are amazing!'),
      P('Ini hadiahnya: pola bulu belang, biar makin keren.', "Here's your reward: a tabby fur pattern!"),
      P('Oh iya, gerbang Pasar Ikan di ujung jalan sudah kubuka. Hihi.', 'Oh, and I opened the Fish Market gate down the street. Hehe.'),
    ],
    coins: 20,
    items: ['pattern:belang'],
    unlock: 'pasar',
    target: 'dock',
  },
  {
    id: 'q2',
    type: 'set',
    goal: 3,
    set: ['pot_taman', 'gali', 'merpati_taman', 'bola'],
    title: P('Bikin 3 kekacauan di taman', 'Make 3 kinds of mess in the park'),
    intro: [
      P('Taman ini terlalu rapi. Membosankan!', 'This park is too tidy. Boring!'),
      P('Coba bikin 3 kekacauan beda di taman. Pot, taman bunga, merpati, bola anak-anak...', 'Make 3 different messes in the park. The pot, the flower bed, the pigeons, the kids ball...'),
    ],
    remind: P('Kekacauan di taman: {n} dari {g}.', 'Park mischief: {n} of {g}.'),
    done: [P('Hahaha! Tamannya jadi seru! Nih, topi pesta buat kamu.', "Hahaha! The park is fun now! Here's a party hat.")],
    coins: 25,
    items: ['head:topiPesta'],
    target: 'parkCenter',
  },
  {
    id: 'q3',
    type: 'bring',
    goal: 1,
    title: P('Bawa ikan pasar ke Lisa', 'Bring a market fish to Lisa'),
    intro: [
      P('Katanya ikan di Pasar Ikan paling enak se-kompleks...', 'They say the Fish Market has the best fish around...'),
      P('Ambil satu dari meja Pak Ujang, lalu bawa ke sini. Jangan sampai ketahuan!', "Grab one from Mr. Ujang's table and bring it here. Don't get caught!"),
    ],
    remind: P('Ambil ikan di meja Pak Ujang di Pasar Ikan, lalu bawa ke aku.', "Take a fish from Mr. Ujang's table in the Fish Market and bring it to me."),
    done: [
      P('Nyam! Ikan pasar memang juara!', 'Yum! Market fish is the best!'),
      P('Hadiahnya pola tuksedo. Dan... ada tumpukan kardus di gang sebelah rumahmu. Naik ke atap, deh!', "Your reward: a tuxedo pattern. And... there are crates in the alley next to your house. Climb up to the rooftops!"),
    ],
    coins: 30,
    items: ['pattern:tuxedo'],
    unlock: 'atap',
    target: 'pasar',
  },
  {
    id: 'q4',
    type: 'set',
    goal: 2,
    set: ['jemuran', 'ikan_asin', 'merpati_atap'],
    title: P('Jadi raja atap: 2 kenakalan di atap', 'Rooftop royalty: 2 mischiefs on the roofs'),
    intro: [
      P('Atap itu kerajaan para kucing!', 'The rooftops are the kingdom of cats!'),
      P('Buktikan kamu rajanya: bikin 2 kenakalan di atas atap. Hati-hati di papan kayu, ya!', 'Prove you are the ruler: do 2 mischiefs up on the roofs. Careful on the plank!'),
    ],
    remind: P('Kenakalan di atap: {n} dari {g}. Naik lewat kardus di gang.', 'Rooftop mischief: {n} of {g}. Climb the crates in the alley.'),
    done: [P('Hormat, Yang Mulia Raja Atap! Mahkota ini untukmu.', 'All hail the Rooftop Ruler! This crown is yours.')],
    coins: 40,
    items: ['head:mahkota'],
    target: 'crates',
  },
  {
    id: 'q5',
    type: 'gold',
    goal: 1,
    title: P('Pancing Ikan Emas legendaris', 'Catch the legendary Golden Fish'),
    intro: [
      P('Ssst... ada legenda. Di kolam ini hidup Ikan Emas yang berkilau.', 'Psst... legend says a shiny Golden Fish lives in this pond.'),
      P('Dia susah banget ditangkap. Tekan tepat di bagian hijau yang kecil!', "It's super hard to catch. Tap right in the tiny green zone!"),
    ],
    remind: P('Ikan Emas masih di kolam. Terus mancing, pasti muncul!', 'The Golden Fish is still out there. Keep fishing!'),
    done: [P('IKAN EMAS! Kamu kucing legenda! Bulumu sekarang bisa berkilau emas.', 'THE GOLDEN FISH! You are a legend! Your fur can shine gold now.')],
    coins: 50,
    items: ['fur:emas'],
    target: 'dock',
  },
  {
    id: 'q6',
    type: 'perfect',
    goal: 8,
    title: P('Hari sempurna: 8 kenakalan + pulang tepat waktu', 'Perfect day: 8 mischiefs + home on time'),
    intro: [
      P('Ujian terakhir, kucing nakal!', 'Final test, naughty cat!'),
      P('Dalam satu hari: lakukan 8 kenakalan yang beda-beda, lalu pura-pura tidur di sofa sebelum Mama pulang.', 'In one day: do 8 different mischiefs, then fake-sleep on the sofa before Mom gets home.'),
    ],
    remind: P('Kenakalan beda hari ini: {n} dari {g}. Jangan lupa pulang ke sofa!', 'Different mischiefs today: {n} of {g}. Remember to get back to the sofa!'),
    done: [P('Kamu resmi Kucing Paling Nakal se-kompleks! Jubah pahlawan ini buatmu.', 'You are officially the Naughtiest Cat in the neighborhood! This hero cape is yours.')],
    coins: 60,
    items: ['back:jubah'],
  },
];

// Fallback only; after the main chain Lisa's bonus quests come from questgen.
const REPEAT: QDef = {
  id: 'rep',
  type: 'fish',
  goal: 2,
  title: P('Bonus: mancing 2 ikan untuk Lisa', 'Bonus: catch 2 fish for Lisa'),
  intro: [P('Aku lapar lagi... Mancingin 2 ikan lagi, ya?', "I'm hungry again... Catch me 2 more fish?")],
  remind: P('Ikannya {n} dari {g}.', '{n} of {g} fish.'),
  done: [P('Makasih! Kamu memang sahabat terbaik.', "Thanks! You're my best friend.")],
  coins: 15,
  items: [],
  target: 'dock',
};

export class Quests {
  constructor() {
    const W = ctx.world;
    const I = ctx.interact;
    // Talk to Lisa (and give the market fish)
    I.add({
      id: 'lisa',
      label: () => this.label(),
      icon: () => (this.canGive() ? '🐟' : '💬'),
      pos: W.pts.lisa,
      r: 1.9,
      yTol: 1.3,
      priority: 1,
      enabled: () => !ctx.cat.carrying || this.canGive(),
      act: () => this.talk(),
    });
    // track progress each frame via hooks
    // Old saves: after the main chain, the bonus fish request was auto-accepted
    // and kept the HUD stuck on "Mancing 2 ikan". Put it back to optional.
    if (this.allDone() && this.st.stage === 'active' && !this.st.gen) {
      this.st.stage = 'offer';
      this.st.prog = {};
      writeSave(ctx.save);
    }
  }

  /** All main quests finished; only the optional bonus request remains. */
  allDone() {
    return ctx.save.quest.idx >= QUESTS.length;
  }

  get q(): QDef {
    const i = ctx.save.quest.idx;
    return i < QUESTS.length ? QUESTS[i] : this.st.gen || REPEAT;
  }
  get st() {
    return ctx.save.quest;
  }

  canGive() {
    return this.st.stage === 'active' && this.q.type === 'bring' && ctx.cat.carrying?.id === 'ikan_pasar';
  }

  wantsMarketFish() {
    return (this.st.stage === 'active' && this.q.type === 'bring') || !!ctx.progress?.wantsMarketFish();
  }

  lisaMark() {
    const s = this.st.stage;
    if (s === 'offer') return this.allDone() ? (isSpecialRound(this.st.idx - QUESTS.length) ? '⭐' : '') : '!';
    if (s === 'ready' || this.canGive()) return '?';
    return '';
  }

  label() {
    // for the Lisa interactable
    return this.canGive() ? 'a_give' : 'a_talk';
  }

  progress(): { n: number; g: number } {
    return qProgress(this.q, this.st);
  }

  /** Whose quest is on the HUD card: Lisa, or the cat friend you last accepted from. */
  cardFace(): string {
    return ctx.progress?.focusGiver()?.id || 'lisa';
  }
  cardReady() {
    const g = ctx.progress?.focusGiver();
    return g ? g.st.stage === 'ready' || g.canGive() : this.st.stage === 'ready' || this.canGive();
  }

  // Text for the HUD quest card
  cardText() {
    const fg = ctx.progress?.focusGiver();
    if (fg) return fg.cardText();
    const s = this.st.stage;
    if (!ctx.save.metLisa && s === 'offer' && this.st.idx === 0) return tr('questFindLisa');
    if (s === 'offer' && this.allDone()) return this.st.idx === QUESTS.length ? tr('questDoneAll') + ' ' + tr('questBonus') : isSpecialRound(this.st.idx - QUESTS.length) ? '⭐ ' + tr('questSpecialOffer') : '🎲 ' + tr('questBonus');
    if (s === 'offer') return tr('questNew');
    if (s === 'ready') return tr('questReady');
    return cardLine(this.q, this.st);
  }

  targetPoint(): THREE.Vector3 | null {
    // another cat friend's quest is on the HUD card
    const f = ctx.progress?.focusTarget();
    if (f !== undefined) return f;
    const W = ctx.world;
    const s = this.st.stage;
    if (s === 'offer' && this.allDone()) return null;
    if (s === 'offer' || s === 'ready') return W.pts.lisa;
    return questTarget(this.q, this.st, W.pts.lisa);
  }

  talk() {
    const s = this.st;
    const q = this.q;
    ctx.lisaHappy = true;
    sfx.meow(1.25, 0.25);
    if (this.canGive()) {
      dropCarried(true);
      // fish goes to Lisa
      ctx.fx.hearts(ctx.world.pts.lisa.x, ctx.world.pts.lisa.y + 0.8, ctx.world.pts.lisa.z, 5);
      sfx.eat();
      s.prog = { n: 1 };
      s.stage = 'ready';
    }
    if (s.stage === 'offer') {
      if (this.allDone()) {
        // a fresh, different bonus request every time
        const round = s.idx - QUESTS.length;
        s.gen = isSpecialRound(round) ? specialQuest(s.recent || [], round) : genQuest(s.recent || [], round);
        s.recent = [...(s.recent || []), s.gen.kind!].slice(-6);
        return this.talk2(s.gen);
      }
      const lines = [...q.intro];
      if (ctx.save.metLisa && s.idx === 0) lines.shift();
      ctx.save.metLisa = true;
      this.dialog(lines, () => {
        s.stage = 'active';
        s.prog = {};
        ctx.save.focus = 'lisa';
        writeSave(ctx.save);
        ctx.ui.toast('📜 ' + L(q.title));
        ctx.lisaHappy = false;
        this.check();
      });
    } else if (s.stage === 'active') {
      this.remindLine(q);
    } else if (s.stage === 'ready') {
      this.finish(q);
    }
  }

  private talk2(q: QDef) {
    const s = this.st;
    this.dialog(q.intro, () => {
      s.stage = 'active';
      s.prog = {};
      ctx.save.focus = 'lisa';
      writeSave(ctx.save);
      ctx.ui.toast('📜 ' + L(q.title));
      ctx.lisaHappy = false;
      ctx.ui.quest();
      this.check();
    });
  }

  private remindLine(q: QDef) {
    {
      const { n, g } = this.progress();
      this.dialog([{ id: q.remind.id.replace('{n}', String(n)).replace('{g}', String(g)), en: q.remind.en.replace('{n}', String(n)).replace('{g}', String(g)) }], () => (ctx.lisaHappy = false));
    }
  }

  private finish(q: QDef) {
    const s = this.st;
    {
      this.dialog(q.done, () => {
        this.reward(q);
        s.idx++;
        s.stage = 'offer';
        s.prog = {};
        s.gen = null;
        writeSave(ctx.save);
        ctx.ui.quest();
        if (q.kind) ctx.progress?.addDone(1, 2.8); // bonus quests count toward the rank
        if (this.allDone()) {
          // main chain finished (or a bonus request done): stop here, no auto-chain
          ctx.lisaHappy = false;
          if (q.id === QUESTS[QUESTS.length - 1].id) ctx.after(1.2, () => ctx.ui.toast('🏆 ' + tr('questDoneAll'), 4));
          return;
        }
        // chain straight into the next request
        ctx.after(0.4, () => this.talk());
      });
    }
  }

  dialog(lines: Pair[], done: () => void) {
    ctx.ui.dialog(
      lines.map((l) => ({ who: tr('lisa'), text: L(l), face: 'lisa' })),
      done,
    );
  }

  reward(q: QDef) {
    sfx.fanfare();
    addCoins(q.coins);
    const names: string[] = [];
    for (const it of q.items) {
      const [slot, id] = it.split(':');
      const item = ITEMS.find((i) => i.slot === (slot as Slot) && i.id === id);
      if (item) {
        ctx.save.owned[key(item)] = true;
        names.push(L(item.name));
      }
    }
    if (q.unlock) {
      ctx.save.unlocked[q.unlock] = true;
      this.applyUnlocks(true);
      ctx.progress?.onUnlock(q.unlock);
    }
    const parts = [`+${q.coins} 🐟`, ...names];
    if (q.special) ctx.fx.stars(ctx.cat.body.x, ctx.cat.body.y + 0.9, ctx.cat.body.z, 10);
    if (q.unlock === 'pasar') parts.push(tr('unlockPasar'));
    if (q.unlock === 'atap') parts.push(tr('unlockAtap'));
    ctx.ui.banner('🎁', tr('reward', { r: '' }).replace(':', '').trim(), parts.join(' · '), 0);
    ctx.fx.sparkle(ctx.cat.body.x, ctx.cat.body.y + 0.8, ctx.cat.body.z, 10);
    writeSave(ctx.save);
  }

  applyUnlocks(fx = false) {
    const g = ctx.world.gates;
    const U = ctx.save.unlocked;
    if (U.pasar && !g.pasar.open) {
      g.pasar.open = true;
      for (const c of g.pasar.cols) c.off = true;
      if (fx) {
        // roll the shutter up
        let k = 0;
        const up = () => {
          k += 0.04;
          g.pasar.obj.position.y = k * 3;
          if (k < 1) ctx.after(0.03, up);
          else g.pasar.obj.visible = false;
        };
        up();
      } else g.pasar.obj.visible = false;
    }
    if (U.atap && !g.atap.open) {
      g.atap.open = true;
      g.atap.obj.visible = true;
      for (const c of g.atap.cols) c.off = false;
    }
  }

  // ----- progress hooks (also forwarded to the other cat friends + daily challenges) -----
  onFish(type: string) {
    ctx.progress?.onFish(type);
    const s = this.st;
    if (s.stage !== 'active') return;
    tFish(this.q, s, type);
    this.check();
  }

  onMischief(id: string) {
    ctx.progress?.onMischief(id);
    const s = this.st;
    if (s.stage !== 'active') return;
    if (tMischief(this.q, s, id, this.loud())) this.check();
    void MBY;
  }

  /** Generic hook for event quests: eat, hug, shoo, meow (key = who), coins (amount). */
  onEvent(ev: string, amount = 1, key = '') {
    ctx.progress?.onEvent(ev, amount, key);
    const s = this.st;
    if (s.stage !== 'active') return;
    const r = tEvent(this.q, s, ev, amount, key, this.loud());
    if (r === 2) {
      writeSave(ctx.save);
      ctx.ui.quest();
    } else if (r === 1) this.check();
  }

  /** Lisa's quest is the one on the HUD card (shows the small progress toasts). */
  loud() {
    return !ctx.progress || ctx.progress.focusId() === 'lisa';
  }

  /** Per-frame: visit quests tick off spots the cat reaches. */
  tick() {
    ctx.progress?.tick();
    const s = this.st;
    if (s.stage !== 'active') return;
    if (tVisit(this.q, s, this.loud())) this.check();
  }

  onDayEnd(onTime: boolean) {
    const s = this.st;
    if (s.stage !== 'active' || this.q.type !== 'perfect') return false;
    if (onTime && ctx.day.doneToday.size >= this.q.goal) {
      s.stage = 'ready';
      s.prog = { n: this.q.goal };
      writeSave(ctx.save);
      return this.q.id === 'q6'; // only the main finale earns the "perfect day" stamp
    }
    return false;
  }

  check() {
    const s = this.st;
    if (s.stage !== 'active') return;
    const q = this.q;
    if (q.type === 'perfect') return;
    const { n, g } = this.progress();
    if (n >= g) {
      s.stage = 'ready';
      sfx.jingle();
      ctx.ui.toast('✅ ' + tr('questReady'), 3);
    }
    writeSave(ctx.save);
    ctx.ui.quest();
  }

  isGoldQuest() {
    return this.st.stage === 'active' && this.q.type === 'gold';
  }
}
