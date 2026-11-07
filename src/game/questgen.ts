// Bonus quest generator: once Lisa's main chain is done she invents a new,
// different request every time from these templates. The generated quest is a
// plain QDef stored in the save, so it survives reloads.
import { ctx } from '../ctx';
import type { Pair } from '../i18n';
import { MISCHIEF } from './mischief';
import { FISH } from './fishing';
import type { QDef } from './quests';
import { SPECIAL_ITEMS, key } from '../cosmetics';

const P = (id: string, en: string): Pair => ({ id, en });
// Random source: Math.random normally, a seeded one for the daily challenges.
let R: () => number = Math.random;
const pick = <T>(a: T[]): T => a[Math.floor(R() * a.length)];
const shuffle = <T>(a: T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(R() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
};
const lc = (p: Pair): Pair => ({ id: p.id.toLowerCase(), en: p.en.toLowerCase() });

const AREA: Record<string, { name: Pair; target?: string }> = {
  rumah: { name: P('di rumah', 'at home') },
  taman: { name: P('di taman', 'in the park'), target: 'parkCenter' },
  jalan: { name: P('di jalan kompleks', 'on the street') },
  pasar: { name: P('di Pasar Ikan', 'in the Fish Market'), target: 'pasar' },
  atap: { name: P('di atap', 'on the rooftops'), target: 'crates' },
  sekolah: { name: P('di Sekolah', 'at the School'), target: 'sekolah' },
  warung: { name: P('di Warung', 'at the Corner Shop'), target: 'warung' },
  sungai: { name: P('di Sungai', 'by the River'), target: 'sungai' },
};

const THANKS: Pair[] = [
  P('Makasih! Kamu memang sahabat terbaik.', "Thanks! You're my best friend."),
  P('Hihi, kamu memang kucing paling keren!', "Hehe, you really are the coolest cat!"),
  P('Mantap! Aku sampai ketawa guling-guling.', "Awesome! I'm rolling with laughter."),
  P('Yeay! Nanti aku punya ide lain lagi, ya.', "Yay! I'll think of another idea later."),
];
const HELLO: Pair[] = [
  P('Eh, aku punya ide seru!', 'Hey, I have a fun idea!'),
  P('Psst... mau tantangan baru?', 'Psst... want a new challenge?'),
  P('Aku bosan... ayo bikin seru!', "I'm bored... let's have fun!"),
  P('Hari ini aku punya permintaan spesial.', 'I have a special request today.'),
];

// Bonus round number (0 = first bonus). Goals grow slowly so it never ends but stays doable.
let LV = 0;
// Options of the current genQuest call (giver flavour, allowed areas/spots).
let OPT: GenOpts = {};
const who = () => OPT.who || P('Lisa', 'Lisa');
const up = (n: number, cap = 3) => n + Math.min(cap, Math.floor(LV / 6));

type Gen = () => QDef | null;

function base(kind: string, title: Pair, ask: Pair, remind: Pair, coins: number, extra: Partial<QDef>): QDef {
  return {
    id: 'gen_' + kind,
    kind: kind.split('_')[0],
    type: 'fish',
    goal: 1,
    title,
    intro: [pick(OPT.hello || HELLO), ask],
    remind,
    done: [pick(OPT.thanks || THANKS)],
    coins,
    items: [],
    ...extra,
  };
}

const unlockedArea = (a: string) => (a === 'pasar' ? ctx.save.unlocked.pasar : a === 'atap' ? ctx.save.unlocked.atap : true) && (!OPT.areas || OPT.areas.includes(a));

const GENS: Record<string, Gen> = {
  // N fish of any kind
  fishAny: () => {
    const g = up(pick([2, 3, 4]));
    return base('fishAny', P(`Mancing ${g} ikan apa saja`, `Catch ${g} fish of any kind`),
      P(`Perutku keroncongan. Mancingin ${g} ikan, ya!`, `My tummy is rumbling. Catch me ${g} fish!`),
      P('Ikannya {n} dari {g}.', '{n} of {g} fish.'), 8 + g * 4, { type: 'fish', goal: g, target: 'dock' });
  },
  // one specific species (incl. the old boot, for laughs)
  fishKind: () => {
    const f = pick(FISH.filter((x) => x.id !== 'emas'));
    const g = f.id === 'sepatu' ? 1 : f.id === 'lele' ? 1 : 2;
    const boot = f.id === 'sepatu';
    return base('fishKind_' + f.id,
      P(`Pancing ${g} ${f.name.id} ${f.icon}`, `Catch ${g} ${f.name.en} ${f.icon}`),
      boot
        ? P('Aku mau bikin rumah dari sepatu bekas. Pancingin satu dari kolam, ya! Hihi.', 'I want to build a house out of an old boot. Fish one out of the pond! Hehe.')
        : P(`Aku lagi pengin ${f.name.id} ${f.icon}. Pancingin ${g}, ya! Ikan lain nggak dihitung.`, `I'm craving ${f.name.en} ${f.icon}. Catch me ${g}! Other fish don't count.`),
      P(`${f.name.id}: {n} dari {g}. Terus mancing!`, `${f.name.en}: {n} of {g}. Keep fishing!`),
      boot ? 25 : 12 + g * 5, { type: 'fish', goal: g, fish: f.id, target: 'dock' });
  },
  // mischief in one area
  area: () => {
    const areas = Object.keys(AREA).filter(unlockedArea);
    if (!areas.length) return null;
    const a = pick(areas);
    const ids = MISCHIEF.filter((m) => m.area === a).map((m) => m.id);
    const g = Math.min(ids.length, pick([2, 3]));
    const an = AREA[a].name;
    return base('area_' + a, P(`${g} kenakalan ${an.id}`, `${g} mischiefs ${an.en}`),
      P(`Ayo bikin heboh ${an.id}! Lakukan ${g} kenakalan yang beda.`, `Let's cause a stir ${an.en}! Do ${g} different mischiefs.`),
      P(`Kenakalan ${an.id}: {n} dari {g}.`, `Mischief ${an.en}: {n} of {g}.`), 10 + g * 6,
      { type: 'set', goal: g, set: ids, target: AREA[a].target });
  },
  // 2 of 3 named mischiefs from anywhere
  pickTwo: () => {
    const pool = MISCHIEF.filter((m) => unlockedArea(m.area));
    const three = shuffle(pool).slice(0, 3);
    const names = three.map((m) => m.icon + ' ' + m.name.id.toLowerCase());
    const namesEn = three.map((m) => m.icon + ' ' + lc(m.name).en);
    return base('pickTwo', P('Pilih 2: ' + three.map((m) => m.icon).join(' '), 'Pick 2: ' + three.map((m) => m.icon).join(' ')),
      P(`Coba lakukan 2 dari ini: ${names.join(', ')}.`, `Try 2 of these: ${namesEn.join(', ')}.`),
      P(`Sudah {n} dari {g}. Pilihannya: ${names.join(', ')}.`, `{n} of {g} done. Options: ${namesEn.join(', ')}.`), 25,
      { type: 'set', goal: 2, set: three.map((m) => m.id) });
  },
  // N different mischiefs anywhere
  anyMess: () => {
    const g = up(pick([4, 5, 6]));
    return base('anyMess', P(`${g} kenakalan beda-beda`, `${g} different mischiefs`),
      P(`Tunjukkan kamu kucing paling nakal: ${g} kenakalan yang beda-beda, di mana saja!`, `Show me you're the naughtiest: ${g} different mischiefs, anywhere!`),
      P('Kenakalan beda: {n} dari {g}.', 'Different mischiefs: {n} of {g}.'), 10 + g * 5, { type: 'set', goal: g });
  },
  // bring a market fish
  bring: () => {
    if (!ctx.save.unlocked.pasar) return null;
    const w = who();
    return base('bring', P(`Bawa ikan pasar ke ${w.id}`, `Bring a market fish to ${w.en}`),
      P('Aku kangen ikan Pak Ujang... Ambilin satu lagi, ya. Jangan ketahuan!', "I miss Mr. Ujang's fish... Grab me another one. Don't get caught!"),
      P('Ambil ikan di meja Pak Ujang, lalu bawa ke aku.', "Take a fish from Mr. Ujang's table and bring it to me."), 30,
      { type: 'bring', goal: 1, target: 'pasar' });
  },
  // home on time after some mischief
  homeOnTime: () => {
    const g = up(pick([3, 4, 5]), 3);
    return base('homeOnTime', P(`${g} kenakalan + pulang tepat waktu`, `${g} mischiefs + home on time`),
      P(`Hari ini: ${g} kenakalan beda, terus pura-pura tidur di sofa sebelum Mama pulang!`, `Today: ${g} different mischiefs, then fake-sleep on the sofa before Mom gets home!`),
      P('Kenakalan beda hari ini: {n} dari {g}. Jangan lupa pulang ke sofa!', 'Different mischiefs today: {n} of {g}. Remember the sofa!'), 20 + g * 5,
      { type: 'perfect', goal: g });
  },
  // the golden fish again (rare)
  gold: () =>
    R() < 0.5
      ? null
      : base('gold', P('Pancing Ikan Emas lagi ✨', 'Catch the Golden Fish again ✨'),
          P('Katanya Ikan Emas muncul lagi di kolam! Bisa tangkap?', 'They say the Golden Fish is back in the pond! Can you catch it?'),
          P('Ikan Emas masih di kolam. Terus mancing!', 'The Golden Fish is still out there. Keep fishing!'), 50,
          { type: 'gold', goal: 1, target: 'dock' }),
};


// Places for "visit" quests. y>3 = on the rooftops.
const SPOTS: { pt: string; name: Pair; need?: 'pasar' | 'atap' }[] = [
  { pt: 'dock', name: P('🎣 ujung dermaga', '🎣 the end of the dock') },
  { pt: 'flowerBed', name: P('🌷 taman bunga', '🌷 the flower bed') },
  { pt: 'sofa', name: P('🛋️ sofa rumah', '🛋️ the sofa at home') },
  { pt: 'motorSeat', name: P('🛵 motor tetangga', "🛵 the neighbor's motorbike") },
  { pt: 'dogFence', name: P('🐕 pagar Bleki', "🐕 Bleki's fence") },
  { pt: 'kidA', name: P('⚽ lapangan bola', '⚽ the ball field') },
  { pt: 'crates', name: P('📦 tumpukan kardus', '📦 the crate stack') },
  { pt: 'pasarIn', name: P('🐠 Pasar Ikan', '🐠 the Fish Market'), need: 'pasar' },
  { pt: 'tini', name: P('🍅 lapak Bu Tini', "🍅 Mrs. Tini's stall"), need: 'pasar' },
  { pt: 'jemuran', name: P('👕 jemuran di atap', '👕 the rooftop laundry'), need: 'atap' },
  { pt: 'pigeonRoof', name: P('🐦 merpati atap', '🐦 the roof pigeons'), need: 'atap' },
  { pt: 'flagpole', name: P('🚩 tiang bendera sekolah', '🚩 the school flagpole') },
  { pt: 'bell', name: P('🔔 bel sekolah', '🔔 the school bell') },
  { pt: 'warung', name: P('🍘 Warung', '🍘 the Corner Shop') },
  { pt: 'bridge', name: P('🎋 jembatan bambu', '🎋 the bamboo bridge') },
  { pt: 'riverStones', name: P('🪨 batu loncatan sungai', '🪨 the river stepping stones') },
];
const PEOPLE: Pair = P('Bu Siti, Pak Ujang, Bu Tini, Pak Satpam, Bu Warung, Dimas, atau Putri', 'Mrs. Siti, Mr. Ujang, Mrs. Tini, the Guard, the Shopkeeper, Dimas, or Putri');

const MORE: Record<string, Gen> = {
  // a burst of mischief in a short time
  combo: () => {
    const g = up(3, 2);
    const w = 40;
    return base('combo', P(`Kombo: ${g} kenakalan dalam ${w} detik ⚡`, `Combo: ${g} mischiefs in ${w} seconds ⚡`),
      P(`Cepat-cepatan! Bikin ${g} kenakalan beruntun, jaraknya nggak boleh lebih dari ${w} detik.`, `Speed run! Do ${g} mischiefs in a row, no more than ${w} seconds apart.`),
      P(`Kombo sekarang: {n} dari {g}. Jangan berhenti lama-lama!`, `Current combo: {n} of {g}. Don't stop for long!`), 15 + g * 7,
      { type: 'combo', goal: g, window: w });
  },
  // snack time
  eat: () => {
    const g = up(2, 2);
    return base('eat', P(`Ngemil ${g} kali 😋`, `Snack ${g} times 😋`),
      P(`Kucing hebat harus makan! Curi lalu makan ${g} camilan: ikan goreng di dapur, kerupuk di warung, ikan pasar, atau ikan asin di atap.`, `A great cat must eat! Steal and eat ${g} snacks: fried fish in the kitchen, crackers at the shop, market fish, or salted fish on the roof.`),
      P('Camilan dimakan: {n} dari {g}. Ikan goreng ada di dapur rumah!', 'Snacks eaten: {n} of {g}. Fried fish is in the home kitchen!'), 12 + g * 6,
      { type: 'event', ev: 'eat', goal: g });
  },
  // get hugged by the kids
  hug: () =>
    base('hug', P('Dipeluk Dimas atau Putri 💕', 'Get hugged by Dimas or Putri 💕'),
      P('Dimas dan Putri di lapangan bola sayang banget sama kucing. Biarin mereka meluk kamu, ya!', 'Dimas and Putri at the ball field love cats. Let them give you a hug!'),
      P('Belum dipeluk. Coba dekati Dimas dan Putri di lapangan bola.', 'No hug yet. Go near Dimas and Putri at the ball field.'), 20,
      { type: 'event', ev: 'hug', goal: 1, target: 'kids' }),
  // get shooed on purpose (silly)
  shoo: () => {
    const g = up(2, 1);
    return base('shoo', P(`Bikin warga ngusir kamu ${g} kali 💨`, `Get shooed away ${g} times 💨`),
      P(`Hihi, aku mau lihat warga heboh! Bikin mereka ngusir kamu ${g} kali. Tenang, nggak sakit kok.`, `Hehe, I want to see people make a fuss! Get them to shoo you ${g} times. Don't worry, it doesn't hurt.`),
      P('Diusir: {n} dari {g}. Bikin kenakalan di depan Bu Siti atau Pak Ujang!', 'Shooed: {n} of {g}. Do mischief in front of Mrs. Siti or Mr. Ujang!'), 12 + g * 6,
      { type: 'event', ev: 'shoo', goal: g });
  },
  // be sneaky: N mischiefs without getting shooed
  sneaky: () => {
    const g = up(4, 2);
    return base('sneaky', P(`Ninja: ${g} kenakalan tanpa ketahuan 🥷`, `Ninja: ${g} mischiefs without getting shooed 🥷`),
      P(`Jadi kucing ninja! Bikin ${g} kenakalan, tapi kalau ada yang ngusir, hitungannya mulai dari nol lagi.`, `Be a ninja cat! Do ${g} mischiefs, but if anyone shoos you, the count starts over.`),
      P('Kenakalan ninja: {n} dari {g}. Awas jangan sampai diusir!', 'Ninja mischief: {n} of {g}. Careful not to get shooed!'), 15 + g * 6,
      { type: 'sneaky', goal: g });
  },
  // meow at different people
  meow: () => {
    const g = up(2, 2);
    return base('meow', P(`Meong ke ${g} orang berbeda 🗣️`, `Meow at ${g} different people 🗣️`),
      P(`Ayo kenalan sama tetangga! Dekati ${g} orang yang beda lalu tekan Meong. Misalnya ${PEOPLE.id}.`, `Let's meet the neighbors! Go near ${g} different people and press Meow. Like ${PEOPLE.en}.`),
      P('Sudah meong ke {n} dari {g} orang. Dekati orangnya dulu, baru meong!', 'Meowed at {n} of {g} people. Get close first, then meow!'), 10 + g * 6,
      { type: 'event', ev: 'meow', distinct: true, goal: g });
  },
  // earn coins
  coins: () => {
    const g = 25 + Math.min(3, Math.floor(LV / 6)) * 10;
    return base('coins', P(`Kumpulkan ${g} koin ikan 🐟`, `Earn ${g} fish coins 🐟`),
      P(`Aku lagi nabung buat beli topi baru. Kumpulkan ${g} koin ikan dari kenakalan atau mancing, ya!`, `I'm saving up for a new hat. Earn ${g} fish coins from mischief or fishing!`),
      P('Koin terkumpul: {n} dari {g}.', 'Coins earned: {n} of {g}.'), 20,
      { type: 'event', ev: 'coins', goal: g });
  },
  // tour of the neighborhood
  visit: () => {
    const pool = SPOTS.filter((s) => (!s.need || ctx.save.unlocked[s.need]) && (!OPT.spots || OPT.spots.includes(s.pt)));
    if (pool.length < 2) return null;
    const spots = shuffle(pool).slice(0, Math.min(pool.length, up(3, 2)));
    const ids = spots.map((s) => s.name.id).join(', ');
    const en = spots.map((s) => s.name.en).join(', ');
    return base('visit', P(`Jalan-jalan ke ${spots.length} tempat 🗺️`, `Visit ${spots.length} places 🗺️`),
      P(`Ayo keliling kompleks! Datangi: ${ids}.`, `Let's tour the neighborhood! Visit: ${en}.`),
      P(`Sudah {n} dari {g} tempat. Daftarnya: ${ids}.`, `{n} of {g} places. The list: ${en}.`), 10 + spots.length * 6,
      { type: 'visit', goal: spots.length, spots: spots.map((s) => s.pt), spotNames: spots.map((s) => s.name) });
  },
};
Object.assign(GENS, MORE);

export interface GenOpts {
  kinds?: string[]; // only these templates (quest givers have their own flavour)
  areas?: string[]; // area quests: only these areas
  spots?: string[]; // visit quests: only these points
  who?: Pair; // name of the giver (for 'bring')
  hello?: Pair[];
  thanks?: Pair[];
  special?: boolean; // harder goal (the ⭐ challenge)
  rng?: () => number; // seeded random (daily challenges)
}

/** Pick a new bonus quest: never one of the last few kinds, goals grow with the round. */
export function genQuest(recent: string[] = [], round = 0, opts: GenOpts = {}): QDef {
  LV = round + (opts.special ? 12 : 0);
  OPT = opts;
  R = opts.rng || Math.random;
  try {
    const avoid = new Set(recent.slice(-4));
    const kinds = opts.kinds ? Object.keys(GENS).filter((k) => opts.kinds!.includes(k)) : Object.keys(GENS);
    for (const k of shuffle(kinds)) {
      if (avoid.has(k)) continue;
      const q = GENS[k]();
      if (q) return q;
    }
    return GENS.anyMess()!;
  } finally {
    LV = 0;
    OPT = {};
    R = Math.random;
  }
}

/** Small seeded RNG (mulberry32) from a string such as '2026-11-07'. */
export function seeded(str: string): () => number {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** ⭐ Tantangan Spesial: a harder bonus quest whose reward is a cosmetic the player doesn't own yet. */
export function specialQuest(recent: string[] = [], round = 0): QDef {
  const q = genQuest(recent, round, { special: true });
  q.special = true;
  q.id = 'spc_' + q.kind;
  q.title = { id: '⭐ ' + q.title.id, en: '⭐ ' + q.title.en };
  const left = SPECIAL_ITEMS().filter((i) => !ctx.save.owned[key(i)]);
  if (left.length) {
    const it = pick(left);
    q.items = [key(it)];
    q.coins += 15;
    q.intro = [P('Ini Tantangan Spesial ⭐! Agak susah, tapi hadiahnya keren banget...', "This is a Special Challenge ⭐! It's a bit harder, but the prize is super cool..."),
      P(`Hadiahnya: ${it.name.id}! Belum ada kucing lain yang punya.`, `The prize: ${it.name.en}! No other cat has one yet.`), q.intro[1]];
    q.done = [P(`Kamu berhasil! Ini ${it.name.id} buat kamu. Coba pakai di Gaya Kucing!`, `You did it! Here's the ${it.name.en}. Try it on in Cat Style!`)];
  } else {
    q.coins += 60;
    q.intro = [P('Ini Tantangan Spesial ⭐! Hadiahnya banyak koin ikan!', 'This is a Special Challenge ⭐! The prize is lots of fish coins!'), q.intro[1]];
    q.done = [P('Kamu memang jagoan! Ini koin ikan yang banyak buat kamu.', "You're a champion! Here's a big pile of fish coins.")];
  }
  return q;
}

export const GEN_KINDS = Object.keys(GENS);
