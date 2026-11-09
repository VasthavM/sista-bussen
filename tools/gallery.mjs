/**
 * Sprite gallery evidence shot.
 *
 *   node tools/gallery.mjs
 *
 * Serves tools/gallery.html through the project's own Vite config, renders
 * every zombie, the three playable characters, the bus, the fuel can and the
 * pickup icons at in-game scale and at 2x on the real asphalt value, plus the
 * telegraph and hit-flash variants, and writes screenshots/06-gallery.png.
 * GALLERY_PORT overrides the dev-server port (default 5179).
 */
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const PORT = Number(process.env.GALLERY_PORT ?? 5179);
const OUT = 'screenshots/06-gallery.png';

const server = await createServer({
  configFile: 'vite.config.ts',
  server: { port: PORT, strictPort: true, host: '127.0.0.1' },
  logLevel: 'warn',
});
await server.listen();

const url = `http://127.0.0.1:${PORT}/tools/gallery.html`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1760, height: 1060 }, deviceScaleFactor: 1 });
  page.on('pageerror', (err) => console.error('PAGEERROR', err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') console.error('CONSOLE', msg.text());
  });
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__galleryReady === true, null, { timeout: 30_000 });
  await mkdir('screenshots', { recursive: true });
  const canvas = page.locator('#gallery');
  await canvas.screenshot({ path: OUT });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
  await server.close();
}