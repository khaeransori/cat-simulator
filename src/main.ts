import '@fontsource/baloo-2/latin-500.css';
import '@fontsource/baloo-2/latin-700.css';
import '@fontsource/baloo-2/latin-800.css';
import './ui/style.css';
import * as THREE from 'three';
import { ctx, rand } from './ctx';
import { loadSave } from './save';
import { buildWorld } from './world/map';
import { Sky } from './world/sky';
import { FX } from './fx/particles';
import { Bubbles } from './fx/bubbles';
import { PropSystem } from './game/props';
import { InteractSystem } from './game/interact';
import { Cat, CameraRig } from './entities/cat';
import { Human, NPC_LINES } from './entities/npc';
import { Dog, Flock, Lisa, Kids, Butterflies } from './entities/creatures';
import { DuckModel } from './entities/animals';
import { CatModel } from './entities/catModel';
import { Quests } from './game/quests';
import { Progress, dailyFor, dayBefore, RANKS, GIVERS } from './game/progress';
import { genQuest, specialQuest, genKind } from './game/questgen';
import { SPECIAL_ITEMS } from './cosmetics';
import { Fishing, FBY, SPOTS, fishAvailable } from './game/fishing';
import { Album } from './game/album';
import { setupMischief, dropCarried } from './game/mischief';
import { Day } from './game/day';
import { WeatherSystem, rollWeather, weatherNow } from './game/weather';
import { DecorSystem } from './game/decor';
import { PhotoMode } from './ui/photo';
import { UI, HUD_HTML } from './ui/ui';
import { input, setupInput } from './input';
import { sfx } from './audio';
import { tr, L } from './i18n';

const $ = (id: string) => document.getElementById(id)!;

