// Progress lives in localStorage on the phone. Every access is wrapped in
// try/catch so the game still runs (without saving) when storage is blocked.
export interface Look {
  fur: string;
  pattern: string;
  eyes: string;
  head: string;
  face: string;
  neck: string;
  back: string;
}

export interface Settings {
  lang: 'id' | 'en';
  music: number; // 0..1
  sfx: number; // 0..1
  quality: 'low' | 'high';
  dayLen: number; // seconds
  arrow: boolean;
}

export interface SaveData {
  v: number;
  name: string;
  look: Look;
  coins: number;
  owned: Record<string, boolean>;
  mischief: Record<string, number>; // times done, all-time
  fish: Record<string, number>;
  quest: { idx: number; stage: 'offer' | 'active' | 'ready' | 'done'; prog: any };
  day: number;
  unlocked: { pasar: boolean; atap: boolean };
  settings: Settings;
  stats: { perfectDays: number; caught: number; onTime: number; fishTotal: number };
  firstRun: boolean;
  metLisa: boolean;
}

const KEY = 'cat-sim-sebelum-mama-pulang-v1';

export function defaultSave(): SaveData {
  return {
    v: 1,
    name: 'Meong',
    look: { fur: 'oranye', pattern: 'polos', eyes: 'hijau', head: 'none', face: 'none', neck: 'kalung', back: 'none' },
    coins: 0,
    owned: {},
    mischief: {},
    fish: {},
    quest: { idx: 0, stage: 'offer', prog: {} },
    day: 1,
    unlocked: { pasar: false, atap: false },
    settings: { lang: 'id', music: 0.6, sfx: 0.9, quality: 'high', dayLen: 300, arrow: true },
    stats: { perfectDays: 0, caught: 0, onTime: 0, fishTotal: 0 },
    firstRun: true,
    metLisa: false,
  };
}

function merge(base: any, extra: any): any {
  if (!extra || typeof extra !== 'object') return base;
  for (const k of Object.keys(base)) {
    if (!(k in extra)) continue;
    const b = base[k];
    const e = extra[k];
    if (b && typeof b === 'object' && !Array.isArray(b) && e && typeof e === 'object') base[k] = merge(b, e);
    else if (typeof b === typeof e || b === null) base[k] = e;
  }
  // keep dynamic record keys (owned, mischief, fish, prog)
  for (const k of ['owned', 'mischief', 'fish']) if (extra[k] && typeof extra[k] === 'object') base[k] = { ...extra[k] };
  if (extra.quest && extra.quest.prog) base.quest.prog = extra.quest.prog;
  return base;
}

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return merge(d, JSON.parse(raw));
  } catch (e) {
    /* storage blocked: play without saving */
  }
  // First run: pick language from the device
  try {
    if (!(navigator.language || 'id').toLowerCase().startsWith('id')) d.settings.lang = 'en';
  } catch (e) {}
  return d;
}

export function writeSave(s: SaveData) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    /* ignore */
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (e) {}
}
