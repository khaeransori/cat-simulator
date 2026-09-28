// Title -> first-run style screen -> intro cutscene -> walk out of the house.
import { start, check } from './lib.mjs';
const h = await start();
await h.shot('smoke-1-title');
await h.play();
await h.shot('smoke-2-play');
const z0 = await h.ev(() => window.__cat.cat.body.z);
await h.page.keyboard.down('KeyW');
await h.wait(2500);
await h.page.keyboard.up('KeyW');
const z1 = await h.ev(() => window.__cat.cat.body.z);
check('cat walks toward the front door', z1 > z0 + 2, `${z0.toFixed(1)} -> ${z1.toFixed(1)}`);
const calls = await h.ev(() => window.__cat.renderer.info.render.calls);
check('draw calls reasonable', calls < 600, String(calls));
await h.close();
