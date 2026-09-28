import type { Pair } from './i18n';
import { ctx } from './ctx';

export type Slot = 'fur' | 'pattern' | 'eyes' | 'head' | 'face' | 'neck' | 'back';
export const SLOTS: Slot[] = ['fur', 'pattern', 'eyes', 'head', 'face', 'neck', 'back'];

export interface Item {
  id: string;
  slot: Slot;
  name: Pair;
  price: number; // 0 = free
  quest?: string; // unlocked by this Lisa quest id
  color?: number;
  color2?: number;
}

const P = (id: string, en: string): Pair => ({ id, en });

export const ITEMS: Item[] = [
  // Fur
  { id: 'oranye', slot: 'fur', name: P('Oranye', 'Orange'), price: 0, color: 0xf2a044 },
  { id: 'abu', slot: 'fur', name: P('Abu-abu', 'Grey'), price: 0, color: 0x9aa3ad },
  { id: 'hitam', slot: 'fur', name: P('Hitam', 'Black'), price: 0, color: 0x3b3a45 },
  { id: 'putih', slot: 'fur', name: P('Putih', 'White'), price: 15, color: 0xf6f3ec },
  { id: 'krem', slot: 'fur', name: P('Krem', 'Cream'), price: 15, color: 0xeed7ab },
  { id: 'cokelat', slot: 'fur', name: P('Cokelat', 'Brown'), price: 20, color: 0x8d5b3b },
  { id: 'biru', slot: 'fur', name: P('Biru langit', 'Sky blue'), price: 40, color: 0x94c9f0 },
  { id: 'pink', slot: 'fur', name: P('Pink permen', 'Candy pink'), price: 40, color: 0xf6a6c8 },
  { id: 'ungu', slot: 'fur', name: P('Ungu', 'Purple'), price: 50, color: 0xb59bef },
  { id: 'emas', slot: 'fur', name: P('Emas berkilau', 'Shiny gold'), price: 0, quest: 'q5', color: 0xf3c33c },
  // Pattern
  { id: 'polos', slot: 'pattern', name: P('Polos', 'Plain'), price: 0 },
  { id: 'kauskaki', slot: 'pattern', name: P('Kaus kaki', 'Socks'), price: 20 },
  { id: 'belang', slot: 'pattern', name: P('Belang', 'Tabby'), price: 0, quest: 'q1' },
  { id: 'tutul', slot: 'pattern', name: P('Tutul', 'Spots'), price: 30 },
  { id: 'tuxedo', slot: 'pattern', name: P('Tuksedo', 'Tuxedo'), price: 0, quest: 'q3' },
  { id: 'calico', slot: 'pattern', name: P('Kaliko', 'Calico'), price: 40 },
  // Eyes
  { id: 'hijau', slot: 'eyes', name: P('Hijau', 'Green'), price: 0, color: 0x6fcf5a },
  { id: 'kuning', slot: 'eyes', name: P('Kuning', 'Yellow'), price: 0, color: 0xf6cf3a },
  { id: 'biruMata', slot: 'eyes', name: P('Biru', 'Blue'), price: 10, color: 0x49a6f2 },
  { id: 'unguMata', slot: 'eyes', name: P('Ungu', 'Violet'), price: 25, color: 0xa66af0 },
  { id: 'beda', slot: 'eyes', name: P('Beda warna', 'Odd eyes'), price: 30, color: 0x49a6f2, color2: 0xf6cf3a },
  // Head
  { id: 'none', slot: 'head', name: P('Tanpa topi', 'No hat'), price: 0 },
  { id: 'pita', slot: 'head', name: P('Pita', 'Bow'), price: 15 },
  { id: 'bunga', slot: 'head', name: P('Mahkota bunga', 'Flower crown'), price: 25 },
  { id: 'koboi', slot: 'head', name: P('Topi koboi', 'Cowboy hat'), price: 40 },
  { id: 'topiPesta', slot: 'head', name: P('Topi pesta', 'Party hat'), price: 0, quest: 'q2' },
  { id: 'mahkota', slot: 'head', name: P('Mahkota raja', 'Royal crown'), price: 0, quest: 'q4' },
  // Face
  { id: 'none', slot: 'face', name: P('Tanpa kacamata', 'No glasses'), price: 0 },
  { id: 'bulat', slot: 'face', name: P('Kacamata kotak', 'Square glasses'), price: 20 },
  { id: 'hitamK', slot: 'face', name: P('Kacamata hitam', 'Sunglasses'), price: 30 },
  { id: 'hati', slot: 'face', name: P('Kacamata hati', 'Heart glasses'), price: 35 },
  // Neck
  { id: 'none', slot: 'neck', name: P('Tanpa kalung', 'No collar'), price: 0 },
  { id: 'kalung', slot: 'neck', name: P('Kalung merah', 'Red collar'), price: 0 },
  { id: 'lonceng', slot: 'neck', name: P('Kalung lonceng', 'Bell collar'), price: 15 },
  { id: 'syal', slot: 'neck', name: P('Syal', 'Scarf'), price: 25 },
  { id: 'dasi', slot: 'neck', name: P('Dasi kupu-kupu', 'Bow tie'), price: 25 },
  // Back
  { id: 'none', slot: 'back', name: P('Kosong', 'Nothing'), price: 0 },
  { id: 'ransel', slot: 'back', name: P('Ransel mini', 'Mini backpack'), price: 35 },
  { id: 'sayap', slot: 'back', name: P('Sayap malaikat', 'Angel wings'), price: 60 },
  { id: 'jubah', slot: 'back', name: P('Jubah pahlawan', 'Hero cape'), price: 0, quest: 'q6' },
];

export const key = (it: Item) => it.slot + ':' + it.id;

export function itemsFor(slot: Slot) {
  return ITEMS.filter((i) => i.slot === slot);
}

export function getItem(slot: Slot, id: string): Item | undefined {
  return ITEMS.find((i) => i.slot === slot && i.id === id);
}

export function isOwned(it: Item) {
  if (it.price === 0 && !it.quest) return true;
  return !!ctx.save.owned[key(it)];
}

export function furColor(id: string) {
  return getItem('fur', id)?.color ?? 0xf2a044;
}
