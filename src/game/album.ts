// Collection album: fish per spot, mischief per area and sticker badges for milestones.
// Badges are computed from the save (fish counts, mischief counts), so old saves get
// the stickers they already earned the first time the album checks.
// Set badges are generated from SPOTS and the MISCHIEF areas, so a new spot or area
// gets its own "complete the set" sticker without touching this file.
import { ctx } from '../ctx';
import { L, tr, pair, type Pair } from '../i18n';
import { sfx } from '../audio';
import { writeSave } from '../save';
import { MISCHIEF, MBY, AREA_KEY, addCoins } from './mischief';
import { FISH, SPOTS, spotFish, type FishDef } from './fishing';
import { ITEMS, key } from '../cosmetics';

const P = (id: string, en: string): Pair => ({ id, en });

export interface Badge {
  id: string;
  icon: string;
  name: Pair;
  desc: Pair;
  coins: number;
  item?: string; // cosmetic key 'slot:id' given once
  big?: boolean; // full-set reward (bigger banner + fanfare)
  done: () => boolean;
  prog?: () => [number, number]; // shown on locked stickers
}

const caught = (id: string) => (ctx.save.fish[id] || 0) > 0;
const total = () => ctx.save.stats.fishTotal || 0;
const done = (id: string) => (ctx.save.mischief[id] || 0) > 0;
const count = (list: { id: string }[], has: (id: string) => boolean) => list.filter((x) => has(x.id)).length;
export const AREAS = () => [...new Set(MISCHIEF.map((m) => m.area))];
const areaName = (a: string): Pair => (AREA_KEY[a] ? pair(AREA_KEY[a]) : P(a, a));
const rares = () => FISH.filter((f) => f.rare);

export function buildBadges(): Badge[] {
  const B: Badge[] = [
    { id: 'firstFish', icon: '🎣', name: P('Pemancing Cilik', 'Little Angler'), desc: P('Dapat tangkapan pertama', 'Catch your first thing'), coins: 5, done: () => total() >= 1 },
    { id: 'fish10', icon: '🐟', name: P('10 Tangkapan', '10 Catches'), desc: P('Mancing 10 kali berhasil', 'Land 10 catches'), coins: 10, done: () => total() >= 10, prog: () => [total(), 10] },
    { id: 'fish50', icon: '🐠', name: P('50 Tangkapan', '50 Catches'), desc: P('Mancing 50 kali berhasil', 'Land 50 catches'), coins: 25, done: () => total() >= 50, prog: () => [total(), 50] },
    { id: 'fish100', icon: '🏆', name: P('Raja Pancing', 'Fishing King'), desc: P('Mancing 100 kali berhasil', 'Land 100 catches'), coins: 50, done: () => total() >= 100, prog: () => [total(), 100] },
    { id: 'firstRare', icon: '✨', name: P('Berkilau!', 'Shiny!'), desc: P('Dapat ikan langka pertama', 'Catch your first rare fish'), coins: 10, done: () => rares().some((f) => caught(f.id)) },
    { id: 'bigFish', icon: '📏', name: P('Ikan Raksasa', 'Giant Fish'), desc: P('Dapat ikan 40 cm atau lebih', 'Catch a fish of 40 cm or more'), coins: 15, done: () => Object.values(ctx.save.fishBest).some((n) => (n as number) >= 40) },
    { id: 'junk', icon: '🗑️', name: P('Kucing Bersih-bersih', 'Clean-up Cat'), desc: P('Pancing semua sampah dari air', 'Fish all the junk out of the water'), coins: 10, done: () => FISH.filter((f) => f.junk).every((f) => caught(f.id)) },
  ];
  for (const sp of SPOTS) {
    const list = spotFish(sp.id);
    B.push({ id: 'set_' + sp.id, icon: sp.icon, name: P(`Lengkap: ${sp.name.id}`, `Complete: ${sp.name.en}`), desc: P(`Semua ${list.length} tangkapan di ${sp.name.id}`, `All ${list.length} catches at the ${sp.name.en}`), coins: 30, done: () => list.every((f) => caught(f.id)), prog: () => [count(list, caught), list.length] });
  }
  B.push(
    { id: 'allRare', icon: '💎', name: P('Pemburu Ikan Langka', 'Rare Fish Hunter'), desc: P('Dapat semua ikan langka', 'Catch every rare fish'), coins: 50, item: 'neck:mutiara', big: true, done: () => rares().every((f) => caught(f.id)), prog: () => [count(rares(), caught), rares().length] },
    { id: 'allFish', icon: '🧺', name: P('Album Ikan Lengkap', 'Fish Album Complete'), desc: P('Dapat semua isi album ikan', 'Fill the whole fish album'), coins: 80, item: 'head:topiNelayan', big: true, done: () => FISH.every((f) => caught(f.id)), prog: () => [count(FISH, caught), FISH.length] },
    { id: 'firstMischief', icon: '😼', name: P('Mulai Nakal', 'First Mischief'), desc: P('Lakukan kenakalan pertama', 'Do your first mischief'), coins: 5, done: () => MISCHIEF.some((m) => done(m.id)) },
  );
  for (const a of AREAS()) {
    const list = MISCHIEF.filter((m) => m.area === a);
    const an = areaName(a);
    B.push({ id: 'area_' + a, icon: list[0]?.icon ?? '⭐', name: P(`Heboh di ${an.id}`, `Chaos: ${an.en}`), desc: P(`Semua kenakalan di ${an.id}`, `Every mischief at ${an.en}`), coins: 20, done: () => list.every((m) => done(m.id)), prog: () => [count(list, done), list.length] });
  }
  B.push(
    { id: 'allMischief', icon: '😈', name: P('Kucing Paling Nakal', 'Naughtiest Cat'), desc: P('Lakukan semua kenakalan', 'Do every mischief'), coins: 80, item: 'face:topengNakal', big: true, done: () => MISCHIEF.every((m) => done(m.id)), prog: () => [count(MISCHIEF, done), MISCHIEF.length] },
    {
      id: 'mischief50', icon: '🌪️', name: P('Biang Kerok', 'Troublemaker'), desc: P('Total 50 kenakalan', '50 mischiefs in total'), coins: 25,
      done: () => sumMischief() >= 50, prog: () => [sumMischief(), 50],
    },
  );
  return B;
}
const sumMischief = () => Object.values(ctx.save.mischief).reduce((a: number, n) => a + (n as number), 0) as number;

