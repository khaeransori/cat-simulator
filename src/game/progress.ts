// Progression on top of Lisa's quests: Tantangan Harian (3 daily challenges + 🔥 streak),
// Peringkat Kucing (rank from completed challenges) and the other cat friends who give
// quests (Si Belang on the rooftops, Mpus in the Fish Market). All progress comes in
// through the same hooks as Lisa's quests (Quests forwards onFish/onMischief/onEvent/tick).
import * as THREE from 'three';
import { ctx } from '../ctx';
import { L, tr, type Pair } from '../i18n';
import { sfx } from '../audio';
import { writeSave, type GiverState } from '../save';
import { addCoins, dropCarried } from './mischief';
import { ITEMS, key, getItem, type Slot } from '../cosmetics';
import { genQuest, seeded, type GenOpts } from './questgen';
import { type QDef, qProgress, tFish, tMischief, tEvent, tVisit, questTarget, cardLine } from './quests';
import { Lisa } from '../entities/creatures';

const P = (id: string, en: string): Pair => ({ id, en });

// ---------------- Peringkat Kucing ----------------
export const RANKS: { at: number; icon: string; name: Pair }[] = [
  { at: 0, icon: '🐾', name: P('Kucing Kampung', 'Village Cat') },
  { at: 5, icon: '🐈', name: P('Kucing Gang', 'Alley Cat') },
  { at: 10, icon: '😼', name: P('Preman Gang', 'Alley Boss') },
  { at: 18, icon: '🦁', name: P('Jagoan Kompleks', 'Block Hero') },
  { at: 28, icon: '👑', name: P('Raja Kompleks', 'Block King') },
  { at: 40, icon: '🌟', name: P('Legenda Kompleks', 'Block Legend') },
];
export const rankOf = (n: number) => {
  let lv = 0;
  for (let i = 0; i < RANKS.length; i++) if (n >= RANKS[i].at) lv = i;
  return lv;
};

// ---------------- Tantangan Harian ----------------
// Small, quick objectives that work anywhere (no bring / home-on-time / golden fish).
const DAILY_KINDS = ['fishAny', 'fishKind', 'area', 'pickTwo', 'anyMess', 'combo', 'eat', 'hug', 'shoo', 'sneaky', 'meow', 'coins', 'visit'];
export const DAILY_COINS = [10, 12, 15];
export const STREAK_GOAL = 7;
export const STREAK_ITEM = 'neck:syalApi';

