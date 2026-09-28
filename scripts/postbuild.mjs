// Turns Vite's single-file dist/index.html into the release files:
//   dist/cat-simulator.html           one offline file (open it straight in a browser)
//   dist/pwa/                         installable offline app for any HTTPS static host
//   dist/cat-simulator-pwa.zip        the same folder, zipped
//   dist/cat-simulator-artifact.html  variant for a Claude Artifact (no doctype/head/body)
import fs from 'fs';
import { execSync } from 'child_process';
import sharp from 'sharp';

const TITLE = 'Cat Simulator: Sebelum Mama Pulang';
const built = fs.readFileSync('dist/index.html', 'utf8');
const hasIcon = fs.existsSync('assets/icon.png');
const favicon = hasIcon ? 'data:image/png;base64,' + (await sharp('assets/icon.png').resize(64, 64).png().toBuffer()).toString('base64') : '';
const iconTag = favicon ? `<link rel="icon" type="image/png" href="${favicon}">` : '';

// 1) standalone offline file
const standalone = built.replace('<!--PWA-->', iconTag).replace('<!--SW-->', '');
fs.writeFileSync('dist/cat-simulator.html', standalone);

// 2) PWA folder
const dir = 'dist/pwa';
fs.rmSync(dir, { recursive: true, force: true });
fs.mkdirSync(dir, { recursive: true });
const files = ['./', './index.html', './manifest.webmanifest'];
if (hasIcon) {
  const BG = { r: 87, g: 184, b: 255, alpha: 1 };
  await sharp('assets/icon.png').resize(192, 192).png().toFile(`${dir}/icon-192.png`);
  await sharp('assets/icon.png').resize(512, 512).png().toFile(`${dir}/icon-512.png`);
  await sharp('assets/icon.png').resize(180, 180).png().toFile(`${dir}/apple-touch-icon.png`);
  const inner = await sharp('assets/icon.png').resize(400, 400).png().toBuffer();
  await sharp({ create: { width: 512, height: 512, channels: 4, background: BG } }).composite([{ input: inner, left: 56, top: 56 }]).png().toFile(`${dir}/icon-maskable.png`);
  files.push('./icon-192.png', './icon-512.png', './icon-maskable.png', './apple-touch-icon.png');
}
const manifest = {
  name: TITLE,
  short_name: 'Cat Simulator',
  description: 'Game kucing nakal 3D: kabur dari rumah, bikin kekacauan, dan pulang sebelum Mama datang.',
  lang: 'id',
  start_url: './',
  scope: './',
  display: 'fullscreen',
  orientation: 'landscape',
  background_color: '#9fd6ff',
  theme_color: '#57b8ff',
  icons: hasIcon
    ? [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      ]
    : [],
};
fs.writeFileSync(`${dir}/manifest.webmanifest`, JSON.stringify(manifest, null, 2));
const version = 'cs-' + Date.now().toString(36);
fs.writeFileSync(
  `${dir}/sw.js`,
  `const CACHE = '${version}';
const FILES = ${JSON.stringify(files)};
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
// Game page: network-first so a new version shows right away when online;
// falls back to the cache when offline or the network is slow (>4 s).
function fresh(req) {
  const net = fetch(req, { cache: 'no-cache' }).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put('./index.html', copy)); }
    return res;
  });
  const slow = new Promise((ok) => setTimeout(ok, 4000)).then(() => caches.match('./index.html'));
  return Promise.race([net, slow.then((hit) => hit || net)]).catch(() => caches.match('./index.html'));
}
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (e.request.mode === 'navigate' || url.pathname.endsWith('/index.html')) { e.respondWith(fresh(e.request)); return; }
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request)));
});
`,
);
const pwaHead = `${iconTag}
<link rel="manifest" href="manifest.webmanifest">${hasIcon ? '\n<link rel="apple-touch-icon" href="apple-touch-icon.png">' : ''}`;
const sw = `<script>if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(function(){});</script>`;
fs.writeFileSync(`${dir}/index.html`, built.replace('<!--PWA-->', pwaHead).replace('<!--SW-->', sw));
fs.writeFileSync(
  `${dir}/CARA-PASANG.txt`,
  `CAT SIMULATOR: SEBELUM MAMA PULANG — versi aplikasi (PWA)

1. Upload SEMUA file di folder ini ke hosting statis HTTPS (GitHub Pages, Netlify Drop, Cloudflare Pages).
2. Buka alamatnya sekali di HP pakai Chrome (Android) atau Safari (iPhone) selagi ada internet.
3. Android: menu titik tiga > "Tambahkan ke Layar utama" / "Instal aplikasi".
   iPhone: tombol Bagikan > "Tambah ke Layar Utama".
4. Selesai. Game bisa dimainkan tanpa internet, dan progres (koin ikan, baju, koleksi) tersimpan di HP.
`,
);
try {
  fs.rmSync('dist/cat-simulator-pwa.zip');
} catch (e) {}
try {
  execSync(`cd ${dir} && zip -q -r ../cat-simulator-pwa.zip .`);
} catch (e) {
  console.warn('zip not available, skipped');
}

// 3) Claude Artifact variant: the viewer adds its own doctype/head/body
const styles = [...built.matchAll(/<style[^>]*>[\s\S]*?<\/style>/g)].map((m) => m[0].replace(/ rel="stylesheet"| crossorigin/g, '')).join('\n');
const script = built.match(/<script type="module"[^>]*>[\s\S]*?<\/script>/)[0].replace(' crossorigin', '');
fs.writeFileSync('dist/cat-simulator-artifact.html', `<title>${TITLE}</title>\n<meta name="theme-color" content="#57b8ff">\n${styles}\n<div id="app"></div>\n${script}\n`);

const kb = (f) => (fs.statSync(f).size / 1024).toFixed(0) + ' KB';
console.log(`release: cat-simulator.html ${kb('dist/cat-simulator.html')}, artifact ${kb('dist/cat-simulator-artifact.html')}, pwa: ${fs.readdirSync(dir).join(', ')}`);
