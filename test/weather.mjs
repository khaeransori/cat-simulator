// Weather & time of day: force each day type and check the scene state.
import { start, check } from './lib.mjs';

const h = await start();
const quality = process.env.Q || 'high';
await h.ev((q) => (window.__cat.save.settings.quality = q, window.__cat.applyQuality()), quality);

// next day with a forced weather (skips the intro cutscene)
async function day(w, opts = {}) {
  await h.ev((w) => {
    const c = window.__cat;
    c.forceWeather = w;
    if (c.day.running) c.day.running = false;
    c.ui.showScreen(null);
    c.startDay();
  }, w);
  for (let i = 0; i < 40; i++) {
    if (await h.ev(() => window.__cat.mode === 'play')) break;
    const sk = await h.page.$('#skipBtn:not([hidden])');
    if (sk) await sk.click().catch(() => {});
    await h.dialogs(2);
    await h.wait(400);
  }
  try {
    await h.page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 });
  } catch (e) {
    await h.shot('weather-stuck');
    console.log('stuck', await h.ev(() => ({ mode: window.__cat.mode, dlg: !document.getElementById('dialog').hidden, modal: !document.getElementById('modal').hidden, skip: !document.getElementById('skipBtn').hidden })));
    throw e;
  }
  await h.ev(() => (window.__cat.timeScale = 3));
  if (!opts.keepTime) await h.ev(() => (window.__cat.day.timeLeft = window.__cat.day.len * 0.45));
}

const state = () =>
  h.ev(() => {
    const c = window.__cat, W = c.weatherSys;
    return {
      weather: c.weather,
      dayW: c.day.weather,
      rain: W.rain.visible,
      puddles: W.puddles.visible,
      stars: W.stars.visible,
      flies: W.flies.visible,
      windows: W.windows.visible,
      kidsVisible: c.kids.a.model.root.visible || c.kids.b.model.root.visible,
      ball: c.kids.ball.visible,
      pigeons: c.flocks[0].birds.some((b) => b.m.root.visible),
      umbrellas: c.npcs.filter((n) => n.model.umbrella?.visible).length,
      adults: c.npcs.length,
      sitiActive: c.npcs.find((n) => n.name === 'siti').active,
      icon: document.getElementById('daySun').textContent,
      bg: '#' + c.scene.background.getHexString(),
      hearK: c.npcs[1].hearK,
      amb: c.save && window.__cat.weatherSys.kind,
    };
  });

await h.play();
const d1 = await state();
check('day 1 is always sunny', d1.weather === 'cerah' && d1.icon === '☀️', JSON.stringify({ w: d1.weather, icon: d1.icon }));
check('day 1: kids + pigeons out, no rain', d1.kidsVisible && d1.pigeons && !d1.rain && !d1.stars);

// ---- cerah ----
await day('cerah');
await h.tp(-6, 0, 2.5, 0.6, 1200);
await h.shot('weather-cerah');

// ---- hujan ----
await day('hujan');
let s = await state();
check('hujan: ctx.weather + day bar icon', s.weather === 'hujan' && s.icon === '🌧️', s.icon);
check('hujan: rain hidden indoors at home', !s.rain && s.puddles, JSON.stringify({ rain: s.rain, puddles: s.puddles }));
check('hujan: kids indoors, ball hidden', !s.kidsVisible && !s.ball);
check('hujan: pigeons hidden', !s.pigeons);
check('hujan: adults carry umbrellas', s.umbrellas === s.adults, `${s.umbrellas}/${s.adults}`);
check('hujan: darker sky', s.bg !== d1.bg, s.bg);
const spd = await h.ev(() => window.__cat.npcs.map((n) => n.speed.toFixed(2)).join(','));
check('hujan: adults walk slower', Number(spd.split(',')[0]) < 1.7, spd);
// ball mischief unavailable
const bola = await h.ev(() => window.__cat.kids.ballGrabbable());
check('hujan: no ball game', !bola);
// fishing: shorter waits + more lele
const fish = await h.ev(() => {
  const c = window.__cat, F = c.fishing;
  let wsum = 0, lele = 0;
  for (let i = 0; i < 400; i++) {
    F.beginWait();
    wsum += F.waitFor;
    if (F.pickFish().id === 'lele') lele++;
  }
  c.ui.fishing(false);
  return { wait: wsum / 400, lele: lele / 400 };
});
check('hujan: fish bite faster', fish.wait < 2.0, fish.wait.toFixed(2));
check('hujan: more lele', fish.lele > 0.22, fish.lele.toFixed(2));
// walk through a puddle on the street -> splash, cat gets wet outside
await h.tp(-6, 0, 2.5, 0.6, 600);
s = await state();
check('hujan: rain visible outdoors', s.rain && s.puddles, JSON.stringify({ rain: s.rain, puddles: s.puddles }));
// no random traffic here: exhaust puffs share the fx pool and a car could block the cat
await h.ev(() => { const T = window.__cat.traffic; if (T) { for (const v of T.vehicles) v.dispose(); T.vehicles = []; T.spawnT = 999; } });
await h.tp(-25, 0.0, 1.4, Math.PI / 2, 300);
const parts0 = await h.ev(() => window.__cat.fx.parts.length);
await h.page.keyboard.down('KeyW');
// game time, not wall time: on a busy server 700 ms wall can be only a few frames
const tw0 = await h.ev(() => window.__cat.time);
let parts1 = parts0;
for (let i = 0; i < 40 && parts1 <= parts0; i++) {
  await h.wait(100);
  parts1 = await h.ev(() => window.__cat.fx.parts.length);
  if ((await h.ev(() => window.__cat.time)) - tw0 > 1.5) break;
}
await h.page.keyboard.up('KeyW');
check('hujan: puddle splash fx', parts1 > parts0, `${parts0} -> ${parts1}`);
await h.tp(-6, 0, 2.5, 0.6, 4000);
const wet = await h.ev(() => window.__cat.weatherSys.wet);
check('hujan: cat gets wet outside', wet > 0.1, wet.toFixed(2));
await h.shot('weather-hujan');
await h.tp(-1.5, 0, 10.5, Math.PI * 0.95, 1000);
await h.shot('weather-hujan-park');
await h.tp(-16, 0, -15.5, 0, 4000);
const dry = await h.ev(() => window.__cat.weatherSys.wet);
check('hujan: cat dries at home', dry < wet, `${wet.toFixed(2)} -> ${dry.toFixed(2)}`);

