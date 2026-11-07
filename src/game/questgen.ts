// Bonus quest generator: once Lisa's main chain is done she invents a new,
// different request every time from these templates. The generated quest is a
// plain QDef stored in the save, so it survives reloads.
import { ctx } from '../ctx';
import type { Pair } from '../i18n';
import { MISCHIEF } from './mischief';
import { FISH } from './fishing';
import type { QDef } from './quests';

const P = (id: string, en: string): Pair => ({ id, en });
const pick = <T>(a: T[]): T => a[Math.floor(Math.random() * a.length)];
const shuffle = <T>(a: T[]): T[] => {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
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

type Gen = () => QDef | null;

function base(kind: string, title: Pair, ask: Pair, remind: Pair, coins: number, extra: Partial<QDef>): QDef {
  return {
    id: 'gen_' + kind,
    kind: kind.split('_')[0],
    type: 'fish',
    goal: 1,
    title,
    intro: [pick(HELLO), ask],
    remind,
    done: [pick(THANKS)],
    coins,
    items: [],
    ...extra,
  };
}

const unlockedArea = (a: string) => (a === 'pasar' ? ctx.save.unlocked.pasar : a === 'atap' ? ctx.save.unlocked.atap : true);

const GENS: Record<string, Gen> = {
  // N fish of any kind
  fishAny: () => {
    const g = pick([2, 3, 4]);
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
    const a = pick(Object.keys(AREA).filter(unlockedArea));
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
    const g = pick([4, 5, 6]);
    return base('anyMess', P(`${g} kenakalan beda-beda`, `${g} different mischiefs`),
      P(`Tunjukkan kamu kucing paling nakal: ${g} kenakalan yang beda-beda, di mana saja!`, `Show me you're the naughtiest: ${g} different mischiefs, anywhere!`),
      P('Kenakalan beda: {n} dari {g}.', 'Different mischiefs: {n} of {g}.'), 10 + g * 5, { type: 'set', goal: g });
  },
  // bring a market fish
  bring: () => {
    if (!ctx.save.unlocked.pasar) return null;
    return base('bring', P('Bawa ikan pasar ke Lisa', 'Bring a market fish to Lisa'),
      P('Aku kangen ikan Pak Ujang... Ambilin satu lagi, ya. Jangan ketahuan!', "I miss Mr. Ujang's fish... Grab me another one. Don't get caught!"),
      P('Ambil ikan di meja Pak Ujang, lalu bawa ke aku.', "Take a fish from Mr. Ujang's table and bring it to me."), 30,
      { type: 'bring', goal: 1, target: 'pasar' });
  },
  // home on time after some mischief
  homeOnTime: () => {
    const g = pick([3, 4, 5]);
    return base('homeOnTime', P(`${g} kenakalan + pulang tepat waktu`, `${g} mischiefs + home on time`),
      P(`Hari ini: ${g} kenakalan beda, terus pura-pura tidur di sofa sebelum Mama pulang!`, `Today: ${g} different mischiefs, then fake-sleep on the sofa before Mom gets home!`),
      P('Kenakalan beda hari ini: {n} dari {g}. Jangan lupa pulang ke sofa!', 'Different mischiefs today: {n} of {g}. Remember the sofa!'), 20 + g * 5,
      { type: 'perfect', goal: g });
  },
  // the golden fish again (rare)
  gold: () =>
    Math.random() < 0.5
      ? null
      : base('gold', P('Pancing Ikan Emas lagi ✨', 'Catch the Golden Fish again ✨'),
          P('Katanya Ikan Emas muncul lagi di kolam! Bisa tangkap?', 'They say the Golden Fish is back in the pond! Can you catch it?'),
          P('Ikan Emas masih di kolam. Terus mancing!', 'The Golden Fish is still out there. Keep fishing!'), 50,
          { type: 'gold', goal: 1, target: 'dock' }),
};

/** A new bonus quest, never the same template twice in a row. */
export function genQuest(lastKind?: string): QDef {
  for (const k of shuffle(Object.keys(GENS))) {
    if (k === lastKind) continue;
    const q = GENS[k]();
    if (q) return q;
  }
  return GENS.anyMess()!;
}

export const GEN_KINDS = Object.keys(GENS);
