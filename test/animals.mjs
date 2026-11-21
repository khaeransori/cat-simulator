// Blocky animals: lineup beside Blocky people (with Box3 sizes), every cosmetic on the cat
// (grid sheet), and pose shots for the cat / dog / birds. Look at test/shots/animals-*.png.
import { start, check, OUT } from './lib.mjs';
import fs from 'fs';

const h = await start();
const save = (name, url) => fs.writeFileSync(OUT + name + '.png', Buffer.from(url.split(',')[1], 'base64'));

// shared in-page studio: own renderer + scene, returns PNG data URLs
await h.ev(() => {
  const K = window.__catModels, T = K.THREE;
  const r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.outputColorSpace = T.SRGBColorSpace;
  const studio = (bg = 0xbfe3f5) => {
    const sc = new T.Scene();
    sc.background = new T.Color(bg);
    sc.add(new T.HemisphereLight(0xffffff, 0x8899aa, 1.3));
    const d = new T.DirectionalLight(0xffffff, 1.5);
    d.position.set(2, 4, 3);
    sc.add(d);
    const g = new T.Mesh(new T.PlaneGeometry(40, 40), new T.MeshLambertMaterial({ color: 0x8fc46a }));
    g.rotation.x = -Math.PI / 2;
    sc.add(g);
    return sc;
  };
  const shot = (sc, w, hh, pos, look, fov = 30) => {
    r.setSize(w, hh, false);
    const cam = new T.PerspectiveCamera(fov, w / hh, 0.05, 100);
    cam.position.set(...pos);
    cam.lookAt(...look);
    r.render(sc, cam);
    return r.domElement.toDataURL('image/png');
  };
  const size = (o) => {
    o.updateMatrixWorld(true);
    const b = new T.Box3().setFromObject(o), v = new T.Vector3();
    b.getSize(v);
    return [+v.x.toFixed(2), +v.y.toFixed(2), +v.z.toFixed(2)];
  };
  const person = (kid) => {
    const n = K.buildBlocky(kid ? { kid: true, skin: 0xc68a5e, top: 'kaosBola', topC: 0xe53935, topC2: 0xffffff, long: false, bottom: 'pendek', botC: 0x1e3a8a, head: 'pendek', hair: 0x2a1d16, shoes: 0x222222 } : { skin: 0xb97a52, top: 'koko', topC: 0xf3f0e6, topC2: 0xc9a86a, headC: 0x222222, long: true, bottom: 'celana', botC: 0x3b3b44, head: 'peci', shoes: 0x3a2a20 });
    n.root.scale.setScalar((kid ? 1.37 : 1.7) / 2.73);
    return n.root;
  };
  const still = { speed: 0, air: false, sleep: 0, sit: 0, paw: 0, scratch: false, dig: false, eat: false, earsDown: 0, happy: 0, hugged: false, lookYaw: 0 };
  const cat = (look, scale) => {
    const m = new K.CatModel();
    m.setLook({ fur: 'oranye', pattern: 'polos', eyes: 'hijau', head: 'none', face: 'none', neck: 'kalung', back: 'none', ...look });
    if (scale) m.root.scale.setScalar(scale);
    m.t = 0.5; m.blinkT = 9;
    m.update(0.016, still);
    return m;
  };
  window.__an = { K, T, studio, shot, size, person, cat, still };
});

