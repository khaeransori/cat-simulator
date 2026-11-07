// Runs the day with the cat parked far away and logs NPCs that stop moving while they want to walk.
import { start, check } from './lib.mjs';
const h = await start(); await h.play();
const secs = +(process.argv[2] || 60);
await h.ev(() => { window.__cat.day.timeLeft = 1e6; });
const res = await h.page.evaluate(async (secs) => {
  const C = window.__cat; const out = {};
  const W = () => new Promise((r) => setTimeout(r, 250));
  const hist = {};
  const s0 = C.npcs.find((n) => n.name === 'satpam');
  const satpamStart = s0 ? [s0.body.x, s0.body.z] : null;
  let satpamMax = 0;
  const npcs = [...C.npcs, C.kids.a, C.kids.b];
  for (let i = 0; i < secs * 4; i++) {
    await W();
    if (s0) satpamMax = Math.max(satpamMax, Math.hypot(s0.body.x - satpamStart[0], s0.body.z - satpamStart[1]));
    for (const n of npcs) {
      const k = n.name; const b = n.body;
      (hist[k] = hist[k] || []).push([b.x, b.z, n.state, C.time]);
      const hh = hist[k]; if (hh.length < 13) continue;
      const a = hh[hh.length - 13]; // ~3 s ago (wall)
      const moved = Math.hypot(b.x - a[0], b.z - a[1]);
      const wants = (n.state === 'patrol' && n.path.length > 0) || n.state === 'return';
      if (wants && hh.slice(-13).every((p) => p[2] === n.state) && moved < 0.15) {
        out[k] = out[k] || { n: 0, at: [] }; out[k].n++;
        if (out[k].at.length < 3) out[k].at.push([b.x.toFixed(1), b.z.toFixed(1), n.state, n.pathI]);
      }
    }
  }
  return { out, satpamMax, names: C.npcs.map((n) => n.name) };
}, secs);
console.log(JSON.stringify(res));
check('new NPCs present (satpam, buwarung)', res.names.includes('satpam') && res.names.includes('buwarung'), res.names.join(','));
check('Pak Satpam patrols his yard', res.satpamMax > 4, res.satpamMax.toFixed(1));
check('no NPC stuck while walking', Object.keys(res.out).length === 0);
await h.close();
