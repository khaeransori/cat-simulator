// Mockup match: the approved Indonesian Blocky people lineup (scratch/lowpoly/chars/indo.ts)
// rebuilt with the GAME's people models, same spacing + same cameras.
// Compare test/shots/peoplemock-*.png with the mockup's indo-lineup.png / indo-left.png / indo-right.png.
import { start, check } from './lib.mjs';
const h = await start({ viewport: { width: 900, height: 420 } });
await h.play();
await h.ev(() => (window.__cat.timeScale = 1));
const gw = (ms) => h.wait(ms);
// mockup order (Pak Haji is in the mockup but is not a game character: built from the same outfit)
const X0 = 0, Z0 = 26; // open park lawn; mockup z 1.5 -> game Z0
const n = await h.ev(([X0, Z0]) => {
  const c = window.__cat;
  const ppl = [c.day.mama, c.npcs.find((p) => p.name === 'siti'), c.npcs.find((p) => p.name === 'ujang'), c.npcs.find((p) => p.name === 'tini'), c.npcs.find((p) => p.name === 'satpam'), c.npcs.find((p) => p.name === 'buwarung'), c.npcs.find((p) => p.name === 'mandor'), null, c.kids.a, c.kids.b];
  c.kids.away = true;
  const sp = 1.42, x0 = -((ppl.length - 1) * sp) / 2;
  for (const p of [...c.npcs, c.day.mama, c.kids.a, c.kids.b]) { p.active = false; p.model.root.visible = false; }
  ppl.forEach((p, i) => {
    if (!p) return;
    p.active = true;
    p.state = 'script'; p.goal = null; p.model.root.visible = true;
    p.body.x = X0 + x0 + i * sp; p.body.z = Z0; p.body.y = 0; p.yaw = 0;
    p.model.root.position.set(p.body.x, 0, p.body.z); p.model.root.rotation.y = 0;
    p.shadow?.position.set(p.body.x, 0.02, p.body.z);
    p.model.pose?.('idle', 0.3 + i * 0.17);
  });
  const b = c.cat.body; b.x = X0; b.z = Z0 - 12; b.y = 0;
  c.paused = true; // freeze AI so nobody walks off the mark (render keeps running)
  for (const el of document.querySelectorAll('.toast, .weather-card, .hint')) el.remove();
  return ppl.filter(Boolean).length;
}, [X0, Z0]);
const V = {
  lineup: [[0, 2.0, 11.8], [0, 0.85, 1.5], 40],
  left: [[-4.3, 1.4, 6.6], [-4.3, 0.9, 1.5], 34],
  right: [[3.6, 1.4, 6.6], [3.6, 0.9, 1.5], 34],
};
for (const [name, [p, l, fov]] of Object.entries(V)) {
  await h.ev(([p, l, fov, X0, Z0]) => {
    const C = window.__cat, V3 = C.camera.position.constructor;
    C.camera.fov = fov; C.camera.updateProjectionMatrix();
    C.camRig.override = { pos: new V3(X0 + p[0], p[1], p[2] - 1.5 + Z0), look: new V3(X0 + l[0], l[1], l[2] - 1.5 + Z0) };
    C.camRig.update(0, C.cat, true);
  }, [p, l, fov, X0, Z0]);
  await gw(500);
  await h.shot('peoplemock-' + name);
}
check('9 game people in the mockup lineup', n === 9, String(n));
await h.close();
