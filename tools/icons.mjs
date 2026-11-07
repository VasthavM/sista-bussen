/**
 * PWA icon generator.
 *
 *   node tools/icons.mjs
 *
 * Draws the home-screen icon artwork as SVG, rasterises it with the Playwright
 * Chromium that is already a devDependency, and writes the PNG set the manifest
 * and the iOS meta tag point at:
 *
 *   public/icon-192.png            192x192  purpose any
 *   public/icon-512.png            512x512  purpose any
 *   public/icon-maskable-512.png   512x512  purpose maskable (artwork in the 80% safe zone)
 *   public/apple-touch-icon.png    180x180  opaque, for iOS
 *   public/icon.svg                vector favicon, same artwork
 *
 * Artwork: the night bus-stop sign — sodium-amber plate and pole on the game's
 * asphalt value, with a bus pictogram. Drawn for icon scale: one silhouette, no
 * text, no thin strokes, so it survives 60 px on a home screen.
 *
 * Nothing here reaches into src/. If the palette changes, change the values
 * below and re-run.
 */
import { chromium } from '@playwright/test';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const BG = '#0b0e12';
const AMBER = '#f5a524';

/** Full-bleed ground plus the sodium-lamp pool the plate sits in. */
const background = `
  <defs>
    <radialGradient id="lamp" cx="50%" cy="36%" r="62%">
      <stop offset="0%" stop-color="${AMBER}" stop-opacity="0.30"/>
      <stop offset="55%" stop-color="${AMBER}" stop-opacity="0.09"/>
      <stop offset="100%" stop-color="${AMBER}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="vig" cx="50%" cy="50%" r="72%">
      <stop offset="60%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.45"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="${BG}"/>
  <rect width="512" height="512" fill="url(#lamp)"/>`;

/** Plate, pole and base. Amber rim on the pole reads as lamp spill. */
const sign = `
  <rect x="240" y="330" width="32" height="152" fill="#2b3644"/>
  <rect x="240" y="330" width="9" height="152" fill="${AMBER}" opacity="0.7"/>
  <rect x="208" y="458" width="96" height="20" rx="8" fill="#303a46"/>
  <rect x="76" y="52" width="360" height="304" rx="36" fill="${AMBER}"/>
  <rect x="92" y="68" width="328" height="272" rx="28" fill="none" stroke="${BG}" stroke-opacity="0.14" stroke-width="8"/>`;

/**
 * Bus pictogram: one dark mass, amber window band, wheels breaking the bottom
 * edge. Deliberately only five shapes — anything finer turns to mud at 60 px.
 */
const bus = `
  <rect x="136" y="132" width="240" height="152" rx="26" fill="${BG}"/>
  <rect x="158" y="152" width="196" height="50" rx="9" fill="${AMBER}"/>
  <rect x="220" y="152" width="12" height="50" fill="${BG}"/>
  <rect x="282" y="152" width="12" height="50" fill="${BG}"/>
  <circle cx="182" cy="288" r="22" fill="${BG}"/>
  <circle cx="330" cy="288" r="22" fill="${BG}"/>`;

const artwork = `${background}${sign}${bus}<rect width="512" height="512" fill="url(#vig)"/>`;

/**
 * Maskable icons are cropped by the launcher, so the artwork is pulled into the
 * central 80% safe zone while the background still covers the full canvas.
 */
const maskableArtwork = `${background}
  <g transform="translate(256 256) scale(0.74) translate(-256 -256)">${sign}${bus}</g>
  <rect width="512" height="512" fill="url(#vig)"/>`;

const TARGETS = [
  { file: 'public/icon-192.png', size: 192, art: artwork },
  { file: 'public/icon-512.png', size: 512, art: artwork },
  { file: 'public/icon-maskable-512.png', size: 512, art: maskableArtwork },
  { file: 'public/apple-touch-icon.png', size: 180, art: artwork },
];

const page_for = (art, size) => `<!doctype html><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:${BG};overflow:hidden}
  svg{display:block}
</style><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
  <rect width="512" height="512" fill="${BG}"/>${art}</svg>`;

/** Reads width, height, bit depth and colour type straight out of the IHDR chunk. */
function pngHeader(buf) {
  const signature = buf.subarray(0, 8).toString('hex');
  if (signature !== '89504e470d0a1a0a') throw new Error('not a PNG');
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    bitDepth: buf[24],
    colorType: buf[25],
  };
}

await mkdir('public', { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 512, height: 512 }, deviceScaleFactor: 1 });
  for (const target of TARGETS) {
    await page.setViewportSize({ width: target.size, height: target.size });
    await page.setContent(page_for(target.art, target.size), { waitUntil: 'load' });
    await page.screenshot({
      path: target.file,
      clip: { x: 0, y: 0, width: target.size, height: target.size },
    });

    const buf = await readFile(target.file);
    const hdr = pngHeader(buf);
    if (hdr.width !== target.size || hdr.height !== target.size) {
      throw new Error(
        `${target.file}: expected ${target.size}x${target.size}, got ${hdr.width}x${hdr.height}`,
      );
    }
    console.log(
      `wrote ${target.file} ${hdr.width}x${hdr.height} ${(buf.length / 1024).toFixed(1)} kB colourType=${hdr.colorType}`,
    );
  }

  // The same mark as a vector favicon. Only browser tabs read this; the install
  // icons above are the PNG set.
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">${artwork}</svg>\n`;
  await writeFile('public/icon.svg', svg);
  console.log(`wrote public/icon.svg ${(Buffer.byteLength(svg) / 1024).toFixed(1)} kB vector`);

  // Opaque-pixel proof: decode each file back through the browser and look for
  // any alpha below 255. iOS paints transparent pixels black.
  const audit = await browser.newPage();
  const dataUrls = [];
  for (const target of TARGETS) {
    dataUrls.push(`data:image/png;base64,${(await readFile(target.file)).toString('base64')}`);
  }
  const report = await audit.evaluate(async (files) => {
    const out = [];
    for (const file of files) {
      const img = new Image();
      img.src = file;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d');
      g.drawImage(img, 0, 0);
      const data = g.getImageData(0, 0, c.width, c.height).data;
      let minAlpha = 255;
      let transparent = 0;
      for (let i = 3; i < data.length; i += 4) {
        if (data[i] < minAlpha) minAlpha = data[i];
        if (data[i] < 255) transparent++;
      }
      out.push({ file, w: c.width, h: c.height, minAlpha, transparent });
    }
    return out;
  }, dataUrls);
  for (const [i, row] of report.entries()) {
    console.log(
      `audit ${TARGETS[i].file} ${row.w}x${row.h} minAlpha=${row.minAlpha} translucentPx=${row.transparent}`,
    );
  }
} finally {
  await browser.close();
}