// ---- malam ----
await day('malam');
s = await state();
check('malam: ctx.weather + day bar icon', s.weather === 'malam' && s.icon === '🌙', s.icon);
check('malam: stars, fireflies, glowing windows', s.stars && s.flies && s.windows);
check('malam: no rain', !s.rain && !s.puddles);
check('malam: kids inside, Bu Siti asleep', !s.kidsVisible && !s.sitiActive);
check('malam: smaller hearing radius', s.hearK < 1, String(s.hearK));
const lum = await h.ev(() => {
  const c = window.__cat.scene.background;
  return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
});
check('malam: sky not pitch black', lum > 0.02, lum.toFixed(3));
await h.tp(-6, 0, 2.5, 0.6, 1200);
await h.shot('weather-malam');
await h.tp(-1.5, 0, 10.5, Math.PI * 0.95, 1000);
await h.shot('weather-malam-park');
// cerah resets everything
await day('cerah');
s = await state();
check('cerah after malam: all back', !s.rain && !s.stars && !s.flies && s.kidsVisible && s.sitiActive && s.umbrellas === 0 && s.hearK === 1);

// end of a night day: summary shows the day type
await day('malam', { keepTime: true });
await h.ev(() => void window.__cat.day.end(true));
for (let i = 0; i < 120 && (await h.ev(() => window.__cat.mode)) !== 'summary'; i++) {
  await h.dialogs(2);
  await h.wait(500);
}
const sum = await h.ev(() => document.getElementById('sumWx')?.textContent || '');
check('summary shows the day type', sum.includes('🌙'), sum);
await h.shot('weather-summary');

// ---- settings: "Selalu cerah" forces sunny ----
await h.ev(() => (window.__cat.save.settings.weather = 'cerah'));
await day('hujan');
s = await state();
check("setting 'Selalu cerah' forces cerah", s.weather === 'cerah' && !s.rain, s.weather);
await h.ev(() => {
  const c = window.__cat;
  c.save.settings.weather = 'acak';
  c.forceWeather = undefined;
});
// random roll distribution (after the first sunny days)
const dist = await h.ev(() => {
  const n = { cerah: 0, hujan: 0, malam: 0 };
  for (let i = 0; i < 2000; i++) n[window.__cat.rollWeather(10)]++;
  return n;
});
check('random roll ~65/20/15', dist.cerah > 1100 && dist.hujan > 250 && dist.malam > 180, JSON.stringify(dist));
const guarded = await h.ev(() => {
  const s = window.__cat.save;
  const keep = JSON.stringify(s.daily.list);
  s.daily.list = [{ q: { type: 'event', ev: 'hug', goal: 1 }, stage: 'active', prog: {} }];
  const n = { cerah: 0, hujan: 0, malam: 0 };
  for (let i = 0; i < 300; i++) n[window.__cat.rollWeather(10)]++;
  s.daily.list = JSON.parse(keep);
  return n;
});
check('active hug challenge keeps days sunny', guarded.hujan === 0 && guarded.malam === 0, JSON.stringify(guarded));
const early = await h.ev(() => [1, 2, 3].map((n) => window.__cat.rollWeather(n)).join(','));
check('first days always sunny', early === 'cerah,cerah,cerah', early);
// old save without weather keys still loads with defaults
await h.ev(() => {
  localStorage.setItem('cat-sim-sebelum-mama-pulang-v1', JSON.stringify({ v: 1, name: 'Lama', day: 4, settings: { lang: 'id', music: 0.5 } }));
  Storage.prototype.setItem = () => {}; // stop autosaves overwriting the seeded save (until reload)
});
await h.page.reload();
await h.page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
const ld = await h.ev(() => ({ w: window.__cat.save.settings.weather, seen: typeof window.__cat.save.weatherSeen, name: window.__cat.save.name }));
check('old save loads with weather defaults', ld.w === 'acak' && ld.seen === 'object' && ld.name === 'Lama', JSON.stringify(ld));
await h.close();