function boot() {
  const app = $('app');
  app.innerHTML = HUD_HTML;
  ctx.save = loadSave();
  document.documentElement.lang = ctx.save.settings.lang;
  ctx.isTouchDevice = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  if (!ctx.isTouchDevice) document.body.classList.add('touch-off');

  const canvas = $('c') as HTMLCanvasElement;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  ctx.scene = scene;
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 150);
  ctx.camera = camera;
  ctx.renderer = renderer;

  ctx.world = buildWorld(scene);
  ctx.sky = new Sky(scene);
  ctx.fx = new FX(scene);
  ctx.bubbles = new Bubbles($('bubbles'));
  ctx.props = new PropSystem();
  ctx.interact = new InteractSystem();

  const cat = new Cat(scene);
  ctx.cat = cat;
  cat.model.setLook(ctx.save.look);
  ctx.camRig = new CameraRig(camera);

  // ---- neighbours ----
  const W = ctx.world;
  const pts = W.pts;
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  const siti = new Human('siti', { skin: 0xc68e5f, shirt: 0x26a69a, pants: 0x1f8a80, skirt: true, hair: 'hijab', hijabColor: 0xffb74d, prop: 'sapu', shoes: 0x795548 }, 'adult', pts.sitiHome, { x0: -1, z0: -14.5, x1: 19, z1: -3.3 }, 1.25);
  siti.path = [V(3, 0, -9), V(11.5, 0, -9.6), V(8, 0, -6.6), V(11.8, 0, -12.9), V(4.2, 0, -12.9)];
  siti.idlePose = 'sweep';
  siti.idleLines = NPC_LINES.sweep;
  siti.owns = ['sandal'];
  const ujang = new Human('ujang', { skin: 0xb87a4b, shirt: 0x1976d2, pants: 0x37474f, hair: 'short', apron: 0x0d47a1, towel: true, mustache: true, shoes: 0x212121 }, 'adult', pts.ujangA, { x0: 18, z0: 5.5, x1: 62, z1: 39 }, 0.8);
  ujang.path = [pts.ujangA, pts.ujangB, pts.ujangC, pts.ujangD];
  ujang.idleLines = NPC_LINES.sell;
  ujang.owns = ['ikan_pasar'];
  ujang.chaseSpeed = 3.9;
  const tini = new Human('tini', { skin: 0xd9a877, shirt: 0xef5350, pants: 0x6d4c41, skirt: true, hair: 'bun', hairColor: 0x2a1c14 }, 'adult', pts.tini, { x0: 38, z0: 9, x1: 54, z1: 24 }, 1.35);
  tini.yaw = tini.homeYaw = Math.PI;
  tini.range = 7;
  tini.idleLines = [
    { id: 'Sayur! Sayur segar!', en: 'Veggies! Fresh veggies!' },
    { id: 'Tomatnya merah-merah!', en: 'Nice red tomatoes!' },
  ];
  // new edge areas
  const satpam = new Human('satpam', { skin: 0xb87a4b, shirt: 0x37474f, pants: 0x263238, hair: 'peci', mustache: true, shoes: 0x111111 }, 'adult', pts.satpamA, { x0: -86, z0: 4, x1: -58, z1: 18.4 }, 0.9);
  satpam.path = [pts.satpamA, pts.satpamB, pts.satpamC, pts.satpamD];
  satpam.idleLines = [
    { id: 'Aman... aman...', en: 'All clear... all clear...' },
    { id: 'Jangan main di sekolah, ya!', en: 'No playing at the school!' },
  ];
  satpam.owns = [];
  const buWarung = new Human('buwarung', { skin: 0xd9a877, shirt: 0xffb300, pants: 0x5d4037, skirt: true, hair: 'hijab', hijabColor: 0x43a047, shoes: 0x6d4c41 }, 'adult', pts.warungCounter, { x0: -62, z0: -13.5, x1: -50, z1: -4.5 }, 1.3);
  buWarung.yaw = buWarung.homeYaw = -0.6; // watching the counter and the shop front
  buWarung.range = 7;
  buWarung.idleLines = [
    { id: 'Kerupuk! Es krim! Ada semua!', en: 'Crackers! Ice cream! We have it all!' },
    { id: 'Mampir, mampir!', en: 'Come on in!' },
  ];
  buWarung.owns = ['kerupuk'];
  ctx.npcs = [siti, ujang, tini, satpam, buWarung];
  const dimas = new Human('dimas', { skin: 0xc68e5f, shirt: 0xffca28, pants: 0x1e88e5, hair: 'cap', hijabColor: 0xe53935, kid: true }, 'kid', pts.kidA, { x0: -30, z0: 5, x1: 12, z1: 39 }, 1.8);
  const putri = new Human('putri', { skin: 0xe0ac7e, shirt: 0xec407a, pants: 0x7e57c2, skirt: true, hair: 'long', hairColor: 0x3e2723, kid: true }, 'kid', pts.kidB, { x0: -30, z0: 5, x1: 12, z1: 39 }, 2.0);
  ctx.kids = new Kids(dimas, putri);
  ctx.dog = new Dog();
  ctx.flocks = [new Flock(pts.pigeonPark, 6, 'merpati_taman'), new Flock(pts.pigeonRoof, 5, 'merpati_atap'), new Flock(pts.ducks, 5, 'bebek', () => new DuckModel(Math.random() < 0.4 ? 0xc8a165 : 0xfafafa))];
  ctx.butterflies = new Butterflies(pts.butterflies, 5);
  ctx.lisa = new Lisa();
  ctx.npcHear = (x: number, z: number, r: number) => {
    for (const h of ctx.npcs as Human[]) h.hear(x, z, r);
  };

  // ---- systems ----
  ctx.quests = new Quests();
  ctx.progress = new Progress();
  ctx.fishing = new Fishing();
  setupMischief();
  ctx.day = new Day();
  // weather & time of day: ctx.weather = 'cerah' | 'hujan' | 'malam' (see game/weather.ts)
  ctx.weatherSys = new WeatherSystem();
  ctx.weatherNow = weatherNow;
  ctx.rollWeather = rollWeather;
  ctx.decor = new DecorSystem();
  const ui = new UI();
  ctx.ui = ui;
  ctx.photo = new PhotoMode();
  ctx.album = new Album();
  ctx.quests.applyUnlocks(false);

  // ---- events ----
  ctx.onShooed = (h: Human) => {
    ui.toast('💨 ' + tr('shooed'));
    ctx.quests.onEvent('shoo');
    const c = cat.carrying;
    if (c) {
      if (h.owns.includes(c.id) && c.id === 'sandal') {
        const pr = W.props.sandal;
        cat.carrying = null;
        scene.add(pr.obj);
        pr.obj.position.copy(pr.home);
        pr.obj.rotation.copy(pr.homeRot);
        pr.obj.scale.setScalar(1);
      } else dropCarried(true);
    }
  };
  ctx.onHugged = () => {
    ui.toast('💕 ' + tr('hugged'));
    ctx.quests.onEvent('hug');
  };
  ctx.onSpotted = () => ctx.camRig && (ctx.camRig.shake = 0.15);
  ctx.onMeow = () => {
    const b = cat.body;
    // meow quests: the nearest person within reach counts once
    {
      let who = '', best = 4.5;
      for (const h of [...(ctx.npcs as Human[]), ctx.kids.a, ctx.kids.b] as Human[]) {
        if (!h.active) continue;
        const d = Math.hypot(h.body.x - b.x, h.body.z - b.z);
        if (d < best) (best = d), (who = h.name);
      }
      if (who) ctx.quests.onEvent('meow', 1, who);
    }
    for (const h of ctx.npcs as Human[]) {
      const d = Math.hypot(h.body.x - b.x, h.body.z - b.z);
      if (d < 7 && (h.state === 'patrol' || h.state === 'wait') && Math.random() < 0.6) {
        h.state = 'look';
        h.stateT = 0;
        h.lookAt.set(b.x, 0, b.z);
        h.say(NPC_LINES.meow, 1.6);
      }
    }
    const lp = W.pts.lisa;
    if (Math.hypot(lp.x - b.x, lp.z - b.z) < 6)
      ctx.after(0.5, () => {
        sfx.meow(1.3, 0.25);
        ctx.bubbles.say(ctx.lisa.model.root, L({ id: 'Meong juga!', en: 'Meow too!' }), { ttl: 1.4, y: 1.0, kind: 'emote', key: 'lisameow' });
      });
    ctx.kids.cool = Math.min(ctx.kids.cool, 0.5);
  };

  // ---- timers (game time) ----
  const timers: { t: number; fn: () => void; cut?: boolean; force?: boolean }[] = [];
  ctx.after = (t: number, fn: () => void) => timers.push({ t, fn });
  ctx.cutWait = (t: number, force = false) => new Promise<void>((r) => timers.push({ t, fn: r, cut: true, force }));
  ctx.startDay = () => {
    ui.showScreen(null);
    ctx.day.start();
  };

  // ---- menu cameras ----
  let menuKind = 'title';
  const menuSpot = V(-17.5, 0, -8.3);
  ctx.menuCam = (kind: string) => {
    menuKind = kind;
    ctx.day.running = false;
    ctx.day.mama.active = false;
    ctx.fishing.stop();
    if (cat.carrying) dropCarried(true);
    cat.place(menuSpot, kind === 'title' ? Math.PI : 0);
    cat.setState('cut');
    ctx.catSit = kind === 'title';
    ctx.catEarsDown = false;
    ctx.camRig.override = null;
    ctx.weatherSys.apply('cerah');
    ctx.sky.set(kind === 'title' ? 0.25 : 0.3);
  };
  const menuCamera = (dt: number) => {
    const b = cat.body;
    const portrait = window.innerHeight > window.innerWidth;
    if (menuKind === 'title') {
      const a = Math.sin(ctx.time * 0.25) * 0.55;
      const r = portrait ? 3.6 : 2.9;
      camera.position.set(b.x + Math.sin(a) * r, b.y + 1.15, b.z - Math.cos(a) * r);
      camera.lookAt(b.x - (portrait ? 0 : 0.8 * Math.cos(a)), b.y + (portrait ? 0.2 : 0.8), b.z - (portrait ? 0 : 0.8 * Math.sin(a)));
      // idle cat behaviour on the title screen
      if (Math.random() < dt * 0.15) cat.meow();
    } else {
      const r = portrait ? 2.55 : 2.3;
      camera.position.set(b.x, b.y + (portrait ? 0.95 : 0.75), b.z + r);
      camera.lookAt(b.x + (portrait ? 0 : 0.75), b.y + (portrait ? -0.25 : 0.35), b.z);
      cat.yaw = Math.sin(ctx.time * 0.6) * 0.35;
    }
  };

  // ---- quality / resize ----
  ctx.applyQuality = () => {
    const low = ctx.save.settings.quality === 'low';
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1 : 2));
    const fog = scene.fog as THREE.Fog;
    const rainy = ctx.weather === 'hujan';
    fog.near = (low ? 28 : 45) * (rainy ? 0.6 : 1);
    fog.far = (low ? 75 : 120) * (rainy ? 0.7 : 1);
    camera.far = low ? 90 : 150;
    camera.updateProjectionMatrix();
    resize();
  };
  const resize = () => {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = h > w ? 74 : 62;
    camera.updateProjectionMatrix();
  };
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  ctx.applyQuality();

  setupInput(app);
  // first tap anywhere unlocks audio
  window.addEventListener('pointerdown', () => sfx.unlock(), { once: false, passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && ctx.mode === 'play' && !ctx.paused) ui.pause();
  });

  ui.title();

  // ---- main loop ----
  let last = performance.now();
  const frame = (now: number) => {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.05) dt = 0.05;
    if (dt <= 0) return;
    if (ctx.timeScale) dt *= ctx.timeScale;
    ctx.time += dt;
    input.update(ctx.time);
    if (input.pause && !ctx.photoMode) {
      if (ctx.mode === 'play' && !ctx.paused && !ctx.dialogOpen) ui.pause();
      else if (ctx.paused && ctx.mode === 'play') ui.resume();
    }
    const gdt = ctx.paused ? 0 : dt;
    // timers
    if (gdt > 0 || ctx.skipCut)
      for (let i = timers.length - 1; i >= 0; i--) {
        const tm = timers[i];
        tm.t -= gdt;
        if (ctx.skipCut && tm.cut && !tm.force) tm.t = 0;
        if (tm.t <= 0) {
          timers.splice(i, 1);
          tm.fn();
        }
      }
    if (ctx.skipCut && ctx.day.mama.goal) {
      const g = ctx.day.mama.goal;
      ctx.day.mama.body.x = g.x;
      ctx.day.mama.body.z = g.z;
    }
    if (gdt > 0) {
      cat.update(gdt);
      for (const h of ctx.npcs as Human[]) h.update(gdt);
      ctx.kids.update(gdt);
      ctx.dog.update(gdt);
      for (const f of ctx.flocks) f.update(gdt);
      ctx.butterflies.update(gdt);
      ctx.lisa.update(gdt);
      ctx.progress.update(gdt);
      ctx.props.update(gdt);
      ctx.fishing.update(gdt);
      ctx.interact.update(gdt);
      for (const a of W.anim) a(gdt, ctx.time);
    }
    // phone-friendly: skip drawing far-away critters and edge-area NPCs (fog hides them anyway)
    {
      const cp = camera.position;
      const far2 = 52 * 52;
      for (const f of ctx.flocks as Flock[]) if (f.state === 'ground' && !f.hidden) for (const b of f.birds) b.m.root.visible = (b.x - cp.x) ** 2 + (b.z - cp.z) ** 2 < far2;
      for (const fl of ctx.butterflies.flies) fl.g.visible = ctx.butterflies.state !== 'away' && (fl.g.position.x - cp.x) ** 2 + (fl.g.position.z - cp.z) ** 2 < far2;
      for (const h of [satpam, buWarung]) {
        const v = h.active && (h.body.x - cp.x) ** 2 + (h.body.z - cp.z) ** 2 < far2;
        h.model.root.visible = v;
        h.shadow.visible = v;
      }
    }
    // action button
    if (input.act && ctx.mode === 'play' && !ctx.paused && !ctx.dialogOpen && cat.state === 'free') {
      const cur = ctx.interact.current;
      if (cur) {
        sfx.click();
        cur.act();
      } else {
        cat.doAction('paw', 0.35);
        sfx.swish();
      }
    }
    ctx.day.update(gdt);
    if (ctx.mode === 'play' && !ctx.paused) ctx.quests.tick();
    ctx.fx.update(gdt);
    ctx.weatherSys.update(gdt);
    if (ctx.photoMode) ctx.photo.update(dt);
    else if (ctx.mode === 'menu' && !ctx.camRig.override) menuCamera(dt);
    else ctx.camRig.update(dt, cat);
    const w = window.innerWidth, h = window.innerHeight;
    ctx.bubbles.update(dt, camera, w, h);
    if (ctx.mode === 'play' && !ctx.photoMode) ui.updateAction();
    if (ctx.mode === 'play' && Math.floor(ctx.time * 4) !== Math.floor((ctx.time - dt) * 4)) ui.quest();
    ui.updateDialog(dt);
    input.consume();
    renderer.render(scene, camera);
  };
  requestAnimationFrame(frame);
  // expose for debugging/testing
  (window as any).__cat = ctx;
  ctx.progressApi = { dailyFor, dayBefore, RANKS, GIVERS, genQuest, specialQuest, SPECIAL_ITEMS };
  (window as any).__catDev = { FBY, SPOTS, fishAvailable, genKind };
  void rand;
}