// ---------- 1. lineup ----------
const lineup = await h.ev(() => {
  const { K, studio, shot, size, person, cat } = window.__an;
  const sc = studio();
  const items = [
    ['dewasa 1.7', person(false)],
    ['anak 1.37', person(true)],
    ['kucing pemain', cat({}).root],
    ['Lisa', cat({ fur: 'putih', pattern: 'calico', eyes: 'biruMata', head: 'pita', neck: 'lonceng' }).root],
    ['Si Belang x1.1', cat({ fur: 'abu', pattern: 'belang', eyes: 'kuning', face: 'hitamK' }, 1.1).root],
    ['Mpus x1.18', cat({ fur: 'krem', pattern: 'tutul', neck: 'dasi' }, 1.18).root],
    ['Bleki', (() => { const d = new K.DogModel(); d.update(0.016, { run: 0, sleep: false, bark: false }); return d.root; })()],
    ['bebek', new K.DuckModel().root],
    ['bebek cokelat', new K.DuckModel(0xc8a165).root],
    ['merpati', new K.PigeonModel().root],
    ['ayam', new K.ChickenModel().root],
  ];
  const out = [];
  items.forEach(([n, o], i) => {
    o.position.set(-3.1 + i * 0.62, 0, 0);
    o.rotation.y = 0.5;
    sc.add(o);
    out.push(n + ' ' + JSON.stringify(size(o)));
  });
  const front = shot(sc, 1400, 560, [0, 1.0, 7.2], [0, 0.7, 0], 32);
  items.forEach(([, o]) => (o.rotation.y = Math.PI / 2));
  const side = shot(sc, 1400, 560, [0, 0.55, 7.2], [0, 0.55, 0], 32);
  return { out, front, side };
});
save('animals-lineup', lineup.front);
save('animals-lineup-side', lineup.side);
console.log('sizes [w,h,d] m:\n  ' + lineup.out.join('\n  '));
const hOf = (n) => JSON.parse(lineup.out.find((l) => l.startsWith(n + ' ')).slice(n.length + 1))[1];
check('cat roughly knee-to-thigh height of an adult', hOf('kucing pemain') > 0.45 && hOf('kucing pemain') < 0.75, String(hOf('kucing pemain')));
check('dog bigger than cat', hOf('Bleki') > hOf('kucing pemain'));
check('duck and pigeon smaller than cat', hOf('bebek') < hOf('kucing pemain') && hOf('merpati') < hOf('bebek'));

// ---------- 2. cosmetics grid: every item on the cat ----------
const grid = await h.ev(async () => {
  const { K, studio, shot, cat } = window.__an;
  const tiles = [];
  for (const it of K.ITEMS) {
    if (it.id === 'none' && it.slot !== 'fur') continue;
    const look = { [it.slot]: it.id, neck: it.slot === 'neck' ? it.id : 'none' };
    const lowCam = it.slot === 'neck';
    const sc = studio(0xe8eef3);
    const m = cat(look);
    m.root.rotation.y = it.slot === 'back' ? Math.PI * 0.8 : 0.55;
    sc.add(m.root);
    const url = shot(sc, 200, 200, lowCam ? [0, 0.4, 1.6] : [0, 0.7, 1.6], [0, 0.42, 0], 30);
    tiles.push({ url, label: it.slot + ':' + it.id });
  }
  const cols = 9, tw = 200, rows = Math.ceil(tiles.length / cols);
  const cv = document.createElement('canvas');
  cv.width = cols * tw; cv.height = rows * (tw + 18);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '14px sans-serif'; g.fillStyle = '#222';
  for (let i = 0; i < tiles.length; i++) {
    const im = new Image(); im.src = tiles[i].url; await im.decode();
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (tw + 18);
    g.drawImage(im, x, y);
    g.fillText(tiles[i].label, x + 4, y + tw + 14);
  }
  return { n: tiles.length, want: K.ITEMS.filter((it) => it.id !== 'none' || it.slot === 'fur').length, url: cv.toDataURL('image/png') };
});
save('animals-cosmetics', grid.url);
check('cosmetics grid covers every item', grid.n === grid.want && grid.n > 40, `${grid.n}/${grid.want}`);

