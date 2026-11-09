/**
 * Reskin evidence (#17): a combat frame with every zombie type on screen and the
 * menu, both at 375x667, written to screenshots/. Also guards that the combat
 * canvas never throws while the new sprites draw.
 */
import { expect, test } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

test.use({ viewport: { width: 375, height: 667 } });

test('menu and a mixed zombie combat frame at 375x667', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(() => localStorage.setItem('sista-bussen.intro.v1', '1'));

  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'screenshots/07-menu-375x667.png' });

  await page.locator('[data-action="start"]').click();
  await expect.poll(async () => page.evaluate(() => window.__game?.getState().phase ?? '')).toBe('run');

  // One of each, plus extras of the common ones, then let them close in.
  await page.evaluate(() => {
    const g = window.__game!;
    for (const type of ['fyllo', 'duva', 'skugga', 'vaktmastare', 'sparkcykel'] as const) g.forceSpawn(type);
    for (let i = 0; i < 4; i++) g.forceSpawn('duva');
    g.forceSpawn('fyllo');
    g.forceSpawn('skugga');
  });
  await expect.poll(async () => page.evaluate(() => window.__game!.onScreenEnemies()), { timeout: 15_000 }).toBeGreaterThan(3);
  await page.waitForTimeout(1800);
  await page.screenshot({ path: 'screenshots/08-combat-375x667.png' });

  expect(errors).toEqual([]);
});
