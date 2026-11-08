import { chromium, devices } from '@playwright/test';
const H = process.env.H;
const b = await chromium.launch();
const ctx = await b.newContext({ ...devices['iPhone 13'] });
const p = await ctx.newPage();
const errors = [], failed = [];
p.on('console', m => { if (m.type() === 'error') errors.push(m.text().slice(0, 200)); });
p.on('requestfailed', r => failed.push(r.url().replace(H, '') + ' :: ' + r.failure()?.errorText));
p.on('response', r => { if (r.status() >= 400) failed.push(r.status() + ' ' + r.url().replace(H, '')); });
await p.goto('https://' + H + '/', { waitUntil: 'load', timeout: 45000 });
await p.waitForTimeout(3500);
const canvas = await p.evaluate(() => {
  const c = document.querySelector('canvas');
  if (!c) return { present: false };
  const g = c.getContext('2d');
  const d = g.getImageData(0, 0, c.width, c.height).data;
  let nonBlack = 0;
  for (let i = 0; i < d.length; i += 4000) if (d[i] > 12 || d[i+1] > 12 || d[i+2] > 12) nonBlack++;
  return { present: true, w: c.width, h: c.height, sampledNonBlack: nonBlack };
});
const sw = await p.evaluate(async () => {
  if (!('serviceWorker' in navigator)) return 'unsupported';
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? (reg.active ? 'active' : reg.installing ? 'installing' : 'registered-no-active') : 'not-registered';
});
await p.screenshot({ path: '/tmp/sista-live.png' });
const title = await p.title();
await b.close();
console.log(JSON.stringify({ title, canvas, sw, errors, failed }, null, 2));