/** Local calendar date as YYYY-MM-DD (tests can set ctx.dateOverride). */
export function today(): string {
  if (ctx.dateOverride) return ctx.dateOverride;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dayBefore(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const t = new Date(y, m - 1, d - 1);
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
}

/** The 3 challenges of a date: same date (and same unlocked areas) = same challenges. */
export function dailyFor(date: string): QDef[] {
  const rng = seeded('harian:' + date);
  const out: QDef[] = [];
  const used: string[] = [];
  for (let i = 0; i < 3; i++) {
    const q = genQuest(used, 0, { kinds: DAILY_KINDS, rng });
    used.push(q.kind!);
    q.coins = DAILY_COINS[i];
    q.id = 'day_' + q.kind;
    out.push(q);
  }
  return out;
}

// ---------------- Cat friends ----------------
interface GiverDef {
  id: 'belang' | 'mpus';
  name: Pair;
  need: 'atap' | 'pasar';
  pt: string;
  pos: [number, number, number];
  yaw: number;
  scale: number;
  look: any;
  opts: GenOpts;
  meet: Pair[];
  remindHello: Pair;
  idle: Pair[];
}

export const GIVERS: GiverDef[] = [
  {
    id: 'belang',
    name: P('Si Belang', 'Stripes'),
    need: 'atap',
    pt: 'belang',
    pos: [1.8, 3.6, -15.2], // roof of Bu Siti's house, next to where the crates come up
    yaw: -Math.PI / 2,
    scale: 1.1,
    look: { fur: 'abu', pattern: 'belang', eyes: 'kuning', head: 'none', face: 'hitamK', neck: 'kalung', back: 'none' },
    meet: [
      P('Hmph. Kucing baru, ya? Aku Si Belang, bos atap di sini.', "Hmph. New cat, huh? I'm Stripes, boss of these rooftops."),
      P('Kelihatannya galak, tapi aku baik kok. Asal kamu berani!', "I look tough, but I'm nice. As long as you're brave!"),
    ],
    remindHello: P('Gimana, sudah?', 'So, done yet?'),
    idle: [P('Atap ini wilayahku!', 'These roofs are my turf!'), P('Berani naik ke sini? Keren.', 'You climbed up here? Cool.')],
    opts: {
      kinds: ['area', 'pickTwo', 'anyMess', 'combo', 'sneaky', 'shoo', 'visit'],
      areas: ['atap', 'jalan'],
      spots: ['crates', 'jemuran', 'pigeonRoof', 'motorSeat', 'dogFence'],
      who: P('Si Belang', 'Stripes'),
      hello: [
        P('Oi, kucing berani! Ada tugas buat kamu.', 'Hey, brave cat! I have a job for you.'),
        P('Mau buktiin kamu jagoan? Coba ini!', 'Want to prove you are tough? Try this!'),
        P('Hehe, aku punya rencana nakal...', 'Hehe, I have a naughty plan...'),
      ],
      thanks: [
        P('Hebat! Kamu memang jagoan atap!', "Great! You're a real rooftop champ!"),
        P('Hmph... oke, itu keren banget. Nih hadiahmu.', "Hmph... okay, that was super cool. Here's your prize."),
        P('Mantap! Kamu boleh jadi anak buahku. Hehe.', 'Awesome! You can join my crew. Hehe.'),
      ],
    },
  },
  {
    id: 'mpus',
    name: P('Mpus', 'Mpus'),
    need: 'pasar',
    pt: 'mpus',
    pos: [35.2, 0.6, 12.9], // on the ice box next to Pak Ujang's fish stall
    yaw: 0,
    scale: 1.18,
    look: { fur: 'krem', pattern: 'tutul', eyes: 'hijau', head: 'none', face: 'none', neck: 'dasi', back: 'none' },
    meet: [
      P('Halo, halo! Aku Mpus, kucing langganan Pasar Ikan.', "Hello, hello! I'm Mpus, regular of the Fish Market."),
      P('Aku tahu semua ikan paling enak di sini. Nyam...', 'I know all the tastiest fish around here. Yum...'),
    ],
    remindHello: P('Perutku sudah nunggu, lho...', 'My tummy is waiting...'),
    idle: [P('Nyam... bau ikan!', 'Mmm... smells like fish!'), P('Pak Ujang lagi lengah, hihi.', "Mr. Ujang isn't looking, hehe.")],
    opts: {
      kinds: ['fishAny', 'fishKind', 'bring', 'eat', 'coins', 'meow', 'area', 'visit'],
      areas: ['pasar'],
      spots: ['pasarIn', 'tini', 'dock', 'flowerBed'],
      who: P('Mpus', 'Mpus'),
      hello: [
        P('Nyam-nyam... aku lapar lagi!', "Nom nom... I'm hungry again!"),
        P('Psst, mau bantu aku cari makan?', 'Psst, want to help me find food?'),
        P('Aku punya ide yang enak!', 'I have a tasty idea!'),
      ],
      thanks: [
        P('Nyam! Kamu teman makan terbaik!', 'Yum! You are the best snack buddy!'),
        P('Perutku senang, aku juga senang! Makasih!', 'My tummy is happy, so am I! Thanks!'),
        P('Wah, kamu jago banget! Nih buat kamu.', "Wow, you're so good! This is for you."),
      ],
    },
  },
];

export class Giver {
  def: GiverDef;
  npc: Lisa;
  happy = false;
  constructor(def: GiverDef) {
    this.def = def;
    ctx.world.pts[def.pt] = new THREE.Vector3(...def.pos);
    this.npc = new Lisa({
      pos: ctx.world.pts[def.pt],
      look: def.look,
      yaw: def.yaw,
      scale: def.scale,
      mark: () => this.mark(),
      happy: () => this.happy,
      visible: () => this.open(),
    });
    ctx.interact.add({
      id: def.id,
      label: () => (this.canGive() ? 'a_give' : 'a_talk'),
      icon: () => (this.canGive() ? '🐟' : '💬'),
      pos: ctx.world.pts[def.pt],
      r: 1.9,
      yTol: 1.3,
      priority: 1,
      enabled: () => this.open() && (!ctx.cat.carrying || this.canGive()),
      act: () => this.talk(),
    });
  }
  get id() {
    return this.def.id;
  }
  get st(): GiverState {
    return ctx.save.givers[this.def.id];
  }
  get q(): QDef | null {
    return this.st.gen;
  }
  open() {
    return !!ctx.save.unlocked[this.def.need];
  }
  active() {
    return this.st.stage === 'active' && !!this.q;
  }
  canGive() {
    return this.active() && this.q!.type === 'bring' && ctx.cat.carrying?.id === 'ikan_pasar';
  }
  mark() {
    if (!this.open()) return '';
    if (this.st.stage === 'offer') return '!';
    if (this.st.stage === 'ready' || this.canGive()) return '?';
    return '';
  }
  cardText() {
    if (this.st.stage === 'ready') return tr('friendReady', { who: L(this.def.name) });
    return cardLine(this.q!, this.st);
  }
  target(): THREE.Vector3 | null {
    const home = ctx.world.pts[this.def.pt];
    if (this.st.stage === 'ready') return home;
    if (!this.active()) return null;
    return questTarget(this.q!, this.st, home);
  }
  dialog(lines: Pair[], done: () => void) {
    ctx.ui.dialog(
      lines.map((l) => ({ who: L(this.def.name), text: L(l), face: this.def.id })),
      done,
    );
  }
  talk() {
    const s = this.st;
    this.happy = true;
    sfx.meow(this.def.id === 'belang' ? 0.85 : 1.05, 0.25);
    if (this.canGive()) {
      dropCarried(true);
      const p = ctx.world.pts[this.def.pt];
      ctx.fx.hearts(p.x, p.y + 0.8, p.z, 5);
      sfx.eat();
      s.prog = { n: 1 };
      s.stage = 'ready';
    }
    if (s.stage === 'offer') {
      const q = genQuest(s.recent || [], s.n, this.def.opts);
      q.id = this.def.id + '_' + q.kind;
      s.gen = q;
      s.recent = [...(s.recent || []), q.kind!].slice(-5);
      const lines = s.met ? q.intro : [...this.def.meet, q.intro[1]];
      s.met = true;
      this.dialog(lines, () => {
        s.stage = 'active';
        s.prog = {};
        ctx.save.focus = this.def.id;
        writeSave(ctx.save);
        ctx.ui.toast('📜 ' + L(q.title));
        this.happy = false;
        ctx.ui.quest();
        this.check();
      });
    } else if (s.stage === 'active') {
      const { n, g } = qProgress(this.q!, s);
      const r = this.q!.remind;
      ctx.save.focus = this.def.id; // talking again puts this quest back on the card
      ctx.ui.quest();
      this.dialog([this.def.remindHello, { id: r.id.replace('{n}', String(n)).replace('{g}', String(g)), en: r.en.replace('{n}', String(n)).replace('{g}', String(g)) }], () => (this.happy = false));
    } else if (s.stage === 'ready') {
      const q = this.q!;
      this.dialog(q.done, () => {
        sfx.fanfare();
        addCoins(q.coins);
        s.n++;
        s.stage = 'offer';
        s.prog = {};
        s.gen = null;
        if (ctx.save.focus === this.def.id) ctx.save.focus = 'lisa';
        writeSave(ctx.save);
        ctx.ui.banner('🎁', tr('reward', { r: '' }).replace(':', '').trim(), `+${q.coins} 🐟 · ${L(this.def.name)}`, 0);
        ctx.fx.sparkle(ctx.cat.body.x, ctx.cat.body.y + 0.8, ctx.cat.body.z, 10);
        ctx.ui.quest();
        this.happy = false;
        ctx.progress.addDone(1, 2.8);
      });
    }
  }
  loud() {
    return ctx.progress?.focusId() === this.def.id;
  }
  check() {
    const s = this.st;
    if (!this.active()) return;
    const q = this.q!;
    if (q.type === 'perfect') return;
    const { n, g } = qProgress(q, s);
    if (n >= g) {
      s.stage = 'ready';
      sfx.jingle();
      ctx.ui.toast('✅ ' + tr('friendReady', { who: L(this.def.name) }), 3);
    }
    writeSave(ctx.save);
    ctx.ui.quest();
  }
}

type DailyEntry = { q: QDef; stage: string; prog: any };

export class Progress {
  givers: Giver[];
  dateT = 0;

  constructor() {
    this.givers = GIVERS.map((d) => new Giver(d));
    // old saves: count the bonus quests already finished toward the rank (no fanfare)
    const R = ctx.save.rank;
    const bonus = Math.max(0, ctx.save.quest.idx - 6);
    if (!R.n && bonus) {
      R.n = bonus;
      R.lv = rankOf(R.n);
    }
    R.lv = Math.max(R.lv, rankOf(R.n));
    this.ensureDay(true);
  }

  // ----- rank -----
  rank() {
    return RANKS[rankOf(ctx.save.rank.n)];
  }
  rankText() {
    const r = this.rank();
    return r.icon + ' ' + L(r.name);
  }
  /** completions toward the next rank: { have, need } (need 0 = top rank) */
  rankNext() {
    const n = ctx.save.rank.n;
    const lv = rankOf(n);
    if (lv >= RANKS.length - 1) return { have: n, need: 0, from: RANKS[lv].at };
    return { have: n, need: RANKS[lv + 1].at, from: RANKS[lv].at };
  }
  /** Count finished challenges; the rank-up celebration comes `delay` s later (after the reward banner). */
  addDone(k = 1, delay = 0) {
    const R = ctx.save.rank;
    R.n += k;
    const lv = rankOf(R.n);
    if (lv > R.lv) {
      R.lv = lv;
      const r = RANKS[lv];
      const party = () => {
        sfx.fanfare();
        ctx.ui.banner(r.icon, tr('rankUp'), L(r.name), 0);
        ctx.fx.stars(ctx.cat.body.x, ctx.cat.body.y + 0.9, ctx.cat.body.z, 12);
        ctx.bubbles?.say(ctx.cat.model.root, r.icon + ' ' + L(r.name), { ttl: 3.5, y: 1.05, kind: 'emote', key: 'rankup' });
        ctx.ui?.rank();
      };
      if (delay > 0) ctx.after(delay, party);
      else party();
    }
    writeSave(ctx.save);
    if (!delay) ctx.ui?.rank();
  }

  // ----- daily -----
  ensureDay(silent = false) {
    const D = ctx.save.daily;
    const t = today();
    if (D.date === t && D.list.length === 3) return;
    // a missed day: the streak starts over (gently)
    if (D.streak > 0 && D.lastFull !== t && D.lastFull !== dayBefore(t)) {
      D.streak = 0;
      if (!silent) ctx.after(1.5, () => ctx.ui.toast('🔥 ' + tr('streakNew'), 3.5));
    }
    D.date = t;
    D.list = dailyFor(t).map((q) => ({ q, stage: 'active', prog: {} }));
    writeSave(ctx.save);
    ctx.ui?.dailyBadge();
  }
  daily(): DailyEntry[] {
    return ctx.save.daily.list;
  }
  dailyDone() {
    return this.daily().filter((d) => d.stage === 'done').length;
  }
  /** streak to show: still alive if the last full day was today or yesterday */
  streak() {
    const D = ctx.save.daily;
    const t = today();
    return D.lastFull === t || D.lastFull === dayBefore(t) ? D.streak : 0;
  }
  private dailyCheck(d: DailyEntry, i: number) {
    if (d.stage !== 'active') return;
    const { n, g } = qProgress(d.q, d);
    if (n < g) return;
    d.stage = 'done';
    const D = ctx.save.daily;
    D.total++;
    sfx.jingle();
    ctx.ui.toast('📅 ' + tr('dailyDoneToast', { t: L(d.q.title) }), 3);
    addCoins(DAILY_COINS[i] ?? 10);
    if (this.daily().every((x) => x.stage === 'done') && D.lastFull !== D.date) {
      D.streak = D.lastFull === dayBefore(D.date) ? D.streak + 1 : 1;
      D.lastFull = D.date;
      D.best = Math.max(D.best, D.streak);
      const n = D.streak;
      ctx.after(1.2, () => {
        sfx.fanfare();
        ctx.ui.banner('🔥', tr('dailyAllDone'), tr('streakDays', { n }), 0);
      });
      if (D.streak >= STREAK_GOAL && !ctx.save.owned[STREAK_ITEM]) {
        ctx.save.owned[STREAK_ITEM] = true;
        const it = getItem(STREAK_ITEM.split(':')[0] as Slot, STREAK_ITEM.split(':')[1]);
        ctx.after(4, () => {
          sfx.fanfare();
          ctx.ui.banner('🎁', tr('streakPrize'), it ? L(it.name) : '', 0);
          ctx.fx.stars(ctx.cat.body.x, ctx.cat.body.y + 0.9, ctx.cat.body.z, 12);
        });
      }
    }
    writeSave(ctx.save);
    ctx.ui.dailyBadge();
    this.addDone(1, 2.4);
  }
  private eachDaily(fn: (d: DailyEntry) => boolean) {
    this.daily().forEach((d, i) => {
      if (d.stage !== 'active') return;
      if (fn(d)) this.dailyCheck(d, i);
    });
  }

  // ----- HUD card focus -----
  focusGiver(): Giver | null {
    const busy = (g?: Giver) => !!g && g.open() && (g.st.stage === 'active' || g.st.stage === 'ready') && !!g.q;
    const f = ctx.save.focus;
    if (f && f !== 'lisa') {
      const g = this.givers.find((x) => x.id === f);
      if (busy(g)) return g!;
    }
    // Lisa has nothing running: show a friend's quest instead of the idle Lisa hint
    const L = ctx.save.quest;
    if (L.idx >= 6 && L.stage === 'offer') return this.givers.find((g) => busy(g)) || null;
    return null;
  }
  focusId() {
    return this.focusGiver()?.id || 'lisa';
  }
  /** undefined = Lisa decides the arrow */
  focusTarget(): THREE.Vector3 | null | undefined {
    const g = this.focusGiver();
    return g ? g.target() : undefined;
  }
  wantsMarketFish() {
    return this.givers.some((g) => g.active() && g.q!.type === 'bring');
  }
  onUnlock(u: string) {
    const g = this.givers.find((x) => x.def.need === u);
    if (g) ctx.after(3.2, () => ctx.ui.toast('🐱 ' + tr(u === 'atap' ? 'friendAtap' : 'friendPasar'), 4));
  }

  // ----- hooks (called from Quests) -----
  onFish(type: string) {
    for (const g of this.givers) if (g.active() && tFish(g.q!, g.st, type)) g.check();
    this.eachDaily((d) => tFish(d.q, d, type));
  }
  onMischief(id: string) {
    for (const g of this.givers) if (g.active() && tMischief(g.q!, g.st, id, g.loud())) g.check();
    this.eachDaily((d) => tMischief(d.q, d, id, false));
  }
  onEvent(ev: string, amount = 1, key = '') {
    for (const g of this.givers) {
      if (!g.active()) continue;
      const r = tEvent(g.q!, g.st, ev, amount, key, g.loud());
      if (r === 1) g.check();
      else if (r === 2) writeSave(ctx.save);
    }
    this.eachDaily((d) => tEvent(d.q, d, ev, amount, key, false) === 1);
  }
  tick() {
    for (const g of this.givers) if (g.active() && tVisit(g.q!, g.st, g.loud())) g.check();
    this.eachDaily((d) => tVisit(d.q, d, false) && (sfx.coin(), true));
    // a new calendar day while playing
    if (ctx.time - this.dateT > 5) {
      this.dateT = ctx.time;
      if (ctx.save.daily.date !== today()) this.ensureDay();
    }
  }
  update(dt: number) {
    for (const g of this.givers) g.npc.update(dt);
  }
}

void ITEMS;
void key;
