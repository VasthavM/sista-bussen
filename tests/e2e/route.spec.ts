/**
 * v2 route loop (#16): START opens the route screen, a stop starts a map, extraction returns to the
 * route one stop further, death falls back to the checkpoint. Screenshots at 375x667 are the visual
 * evidence for the route screen, the HUD with the bus arrow and both summaries.
 */
import { expect, test, type Page } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';
import { generateSegment } from '../../src/meta/route';
import { SAVE_KEY, SAVE_VERSION } from '../../src/meta/save';
import { REWARDED_ONBOARDING_FREE_MINUTES } from '../../src/monetize/catalog';

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

const SIZE = { width: 375, height: 667 };
const ROUTE_SEED = 20261110;

const state = (page: Page) => page.evaluate(() => window.__game!.getState());
const profile = (page: Page) => page.evaluate(() => window.__game!.profile());

/** Seed a save before the game boots. Only the first load of the test applies it. */
async function seed(page: Page, save: Record<string, unknown>): Promise<void> {
  await page.addInitScript(
    ({ key, data }) => {
      if (!sessionStorage.getItem('route-spec-seeded')) {
        localStorage.setItem(key, JSON.stringify(data));
        localStorage.setItem('sista-bussen.intro.v1', '1');
        sessionStorage.setItem('route-spec-seeded', '1');
      }
    },
    { key: SAVE_KEY, data: { version: SAVE_VERSION, routeSeed: ROUTE_SEED, ...save } },
  );
}

async function openRoute(page: Page): Promise<void> {
  await page.setViewportSize(SIZE);
  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  await page.waitForTimeout(350);
  await page.locator('[data-action="start"]').click();
  await expect(page.locator('[data-screen="route"]')).toBeVisible();
  await page.waitForTimeout(350);
}

/** Play (clearing level-up cards) until the map has paid at least one scrap, so the summaries show real numbers. */
async function earnScrap(page: Page): Promise<void> {
  const deadline = Date.now() + 40_000;
  while (Date.now() < deadline) {
    const s = await state(page);
    if (s.materials.scrap >= 3 && s.phase === 'run') return;
    if (s.phase === 'levelup') await page.locator('.cards .card').first().click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(150);
  }
  throw new Error('no scrap earned within 40s');
}

const playable = (page: Page) => page.locator('.stop:not([data-stop="safe"])');

test('start, route screen, pick a stop, extract, route at stop 2', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await seed(page, { playtimeSeconds: REWARDED_ONBOARDING_FREE_MINUTES * 60 });
  await openRoute(page);

  // Route screen: position, banked materials, 2-4 cards, all inside the viewport without scrolling.
  await expect(page.locator('[data-route="stop"]')).toHaveText('Stop 1 / 10');
  await expect(page.locator('[data-route="materials"] [data-material]')).toHaveCount(3);
  const cards = page.locator('.stop');
  const count = await cards.count();
  expect(count).toBeGreaterThanOrEqual(2);
  expect(count).toBeLessThanOrEqual(4);
  for (let i = 0; i < count; i++) {
    const box = (await cards.nth(i).boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(SIZE.width);
    expect(box.y + box.height).toBeLessThanOrEqual(SIZE.height);
    expect(box.height).toBeGreaterThanOrEqual(44);
    await expect(cards.nth(i).locator('.stop__tile svg')).toHaveCount(1);
    await expect(cards.nth(i).locator('.stop__name')).not.toBeEmpty();
  }
  await expect(page.locator('.route__options')).toHaveJSProperty('scrollTop', 0);
  const scrolls = await page.locator('.route__options').evaluate((n) => n.scrollHeight > n.clientHeight + 1);
  expect(scrolls).toBe(false);
  await page.screenshot({ path: 'screenshots/route-375x667.png' });

  // One tap starts the map.
  await playable(page).first().click();
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  const run = await state(page);
  expect(run.depth).toBe(1);
  expect(run.fuelQuota).toBeGreaterThan(0);
  await expect(page.locator('[data-hud="fuel"]')).toHaveText(`0 / ${run.fuelQuota}`);
  await expect(page.locator('[data-hud="timer"]')).toBeVisible();
  await expect(page.locator('[data-hud="materials"] [data-material]')).toHaveCount(3);
  await expect(page.locator('[data-hud="goal"]')).toBeHidden();
  await earnScrap(page);
  await page.screenshot({ path: 'screenshots/hud-375x667.png' });

  // Quota met, then the bus: the real extraction path through the sim.
  const before = await profile(page);
  await page.evaluate(() => window.__game!.completeObjective());
  await expect.poll(async () => (await state(page)).phase).toBe('summary');
  const summary = page.locator('.summary');
  await expect(summary).toContainText('Extracted');
  await expect(summary).toContainText('Next up: stop 2 / 10');
  await expect(summary.locator('[data-summary="materials"]')).toContainText('Gained');
  const after = await profile(page);
  expect(after.route.depth).toBe(2);
  const gained = (await state(page)).materials;
  expect(after.materials.scrap - before.materials.scrap).toBe(gained.scrap);
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'screenshots/summary-extracted-375x667.png' });

  // Double materials (past the ad gate): banks a second copy of the haul.
  const offer = summary.locator('.summary__offers button');
  await expect(offer).toHaveCount(1);
  await offer.click();
  await expect(summary.locator('[data-summary="materials"]')).toContainText('doubled', { timeout: 20_000 });
  const doubled = await profile(page);
  expect(doubled.materials.scrap - before.materials.scrap).toBe(gained.scrap * 2);
  expect(doubled.materials.parts - before.materials.parts).toBe(gained.parts * 2);

  // CONTINUE returns to the route screen, one stop further, with the bank shown.
  await summary.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(page.locator('[data-screen="route"]')).toBeVisible();
  await expect(page.locator('[data-route="stop"]')).toHaveText('Stop 2 / 10');
  await expect(page.locator('[data-route="materials"] [data-material="scrap"]')).toContainText(String(doubled.materials.scrap));
  expect((await state(page)).phase).toBe('route');
  expect(errors).toEqual([]);
});

