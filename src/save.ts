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
  /** true once the player picked a language in Settings; until then the game stays in Indonesian */
  langChosen: boolean;
  music: number; // 0..1
  sfx: number; // 0..1
  quality: 'low' | 'high';
  dayLen: number; // seconds
  arrow: boolean;
  /** 'acak' = random day types (sunny/rain/night), 'cerah' = always sunny */
  weather: 'acak' | 'cerah';
}

export interface SaveData {
  v: number;
  name: string;
  look: Look;
  coins: number;
  owned: Record<string, boolean>;
  mischief: Record<string, number>; // times done, all-time
  fish: Record<string, number>;
  fishBest: Record<string, number>; // biggest catch per fish, cm
  /** collection album: badges earned (value = day) and entries not yet seen in the album (red dot) */
  album: { badges: Record<string, number>; news: string[] };
  quest: { idx: number; stage: 'offer' | 'active' | 'ready' | 'done'; prog: any; gen: any; recent: string[] };
  day: number;
  unlocked: { pasar: boolean; atap: boolean };
  settings: Settings;
  stats: { perfectDays: number; caught: number; onTime: number; fishTotal: number };
  firstRun: boolean;
  metLisa: boolean;
  /** day type of each day played (counts), e.g. { hujan: 2 } */
  weatherSeen: Record<string, number>;
  /** whose quest is on the HUD card: 'lisa' | 'belang' | 'mpus' */
  focus: string;
  /** Tantangan Harian: 3 challenges per local date + 🔥 streak of fully finished days */
  daily: { date: string; list: { q: any; stage: string; prog: any }[]; streak: number; best: number; lastFull: string; total: number };
  /** Peringkat Kucing: bonus quests + daily challenges + friends' quests completed */
  rank: { n: number; lv: number };
  /** the other quest-giver cats, each with its own quest slot */
  givers: Record<'belang' | 'mpus', GiverState>;
  /** Rumah Kucing: owned decorations (id -> true) */
  decor: Record<string, boolean>;
  /** owned decorations the player put away (not shown in the house) */
  decorOff: Record<string, boolean>;
}

export interface GiverState {
  stage: 'offer' | 'active' | 'ready';
  prog: any;
  gen: any;
  recent: string[];
  n: number; // quests finished for this friend
  met: boolean;
}

const giver = (): GiverState => ({ stage: 'offer', prog: {}, gen: null, recent: [], n: 0, met: false });

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
    fishBest: {},
    album: { badges: {}, news: [] },
    quest: { idx: 0, stage: 'offer', prog: {}, gen: null, recent: [] },
    day: 1,
    unlocked: { pasar: false, atap: false },
    settings: { lang: 'id', langChosen: false, music: 0.6, sfx: 0.9, quality: 'high', dayLen: 300, arrow: true, weather: 'acak' },
    stats: { perfectDays: 0, caught: 0, onTime: 0, fishTotal: 0 },
    firstRun: true,
    metLisa: false,
    weatherSeen: {},
    focus: 'lisa',
    daily: { date: '', list: [], streak: 0, best: 0, lastFull: '', total: 0 },
    rank: { n: 0, lv: 0 },
    givers: { belang: giver(), mpus: giver() },
    decor: {},
    decorOff: {},
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
  for (const k of ['owned', 'mischief', 'fish', 'weatherSeen', 'decor', 'decorOff', 'fishBest']) if (extra[k] && typeof extra[k] === 'object') base[k] = { ...extra[k] };
  if (extra.quest && extra.quest.prog) base.quest.prog = extra.quest.prog;
  if (extra.givers && typeof extra.givers === 'object')
    for (const g of Object.keys(base.givers || {})) if (extra.givers[g]?.prog && typeof extra.givers[g].prog === 'object') base.givers[g].prog = extra.givers[g].prog;
  if (extra.album && extra.album.badges && typeof extra.album.badges === 'object') base.album.badges = { ...extra.album.badges };
  return base;
}

export function loadSave(): SaveData {
  const d = defaultSave();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = merge(d, JSON.parse(raw));
      // Indonesian by default: older saves may hold 'en' picked from the device language, not by the player
      if (!s.settings.langChosen) s.settings.lang = 'id';
      return s;
    }
  } catch (e) {
    /* storage blocked: play without saving */
  }
  // First run: always Indonesian (English stays available in Settings)
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
