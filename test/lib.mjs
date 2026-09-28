// Shared helpers for the browser tests. Needs Chromium: npx playwright install chromium
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

export const OUT = 'test/shots/';
fs.mkdirSync(OUT, { recursive: true });

export async function start(opts = {}) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const page = await browser.newPage({ viewport: opts.viewport || { width: 844, height: 390 }, locale: opts.locale || 'id-ID', hasTouch: !!opts.touch, isMobile: !!opts.touch });
  const errs = [];
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  page.on('pageerror', (e) => errs.push('PAGEERROR: ' + e.message));
  await page.goto('file://' + path.resolve('dist/cat-simulator.html'));
  await page.waitForFunction(() => !!window.__cat?.ui, null, { timeout: 60000 });
  const h = {
    page,
    errs,
    shot: (n) => page.screenshot({ path: OUT + n + '.png' }),
    wait: (t) => page.waitForTimeout(t),
    ev: (fn, arg) => page.evaluate(fn, arg),
    async dialogs(n = 10) {
      for (let i = 0; i < n; i++) {
        const d = await page.$('#dialog:not([hidden])');
        if (!d) break;
        await d.click();
        await page.waitForTimeout(250);
      }
    },
    async play() {
      await page.click('#mPlay');
      await page.waitForTimeout(400);
      const sd = await page.$('#styleDone');
      if (sd) {
        await sd.click();
        await page.waitForTimeout(400);
      }
      const sk = await page.$('#skipBtn:not([hidden])');
      if (sk) await sk.click();
      await page.waitForTimeout(700);
      await h.dialogs();
      await page.waitForFunction(() => window.__cat.mode === 'play', null, { timeout: 30000 });
      await page.evaluate(() => (window.__cat.timeScale = 3)); // headless GL is slow
    },
    // teleport the cat, returns the nearest interactable id
    async tp(x, y, z, yaw, wait = 500) {
      await page.evaluate(([x, y, z, yaw]) => {
        const c = window.__cat, b = c.cat.body;
        b.x = x; b.y = y; b.z = z; b.vx = b.vz = b.vy = 0;
        c.cat.yaw = yaw; c.cat.setState('free'); c.camRig.yaw = yaw; c.camRig.snap(c.cat);
      }, [x, y, z, yaw]);
      await page.waitForTimeout(wait);
      return page.evaluate(() => window.__cat.interact.current?.id);
    },
    async key(k, wait = 800) {
      await page.keyboard.press(k);
      await page.waitForTimeout(wait);
    },
    done: () => page.evaluate(() => [...window.__cat.day.doneToday]),
    async close() {
      await browser.close();
      if (errs.length) {
        console.log('ERRORS:\n' + errs.join('\n'));
        process.exitCode = 1;
      }
    },
  };
  return h;
}

export function check(label, ok, extra = '') {
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${extra ? '  ' + extra : ''}`);
  if (!ok) process.exitCode = 1;
}
