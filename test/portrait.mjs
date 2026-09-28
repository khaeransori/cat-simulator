// Portrait phone with touch: joystick, camera drag, jump button.
import { start, check } from './lib.mjs';
const h = await start({ viewport: { width: 390, height: 780 }, touch: true });
await h.play();
const z0 = await h.ev(() => window.__cat.cat.body.z);
await h.ev(() => {
  const ev = (t, x, y) => new PointerEvent(t, { pointerId: 7, pointerType: 'touch', clientX: x, clientY: y, bubbles: true });
  document.getElementById('joyZone').dispatchEvent(ev('pointerdown', 90, 640));
  window.dispatchEvent(ev('pointermove', 90, 580));
  window.__up = () => window.dispatchEvent(ev('pointerup', 90, 580));
});
await h.wait(1500);
await h.ev(() => window.__up());
const z1 = await h.ev(() => window.__cat.cat.body.z);
check('joystick moves the cat', z1 > z0 + 1, `${z0.toFixed(1)} -> ${z1.toFixed(1)}`);
const y0 = await h.ev(() => window.__cat.camRig.yaw);
await h.ev(() => {
  const ev = (t, x) => new PointerEvent(t, { pointerId: 9, pointerType: 'touch', clientX: x, clientY: 300, bubbles: true });
  document.getElementById('camZone').dispatchEvent(ev('pointerdown', 300));
  window.dispatchEvent(ev('pointermove', 360));
  window.dispatchEvent(ev('pointerup', 360));
});
await h.wait(200);
check('camera drag turns the view', Math.abs((await h.ev(() => window.__cat.camRig.yaw)) - y0) > 0.2);
await h.ev(() => document.getElementById('btnJump').dispatchEvent(new PointerEvent('pointerdown', { pointerId: 11, pointerType: 'touch', bubbles: true })));
await h.wait(120);
check('jump button', (await h.ev(() => window.__cat.cat.body.y)) > 0.05);
await h.shot('portrait');
await h.close();