test('the bus arrow appears when the quota is met and the bus is off screen', async ({ page }) => {
  await seed(page, {});
  await openRoute(page);
  await playable(page).first().click();
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  await expect(page.locator('[data-hud="bus-arrow"]')).toBeHidden();
  // Quota only, no teleport: the bus starts far from the player.
  await page.evaluate(() => window.__game!.meetQuota());
  await expect(page.locator('[data-hud="goal"]')).toBeVisible();
  await expect(page.locator('[data-hud="goal"]')).toContainText('All aboard: get to the bus');
  await expect(page.locator('[data-hud="bus-arrow"]')).toBeVisible();
  const arrow = (await page.locator('[data-hud="bus-arrow"]').boundingBox())!;
  expect(arrow.x).toBeGreaterThanOrEqual(0);
  expect(arrow.x + arrow.width).toBeLessThanOrEqual(SIZE.width);
  expect(arrow.y).toBeGreaterThanOrEqual(0);
  expect(arrow.y + arrow.height).toBeLessThanOrEqual(SIZE.height);
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/hud-arrow-375x667.png' });
});

test('death falls back to the checkpoint and keeps the bank', async ({ page }) => {
  await seed(page, {
    materials: { scrap: 40, parts: 5, supplies: 7 },
    // Depth 14 in segment 2: the boss at 10 was cleared, so death returns to depth 11.
    route: { depth: 14, checkpoint: 10, path: [0, 0, 0], bestDepth: 13 },
  });
  await openRoute(page);
  await expect(page.locator('[data-route="stop"]')).toHaveText('Stop 4 / 10');
  await expect(page.locator('[data-route="depth"]')).toHaveText('Depth 14');
  await expect(page.locator('.routeline__mark--start')).toContainText('Checkpoint · depth 11');
  await page.screenshot({ path: 'screenshots/route-deep-375x667.png' });

  await playable(page).first().click();
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  await earnScrap(page);
  await page.evaluate(() => window.__game!.endRun());
  await expect.poll(async () => (await state(page)).phase).toBe('summary');
  const summary = page.locator('.summary');
  await expect(summary).toContainText('Back to stop 1');
  await expect(summary).toContainText('depth 11');
  await expect(summary.locator('[data-summary="materials"]')).toContainText('Lost');
  // The fall-back is settled as soon as the summary opens, the bank is untouched.
  const settled = await profile(page);
  expect(settled.route.depth).toBe(11);
  expect(settled.materials).toEqual({ scrap: 40, parts: 5, supplies: 7 });
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'screenshots/summary-died-375x667.png' });

  await summary.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(page.locator('[data-route="stop"]')).toHaveText('Stop 1 / 10');
  await expect(page.locator('[data-route="depth"]')).toHaveText('Depth 11');
});

test('a safe stop resolves on the route screen with no map', async ({ page }) => {
  // Find a layer with a safe option for this seed, then stand on it.
  const segment = generateSegment(ROUTE_SEED, 0);
  const layer = segment.layers.findIndex((options) => options.some((o) => o.type === 'safe'));
  expect(layer).toBeGreaterThan(0);
  await seed(page, { route: { depth: layer + 1, checkpoint: 0, path: Array(layer).fill(0), bestDepth: layer } });
  await openRoute(page);
  const safe = page.locator('.stop[data-stop="safe"]');
  await expect(safe).toHaveCount(1);
  await expect(safe).toContainText('Safe Stop');
  await page.screenshot({ path: 'screenshots/route-safe-375x667.png' });

  const before = await profile(page);
  await safe.click();
  await expect(page.locator('[data-route="flash"]')).toBeVisible();
  await expect(page.locator('[data-route="stop"]')).toHaveText(`Stop ${layer + 2} / 10`);
  const after = await profile(page);
  expect(after.route.depth).toBe(layer + 2);
  expect(after.materials.supplies).toBeGreaterThan(before.materials.supplies);
  expect((await state(page)).phase).toBe('route');
  await page.waitForTimeout(350);
  await page.screenshot({ path: 'screenshots/route-safe-resolved-375x667.png' });
});

test('the boss stop is labelled coming soon and plays as a horde', async ({ page }) => {
  await seed(page, { route: { depth: 10, checkpoint: 0, path: Array(9).fill(0), bestDepth: 9 } });
  await openRoute(page);
  const boss = page.locator('.stop[data-stop="boss"]');
  await expect(boss).toHaveCount(1);
  await expect(boss).toContainText('BOSS (coming soon)');
  await page.screenshot({ path: 'screenshots/route-boss-375x667.png' });
  await boss.click();
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  expect((await state(page)).depth).toBe(10);
  await expect(page.locator('[data-hud="where"]')).toContainText('Horde');
});

test('reviving after a death takes the fall-back back', async ({ page }) => {
  await seed(page, {
    playtimeSeconds: REWARDED_ONBOARDING_FREE_MINUTES * 60,
    route: { depth: 13, checkpoint: 10, path: [0, 0], bestDepth: 12 },
  });
  await openRoute(page);
  await playable(page).first().click();
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  await page.evaluate(() => window.__game!.endRun());
  await expect.poll(async () => (await state(page)).phase).toBe('summary');
  expect((await profile(page)).route.depth).toBe(11);

  await page.locator('.summary__offer--hero').click();
  await expect.poll(async () => (await state(page)).phase, { timeout: 20_000 }).toBe('run');
  expect((await profile(page)).route.depth).toBe(13);
});
