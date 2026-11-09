/**
 * The v2 map loop: a run has a fuel quota and a bus. Meeting the quota and touching the bus extracts;
 * dying ends the map without it. Both land on the summary, which shows fuel and materials.
 */
import { expect, test, type Page } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

async function startRun(page: Page): Promise<void> {
  await page.goto('/');
  await page.evaluate(() => window.__game!.startRun());
  await expect.poll(() => page.evaluate(() => window.__game!.getState().phase)).toBe('run');
}

test('a run starts with an empty fuel gauge and a quota', async ({ page }) => {
  await startRun(page);
  const s = await page.evaluate(() => window.__game!.getState());
  expect(s.fuel).toBe(0);
  expect(s.fuelQuota).toBeGreaterThan(0);
  expect(s.quotaMet).toBe(false);
  await expect(page.locator('[data-hud="fuel"]')).toHaveText(`0 / ${s.fuelQuota}`);
});

test('meeting the quota and touching the bus extracts and shows fuel and materials', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.__game!.completeObjective());
  await expect.poll(() => page.evaluate(() => window.__game!.getState().status)).toBe('extracted');
  await expect.poll(() => page.evaluate(() => window.__game!.getState().phase)).toBe('summary');

  const summary = page.locator('.summary');
  await expect(summary).toBeVisible();
  await expect(summary).toContainText('Extracted');
  const s = await page.evaluate(() => window.__game!.getState());
  await expect(summary.locator('.bar__label')).toContainText(`FUEL ${s.fuel} / ${s.fuelQuota}`);
  for (const name of ['Scrap', 'Parts', 'Supplies']) {
    await expect(summary.locator('[data-summary="materials"]')).toContainText(name);
  }
});

test('dying ends the map without extraction and still shows the summary', async ({ page }) => {
  await startRun(page);
  await page.evaluate(() => window.__game!.endRun());
  await expect.poll(() => page.evaluate(() => window.__game!.getState().phase)).toBe('summary');
  expect(await page.evaluate(() => window.__game!.getState().status)).toBe('dead');
  await expect(page.locator('.summary')).toContainText('Back to stop 1');
  await expect(page.locator('[data-summary="materials"]')).toContainText('Lost');
});