export class Album {
  badges: Badge[] = buildBadges();

  constructor() {
    // first look at an old save: grant what was already earned, quietly (no banner spam)
    this.check(true);
  }

  /** percentages for the album tabs */
  pct() {
    const s = ctx.save;
    const f = FISH.filter((x) => s.fish[x.id]).length / FISH.length;
    const m = MISCHIEF.filter((x) => s.mischief[x.id]).length / MISCHIEF.length;
    const b = this.badges.filter((x) => s.album.badges[x.id]).length / this.badges.length;
    const P = (k: number) => Math.floor(k * 100);
    return { fish: P(f), mischief: P(m), badges: P(b), all: P((f + m + b) / 3) };
  }

  hasNews() {
    return ctx.save.album.news.length > 0;
  }
  isNew(k: string) {
    return ctx.save.album.news.includes(k);
  }
  /** album screen opened a tab: clear its "new" marks */
  seen(prefix: 'f' | 'm' | 'b') {
    const a = ctx.save.album;
    const n = a.news.length;
    a.news = a.news.filter((k) => !k.startsWith(prefix + ':'));
    if (a.news.length !== n) {
      writeSave(ctx.save);
      ctx.ui?.albumDot();
    }
  }
  private news(k: string) {
    const a = ctx.save.album;
    if (!a.news.includes(k)) a.news.push(k);
    if (a.news.length > 60) a.news.splice(0, a.news.length - 60);
    ctx.ui?.albumDot();
  }

  onFish(f: FishDef, first: boolean) {
    if (first) {
      this.news('f:' + f.id);
      ctx.ui?.toast('📖 ' + tr('albumNew', { x: `${f.icon} ${L(f.name)}` }), 2.6);
    }
    this.check();
  }

  onMischief(id: string, first: boolean) {
    if (first && MBY[id]) {
      this.news('m:' + id);
      ctx.ui?.toast('📖 ' + tr('albumNew', { x: `${MBY[id].icon} ${L(MBY[id].name)}` }), 2.6);
    }
    this.check();
  }

  /** Award every badge whose condition is met. Rewards are given exactly once (save.album.badges). */
  check(quiet = false) {
    const s = ctx.save;
    let any = false;
    for (const b of this.badges) {
      if (s.album.badges[b.id] || !b.done()) continue;
      s.album.badges[b.id] = s.day || 1;
      any = true;
      let itemName = '';
      if (b.item) {
        s.owned[b.item] = true;
        const it = ITEMS.find((i) => key(i) === b.item);
        if (it) itemName = L(it.name);
      }
      if (quiet) {
        // old saves: stickers already earned are handed out silently (red dot on the album)
        s.coins += b.coins;
        this.news('b:' + b.id);
        continue;
      }
      if (b.coins) addCoins(b.coins);
      this.news('b:' + b.id);
      const sub = L(b.name) + (itemName ? ' · ' + tr('rewardItem', { item: itemName }) : '');
      ctx.ui?.bannerQ(b.big ? '🎁' : b.icon, b.big ? tr('setDone') : tr('badgeGot'), sub, b.coins, () => (b.big ? sfx.fanfare() : sfx.jingle()));
      if (ctx.cat && ctx.fx) ctx.fx.stars(ctx.cat.body.x, ctx.cat.body.y + 0.8, ctx.cat.body.z, b.big ? 10 : 5);
    }
    if (any) writeSave(s);
  }
}