// ---------- 3. poses ----------
const poses = await h.ev(async () => {
  const { K, T, studio, shot, cat, still } = window.__an;
  const P = [
    ['jalan', { speed: 0.5 }],
    ['lari', { speed: 1 }],
    ['lompat', { air: true }],
    ['duduk', { sit: 1 }],
    ['tidur', { sleep: 1 }],
    ['cakar', { scratch: true }],
    ['tepuk', { paw: 0.5 }],
    ['gali', { dig: true }],
    ['makan', { eat: true }],
    ['telinga turun', { earsDown: 1 }],
    ['dipeluk', { hugged: true }],
    ['senang', { happy: 1, sit: 1 }],
  ];
  const tiles = [];
  for (const [n, a] of P) {
    const sc = studio();
    const m = cat({ pattern: 'belang', back: n === 'lompat' ? 'sayap' : n === 'lari' ? 'jubah' : 'none', head: n === 'duduk' ? 'koboi' : 'none' });
    if (n === 'makan' || n === 'jalan') { const f = new T.Mesh(new T.BoxGeometry(0.2, 0.08, 0.06), new T.MeshLambertMaterial({ color: 0xff8f00 })); f.rotation.y = Math.PI / 2; m.carry.add(f); }
    for (let i = 0; i < 8; i++) m.update(0.05, { ...still, ...a });
    m.root.rotation.y = 1.1;
    sc.add(m.root);
    tiles.push({ label: 'kucing ' + n, url: shot(sc, 220, 200, [0, 0.75, 2.3], [0, 0.38, 0]) });
  }
  const birdShot = (label, mk, fly) => { const sc = studio(); const b = mk(); for (let i = 0; i < 5; i++) b.update(0.033, fly); b.root.rotation.y = 0.9; sc.add(b.root); tiles.push({ label, url: shot(sc, 220, 200, [0, 0.5, 1.6], [0, 0.25, 0]) }); };
  for (const [n, st] of [['lari', { run: 1, sleep: false, bark: false }], ['gonggong', { run: 0, sleep: false, bark: true }], ['tidur', { run: 0, sleep: true, bark: false }]]) {
    const sc = studio(); const d = new K.DogModel(); for (let i = 0; i < 6; i++) d.update(0.05, st); d.root.rotation.y = 1.0; sc.add(d.root);
    tiles.push({ label: 'anjing ' + n, url: shot(sc, 220, 200, [0, 0.9, 3.0], [0, 0.42, 0]) });
  }
  birdShot('bebek jalan', () => new K.DuckModel(), false);
  birdShot('bebek terbang', () => new K.DuckModel(0xc8a165), true);
  birdShot('merpati jalan', () => new K.PigeonModel(), false);
  birdShot('merpati terbang', () => new K.PigeonModel(), true);
  birdShot('ayam', () => new K.ChickenModel(), false);
  const cols = 7, tw = 220, th = 200, rows = Math.ceil(tiles.length / cols);
  const cv = document.createElement('canvas');
  cv.width = cols * tw; cv.height = rows * (th + 18);
  const g = cv.getContext('2d');
  g.fillStyle = '#fff'; g.fillRect(0, 0, cv.width, cv.height);
  g.font = '14px sans-serif'; g.fillStyle = '#222';
  for (let i = 0; i < tiles.length; i++) {
    const im = new Image(); im.src = tiles[i].url; await im.decode();
    const x = (i % cols) * tw, y = Math.floor(i / cols) * (th + 18);
    g.drawImage(im, x, y);
    g.fillText(tiles[i].label, x + 4, y + th + 14);
  }
  return cv.toDataURL('image/png');
});
save('animals-poses', poses);

// ---------- 4. in game: the cat next to the world, draw calls ----------
await h.play();
const t0 = await h.ev(() => window.__cat.time);
await h.page.waitForFunction((t) => window.__cat.time > t + 1, t0, { timeout: 60000 });
await h.shot('animals-ingame');
const calls = await h.ev(() => window.__cat.renderer.info.render.calls);
check('draw calls reasonable', calls < 600, String(calls));
console.log('shots: ' + ['animals-lineup', 'animals-lineup-side', 'animals-cosmetics', 'animals-poses', 'animals-ingame'].map((n) => OUT + n + '.png').join(' '));
await h.close();