// Wait (briefly) for the embedded font so canvas signs use it too.
const fontsReady = (document as any).fonts?.load ? Promise.race([Promise.all([(document as any).fonts.load('800 48px "Baloo 2"'), (document as any).fonts.load('700 20px "Baloo 2"')]), new Promise((r) => setTimeout(r, 1500))]) : Promise.resolve();
fontsReady.then(boot, boot);

// Renders the cat's head for the app icon (used by tools/icon.mjs).
(window as any).__catHead = (size = 512, bg = '#57b8ff') => {
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setSize(size, size, false);
  r.outputColorSpace = THREE.SRGBColorSpace;
  const sc = new THREE.Scene();
  sc.background = new THREE.Color(bg);
  sc.add(new THREE.HemisphereLight(0xffffff, 0x8899aa, 1.3));
  const d = new THREE.DirectionalLight(0xffffff, 1.4);
  d.position.set(1, 2, 3);
  sc.add(d);
  const m = new CatModel();
  m.setLook({ fur: 'oranye', pattern: 'belang', eyes: 'hijau', head: 'none', face: 'none', neck: 'kalung', back: 'none' });
  m.update(0.016, { speed: 0, air: false, sleep: 0, sit: 0, paw: 0, scratch: false, dig: false, eat: false, earsDown: 0, happy: 0, hugged: false, lookYaw: 0 });
  for (const e of m.eyes) e.scale.y = 1;
  sc.add(m.root);
  const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 20);
  cam.position.set(0.1, 0.76, 1.85);
  cam.lookAt(0, 0.66, 0.3);
  r.render(sc, cam);
  return r.domElement.toDataURL('image/png');
};
