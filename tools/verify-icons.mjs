/**
 * Throwaway install check: manifest parses, every declared icon serves as
 * image/png with the declared pixel size, index.html points iOS at the PNG.
 *   node tools/_verify-icons.mjs http://127.0.0.1:4179
 */
import { chromium, request } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4173';
const ctx = await request.newContext({ baseURL: base });
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`FAIL ${msg}`);
};

const manRes = await ctx.get('/manifest.webmanifest');
const manText = await manRes.text();
console.log(`manifest ${manRes.status()} ${manRes.headers()['content-type']}`);
let manifest;
try {
  manifest = JSON.parse(manText);
} catch {
  fail('manifest is not valid JSON');
}

for (const icon of manifest?.icons ?? []) {
  const res = await ctx.get(new URL(icon.src, `${base}/`).pathname);
  const type = res.headers()['content-type'] ?? '';
  const body = await res.body();
  const sig = body.subarray(0, 8).toString('hex');
  const isPng = sig === '89504e470d0a1a0a';
  const w = isPng ? body.readUInt32BE(16) : 0;
  const h = isPng ? body.readUInt32BE(20) : 0;
  const [declaredW, declaredH] = (icon.sizes ?? '').split('x').map(Number);
  console.log(
    `icon ${icon.src} status=${res.status()} type=${type} bytes=${body.length} ` +
      `pixels=${w}x${h} declared=${icon.sizes} purpose=${icon.purpose}`,
  );
  if (res.status() !== 200) fail(`${icon.src} not 200`);
  if (type !== 'image/png') fail(`${icon.src} content-type ${type}`);
  if (!isPng) fail(`${icon.src} has no PNG signature`);
  if (w !== declaredW || h !== declaredH) fail(`${icon.src} ${w}x${h} != declared ${icon.sizes}`);
}

const html = await (await ctx.get('/')).text();
const appleHref = html.match(/<link[^>]+rel="apple-touch-icon"[^>]*>/)?.[0] ?? '';
const appleSizes = /sizes="180x180"/.test(appleHref);
const applePng = /href="\.\/apple-touch-icon\.png"/.test(appleHref);
const appTitle = /<meta name="apple-mobile-web-app-title" content="Sista Bussen"/.test(html);
const standalone = /apple-mobile-web-app-capable" content="yes"/.test(html);
console.log(`index apple-touch-icon: ${appleHref.trim()}`);
console.log(`index apple-mobile-web-app-title: ${appTitle} standalone: ${standalone}`);
if (!applePng || !appleSizes) fail('apple-touch-icon link is not ./apple-touch-icon.png sizes=180x180');
if (!appTitle) fail('apple-mobile-web-app-title missing');

const apple = await ctx.get('/apple-touch-icon.png');
const appleBody = await apple.body();
const aw = appleBody.readUInt32BE(16);
const ah = appleBody.readUInt32BE(20);
console.log(
  `apple-touch-icon status=${apple.status()} type=${apple.headers()['content-type']} pixels=${aw}x${ah} colourType=${appleBody[25]}`,
);
if (apple.status() !== 200 || aw !== 180 || ah !== 180) fail('apple-touch-icon not a 180x180 PNG');

const sw = await (await ctx.get('/sw.js')).text();
for (const needed of ['icon-192.png', 'icon-512.png', 'icon-maskable-512.png', 'apple-touch-icon.png', 'manifest.webmanifest']) {
  if (!sw.includes(needed)) fail(`sw.js does not precache ${needed}`);
}
console.log(`sw cache name: ${sw.match(/CACHE = '([^']+)'/)?.[1]}`);

// Real-browser pass: the manifest must parse as a manifest, the icons must
// decode, and the maskable artwork must sit inside the 80% safe zone.
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(`${base}/`, { waitUntil: 'load' });
  const inBrowser = await page.evaluate(async () => {
    const href = document.querySelector('link[rel="manifest"]').href;
    const man = await (await fetch(href)).json();
    const decoded = [];
    for (const icon of man.icons) {
      const img = new Image();
      img.src = new URL(icon.src, location.href).href;
      await img.decode();
      decoded.push({ src: icon.src, w: img.naturalWidth, h: img.naturalHeight });
    }
    // Maskable safe zone: bounding box of the amber artwork, which is far
    // brighter than the dark ground.
    const img = new Image();
    img.src = new URL('./icon-maskable-512.png', location.href).href;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    const g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
    for (let y = 0; y < c.height; y++) {
      for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i] > 140 && d[i + 1] > 90) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    return { name: man.name, icons: decoded, bbox: { minX, minY, maxX, maxY, size: c.width } };
  });
  console.log(`browser manifest name=${inBrowser.name} icons=${inBrowser.icons.map((i) => `${i.w}x${i.h}`).join(',')}`);
  const { bbox } = inBrowser;
  const pad = (bbox.size * 0.1) | 0;
  console.log(
    `maskable amber bbox x=${bbox.minX}..${bbox.maxX} y=${bbox.minY}..${bbox.maxY} (safe zone ${pad}..${bbox.size - pad})`,
  );
  if (bbox.minX < pad || bbox.minY < pad || bbox.maxX > bbox.size - pad || bbox.maxY > bbox.size - pad) {
    fail('maskable artwork leaves the central 80% safe zone');
  }

  // The installed app must find the icons in its own cache, not the network.
  await page.evaluate(async () => {
    await navigator.serviceWorker.register('./sw.js');
    await navigator.serviceWorker.ready;
  });
  const cached = await page.evaluate(async () => {
    const keys = await caches.keys();
    const out = {};
    for (const key of keys) {
      const cache = await caches.open(key);
      out[key] = (await cache.keys()).map((r) => new URL(r.url).pathname);
    }
    return out;
  });
  console.log('sw caches', JSON.stringify(cached));
  const all = Object.values(cached).flat();
  for (const needed of [
    '/icon-192.png',
    '/icon-512.png',
    '/icon-maskable-512.png',
    '/apple-touch-icon.png',
    '/manifest.webmanifest',
  ]) {
    if (!all.includes(needed)) fail(`installed cache is missing ${needed}`);
  }
} finally {
  await browser.close();
}

await ctx.dispose();
console.log(failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);