// Re-renders assets/icon.png (the blocky cat head) from the built game.
// Needs Chromium:  npx playwright install chromium && npm run build && npm run icon
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 800, height: 600 } });
await page.goto('file://' + path.resolve('dist/cat-simulator.html'));
await page.waitForFunction(() => typeof window.__catHead === 'function', null, { timeout: 60000 });
const url = await page.evaluate(() => window.__catHead(512, '#57b8ff'));
fs.mkdirSync('assets', { recursive: true });
fs.writeFileSync('assets/icon.png', Buffer.from(url.split(',')[1], 'base64'));
await browser.close();
console.log('assets/icon.png updated');
