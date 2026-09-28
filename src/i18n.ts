import { ctx } from './ctx';

export type Pair = { id: string; en: string };

export function lang(): 'id' | 'en' {
  return ctx.save?.settings?.lang === 'en' ? 'en' : 'id';
}

export function L(p: Pair | string | undefined, vars?: Record<string, any>): string {
  if (!p) return '';
  let s = typeof p === 'string' ? p : p[lang()] ?? p.id;
  if (vars) for (const k of Object.keys(vars)) s = s.split('{' + k + '}').join(String(vars[k]));
  return s;
}

const T: Record<string, Pair> = {
  // Title & menu
  title1: { id: 'Cat Simulator', en: 'Cat Simulator' },
  title2: { id: 'Sebelum Mama Pulang', en: 'Before Mom Comes Home' },
  play: { id: 'Main', en: 'Play' },
  continueDay: { id: 'Main (Hari {n})', en: 'Play (Day {n})' },
  style: { id: 'Gaya Kucing', en: 'Cat Style' },
  book: { id: 'Buku Kenakalan', en: 'Mischief Book' },
  settings: { id: 'Pengaturan', en: 'Settings' },
  back: { id: 'Kembali', en: 'Back' },
  close: { id: 'Tutup', en: 'Close' },
  ok: { id: 'Oke', en: 'OK' },
  yes: { id: 'Ya', en: 'Yes' },
  no: { id: 'Tidak', en: 'No' },
  tapToStart: { id: 'Ketuk untuk mulai', en: 'Tap to start' },

  // Settings
  language: { id: 'Bahasa', en: 'Language' },
  music: { id: 'Musik', en: 'Music' },
  sfx: { id: 'Efek suara', en: 'Sound effects' },
  graphics: { id: 'Grafis', en: 'Graphics' },
  gLow: { id: 'Ringan', en: 'Light' },
  gHigh: { id: 'Bagus', en: 'Nice' },
  dayLength: { id: 'Durasi satu hari', en: 'Day length' },
  min: { id: '{n} menit', en: '{n} min' },
  arrow: { id: 'Panah petunjuk', en: 'Guide arrow' },
  on: { id: 'Nyala', en: 'On' },
  off: { id: 'Mati', en: 'Off' },
  fullscreen: { id: 'Layar penuh', en: 'Fullscreen' },
  resetData: { id: 'Hapus semua progres', en: 'Erase all progress' },
  resetConfirm: { id: 'Yakin hapus semua progres? Koin, baju, dan koleksi akan hilang.', en: 'Erase all progress? Coins, outfits and collection will be lost.' },
  resetDone: { id: 'Progres sudah dihapus.', en: 'Progress erased.' },

  // Customize
  catName: { id: 'Nama kucing', en: 'Cat name' },
  slot_fur: { id: 'Bulu', en: 'Fur' },
  slot_pattern: { id: 'Pola', en: 'Pattern' },
  slot_eyes: { id: 'Mata', en: 'Eyes' },
  slot_head: { id: 'Kepala', en: 'Head' },
  slot_face: { id: 'Wajah', en: 'Face' },
  slot_neck: { id: 'Leher', en: 'Neck' },
  slot_back: { id: 'Punggung', en: 'Back' },
  buy: { id: 'Beli', en: 'Buy' },
  wear: { id: 'Pakai', en: 'Wear' },
  wearing: { id: 'Dipakai', en: 'Wearing' },
  free: { id: 'Gratis', en: 'Free' },
  questLock: { id: 'Hadiah quest Lisa', en: "Lisa's quest reward" },
  notEnough: { id: 'Koin ikan belum cukup', en: 'Not enough fish coins' },
  bought: { id: 'Dibeli: {item}', en: 'Bought: {item}' },
  done: { id: 'Selesai', en: 'Done' },
  firstStyleTitle: { id: 'Kenalan dulu, yuk!', en: "Let's meet your cat!" },
  firstStyleSub: { id: 'Kasih nama dan pilih warna bulumu.', en: 'Give it a name and pick a fur color.' },

  // Book
  tabMischief: { id: 'Kenakalan', en: 'Mischief' },
  tabFish: { id: 'Ikan', en: 'Fish' },
  unknown: { id: '???', en: '???' },
  timesDone: { id: '{n}x', en: '{n}x' },
  hintArea: { id: 'Petunjuk: di {area}', en: 'Hint: in {area}' },
  bookProgress: { id: '{a} dari {b} ditemukan', en: '{a} of {b} found' },
  locked: { id: 'Terkunci', en: 'Locked' },

  // HUD
  day: { id: 'Hari {n}', en: 'Day {n}' },
  meow: { id: 'Meong', en: 'Meow' },
  jump: { id: 'Lompat', en: 'Jump' },
  pause: { id: 'Jeda', en: 'Pause' },
  resume: { id: 'Lanjut main', en: 'Resume' },
  map: { id: 'Peta', en: 'Map' },
  quitDay: { id: 'Keluar ke menu', en: 'Quit to menu' },
  quitConfirm: { id: 'Keluar sekarang? Koin yang sudah didapat tetap tersimpan.', en: 'Quit now? Coins you earned are kept.' },
  mamaSoon: { id: 'Mama sebentar lagi pulang! Ayo ke sofa!', en: 'Mom is almost home! Get to the sofa!' },
  goHome: { id: 'Pulang!', en: 'Go home!' },
  newMischief: { id: 'Kenakalan baru!', en: 'New mischief!' },
  coinsPlus: { id: '+{n}', en: '+{n}' },
  noAction: { id: 'Cakar', en: 'Paw' },
  splashNo: { id: 'Brrr! Kucing nggak suka air!', en: "Brrr! Cats don't like water!" },
  shooed: { id: 'Diusir!', en: 'Shooed!' },
  hugged: { id: 'Dipeluk!', en: 'Hugged!' },
  lockedGate: { id: 'Gerbangnya masih dikunci...', en: 'The gate is still locked...' },
  foundArea: { id: '{area}', en: '{area}' },

  // Action labels
  a_push: { id: 'Dorong', en: 'Push' },
  a_grab: { id: 'Curi', en: 'Steal' },
  a_sleep: { id: 'Tidur', en: 'Nap' },
  a_scratch: { id: 'Cakar', en: 'Scratch' },
  a_poke: { id: 'Ganggu', en: 'Tease' },
  a_dig: { id: 'Gali', en: 'Dig' },
  a_pull: { id: 'Tarik', en: 'Pull' },
  a_scare: { id: 'Kagetin', en: 'Spook' },
  a_fish: { id: 'Mancing', en: 'Fish' },
  a_talk: { id: 'Ngobrol', en: 'Talk' },
  a_drop: { id: 'Taruh', en: 'Drop' },
  a_eat: { id: 'Makan', en: 'Eat' },
  a_give: { id: 'Kasih', en: 'Give' },
  a_sofa: { id: 'Pura-pura tidur', en: 'Fake sleep' },

  // Sofa confirm
  sofaConfirm: { id: 'Pura-pura tidur sekarang? Hari ini akan selesai.', en: 'Fake-sleep now? The day will end.' },
  sofaYes: { id: 'Tidur', en: 'Sleep' },
  sofaNo: { id: 'Nanti dulu', en: 'Not yet' },

  // Fishing
  fishWait: { id: 'Tunggu ikannya...', en: 'Wait for a bite...' },
  fishBite: { id: 'Ada yang makan! TEKAN!', en: 'A bite! TAP!' },
  fishReel: { id: 'Tekan saat di hijau!', en: 'Tap in the green!' },
  fishEarly: { id: 'Kecepetan! Ikannya kaget.', en: 'Too soon! The fish got scared.' },
  fishMissed: { id: 'Ikannya kabur...', en: 'The fish got away...' },
  fishLost: { id: 'Yah, lepas!', en: 'Aw, it slipped away!' },
  fishGot: { id: 'Dapat {fish}!', en: 'Caught {fish}!' },
  fishExit: { id: 'Selesai mancing', en: 'Stop fishing' },
  tap: { id: 'Tekan', en: 'Tap' },

  // Day flow
  dayStart: { id: 'Hari {n}', en: 'Day {n}' },
  mamaBye: { id: 'Mama kerja dulu ya, {name}! Jangan nakal, ya!', en: "Mom's off to work, {name}! Be good, okay?" },
  doorOpen: { id: 'Eh... pintunya lupa dikunci!', en: 'Hey... the door was left unlocked!' },
  mamaBye2: { id: 'Dadah! Sampai nanti sore!', en: 'Bye! See you this evening!' },
  hoursLater: { id: 'Beberapa jam kemudian...', en: 'A few hours later...' },
  mamaHome1: { id: 'Mama pulang! {name}, kamu tidur terus ya dari tadi? Anak baik!', en: "Mom's home! {name}, were you asleep this whole time? Good kitty!" },
  mamaMess: { id: 'Eh... kok rumah berantakan? Hmm...', en: 'Wait... why is the house such a mess? Hmm...' },
  catInnocent: { id: 'Meong? (muka polos)', en: 'Meow? (innocent face)' },
  mamaCaught: { id: '{name}!! Kok kamu di luar?! Ayo masuk!', en: "{name}!! Why are you outside?! Get inside!" },
  catSorry: { id: 'Meong... (ketahuan)', en: 'Meow... (busted)' },
  summaryTitle: { id: 'Hari {n} selesai!', en: 'Day {n} done!' },
  sumMischief: { id: 'Kenakalan hari ini', en: "Today's mischief" },
  sumNone: { id: 'Belum ada kenakalan hari ini.', en: 'No mischief today.' },
  sumCoins: { id: 'Koin ikan hari ini', en: 'Fish coins today' },
  sumOnTime: { id: 'Pulang tanpa ketahuan', en: 'Home without getting caught' },
  sumCaught: { id: 'Ketahuan Mama', en: 'Caught by Mom' },
  sumDayBonus: { id: 'Bonus hari selesai', en: 'Day complete bonus' },
  nextDay: { id: 'Hari berikutnya', en: 'Next day' },
  toMenu: { id: 'Menu', en: 'Menu' },
  perfectDay: { id: 'Hari sempurna!', en: 'Perfect day!' },

  // Quests
  questTitle: { id: 'Quest Lisa', en: "Lisa's quest" },
  questNew: { id: 'Quest baru dari Lisa!', en: 'New quest from Lisa!' },
  questReady: { id: 'Quest selesai! Kembali ke Lisa.', en: 'Quest complete! Go back to Lisa.' },
  questFindLisa: { id: 'Temui Lisa di dekat kolam taman', en: 'Find Lisa by the park pond' },
  questDoneAll: { id: 'Semua quest Lisa selesai!', en: "All of Lisa's quests done!" },
  reward: { id: 'Hadiah: {r}', en: 'Reward: {r}' },
  unlockPasar: { id: 'Pasar Ikan terbuka!', en: 'Fish Market unlocked!' },
  unlockAtap: { id: 'Jalan ke atap terbuka!', en: 'Rooftop path unlocked!' },
  gotItem: { id: 'Dapat: {item}', en: 'Got: {item}' },
  lisa: { id: 'Lisa', en: 'Lisa' },
  mama: { id: 'Mama', en: 'Mom' },
  tapNext: { id: 'Ketuk untuk lanjut', en: 'Tap to continue' },
  skip: { id: 'Lewati', en: 'Skip' },

  // Tutorial tips
  tip1: { id: 'Geser di kiri layar untuk jalan. Geser di kanan untuk putar kamera.', en: 'Drag on the left to walk. Drag on the right to turn the camera.' },
  tip1k: { id: 'WASD untuk jalan, spasi untuk lompat, E untuk aksi, geser mouse untuk kamera.', en: 'WASD to walk, Space to jump, E for action, drag the mouse to turn.' },
  tip2: { id: 'Cari barang yang berkilau, lalu tekan tombol aksi!', en: 'Find sparkly things, then press the action button!' },
  tip3: { id: 'Hati-hati! Kalau orang lihat, kamu bakal diusir.', en: "Careful! If people see you, they'll shoo you away." },
  tip4: { id: 'Temui Lisa di taman seberang jalan. Dia punya misi buatmu!', en: 'Meet Lisa in the park across the street. She has a mission for you!' },
  tip5: { id: 'Pulang dan pura-pura tidur di sofa sebelum Mama datang!', en: 'Go home and fake-sleep on the sofa before Mom arrives!' },

  // Areas
  ar_rumah: { id: 'Rumah', en: 'Home' },
  ar_jalan: { id: 'Jalan Kompleks', en: 'Neighborhood Street' },
  ar_tetangga: { id: 'Rumah Bu Siti', en: "Mrs. Siti's House" },
  ar_anjing: { id: 'Rumah Pak RT', en: "Mr. RT's House" },
  ar_taman: { id: 'Taman Kompleks', en: 'Neighborhood Park' },
  ar_pasar: { id: 'Pasar Ikan', en: 'Fish Market' },
  ar_atap: { id: 'Atap Tetangga', en: 'Rooftops' },
  ar_gang: { id: 'Gang Sempit', en: 'Narrow Alley' },
};

export function tr(key: string, vars?: Record<string, any>): string {
  const p = T[key];
  if (!p) return key;
  return L(p, vars);
}
