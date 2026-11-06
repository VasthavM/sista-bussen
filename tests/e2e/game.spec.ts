import { expect, test } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

test.describe('Sista Bussen', () => {
  test('boots, plays, levels up, and produces screenshots', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/');

    // 1. Menu renders with the Kuren signage and the start action.
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await expect(page.locator('.menu__title')).toHaveText('SISTA BUSSEN');
    await expect(page.locator('[data-action="start"]')).toBeVisible();
    // The menu screen fades in; wait for that before capturing.
    await page.waitForTimeout(400);

    // First run shows the how-to-play panel; capture it, then dismiss it before playing.
    const intro = page.locator('.intro');
    if (await intro.isVisible()) {
      await page.screenshot({ path: 'screenshots/00-intro.png' });
      await page.getByRole('button', { name: 'UPPFATTAT' }).click();
      await expect(intro).toHaveCount(0);
      await page.waitForTimeout(250);
    }
    await page.screenshot({ path: 'screenshots/01-menu.png' });

    // 2. Start a run.
    await page.locator('[data-action="start"]').click();
    await expect.poll(async () => page.evaluate(() => window.__game?.getState().phase ?? '')).toBe('run');

    const box = await page.locator('#stage').boundingBox();
    expect(box).not.toBeNull();
    const originX = box!.x + box!.width / 2;
    const originY = box!.y + box!.height / 2;

    // 3. Drive the virtual stick for ~3 seconds with a real pointer drag.
    await page.mouse.move(originX, originY);
    await page.mouse.down();
    for (let i = 0; i < 12; i++) {
      await page.mouse.move(originX + 46, originY - 30, { steps: 3 });
      await page.mouse.move(originX + 20, originY + 44, { steps: 3 });
    }
    await page.waitForTimeout(3000);
    await page.mouse.up();

    const afterMove = await page.evaluate(() => window.__game!.getState());
    expect(afterMove.elapsed).toBeGreaterThan(0);

    await expect
      .poll(async () => page.evaluate(() => window.__game!.getState().enemies), { timeout: 20_000 })
      .toBeGreaterThan(0);

    // 4. Screenshot the live run before the cards open.
    const moved = await page.evaluate(() => window.__game!.getState());
    expect(moved.enemies).toBeGreaterThan(0);
    expect(moved.elapsed).toBeGreaterThan(1);
    await page.screenshot({ path: 'screenshots/02-run.png' });

    // 5. Force enough XP for a level-up and assert the card UI takes over.
    await page.evaluate(() => window.__game!.grantXp(200));
    await expect(page.locator('.cards .card').first()).toBeVisible({ timeout: 10_000 });
    await expect(page.locator('.levelup__title')).toContainText('NIVÅ');
    await expect(page.locator('.cards .card')).toHaveCount(3);
    // Let the card fan-in animation settle before capturing.
    await page.waitForTimeout(700);
    await page.screenshot({ path: 'screenshots/03-levelup.png' });

    // 6. Picking cards spends the queued level-ups and resumes the run. 200 XP
    // can grant several levels at once, and the game reopens the next card while
    // levels are still pending, so drain the queue instead of assuming one pick.
    const beforePick = await page.evaluate(() => window.__game!.getState().level);
    let picks = 0;
    for (let i = 0; i < 20; i++) {
      const phase = await page.evaluate(() => window.__game!.getState().phase);
      if (phase !== 'levelup') break;
      await page.locator('.cards .card').first().click();
      picks += 1;
      await page.waitForTimeout(120);
    }
    await expect.poll(async () => page.evaluate(() => window.__game!.getState().phase)).toBe('run');

    // The clicks must have been real: at least one card was picked and the card
    // overlay is gone now that the pending level-ups are spent.
    expect(picks).toBeGreaterThan(0);
    expect(beforePick).toBeGreaterThan(1);
    await expect(page.locator('.cards')).toHaveCount(0);

    const afterPick = await page.evaluate(() => window.__game!.getState());
    expect(afterPick.weapons.length).toBeGreaterThan(0);
    await page.screenshot({ path: 'screenshots/04-after-pick.png' });

    expect(errors).toEqual([]);
  });
});