/**
 * Menu loadout (#5): character and starting weapon are choosable from the first screen,
 * the choice persists across reloads, and the run starts with it.
 */
import { expect, test, type Page } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';
import { LOADOUT_KEY } from '../../src/ui/loadout';
import { WEAPONS } from '../../src/sim/content';

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

const SMALL = { width: 375, height: 667 };
const LARGE = { width: 430, height: 932 };

async function openMenu(page: Page, size = SMALL): Promise<void> {
  await page.setViewportSize(size);
  // The how-to-play panel covers the menu on a first visit; it has its own coverage.
  await page.addInitScript(() => {
    if (!sessionStorage.getItem('menu-spec-seeded')) {
      localStorage.setItem('sista-bussen.intro.v1', '1');
      sessionStorage.setItem('menu-spec-seeded', '1');
    }
  });
  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  await page.waitForTimeout(400); // screen fade-in
}

const slot = (page: Page, which: 'character' | 'weapon') => page.locator(`[data-loadout="${which}"]`);

async function pickWeapon(page: Page, id: string): Promise<void> {
  await slot(page, 'weapon').click();
  await page.locator(`.loadout-sheet [data-weapon="${id}"]`).click();
  await expect(page.locator('.loadout-sheet')).toHaveCount(0);
}

test.describe('menu loadout', () => {
  for (const [name, size] of [
    ['375x667', SMALL],
    ['430x932', LARGE],
  ] as const) {
    test(`first screen at ${name}: both slots and start are on screen, loadout above start`, async ({ page }) => {
      await openMenu(page, size);
      const start = await page.locator('[data-action="start"]').boundingBox();
      for (const which of ['character', 'weapon'] as const) {
        const box = await slot(page, which).boundingBox();
        expect(box, which).not.toBeNull();
        expect(box!.x).toBeGreaterThanOrEqual(0);
        expect(box!.x + box!.width).toBeLessThanOrEqual(size.width);
        expect(box!.y + box!.height).toBeLessThanOrEqual(start!.y);
        expect(start!.y - (box!.y + box!.height)).toBeLessThanOrEqual(16); // directly above
      }
      expect(start!.y + start!.height).toBeLessThanOrEqual(size.height);
      // Nothing on the first screen needs scrolling to be reached.
      const scrolls = await page.evaluate(() => {
        const body = document.querySelector('.menu__body') as HTMLElement;
        return body.scrollHeight > body.clientHeight;
      });
      expect(scrolls).toBe(false);
      await expect(slot(page, 'weapon')).toContainText('Vad har du i fickan?');
      await expect(slot(page, 'weapon')).toContainText(WEAPONS.nyckel.name);
      await page.screenshot({ path: `screenshots/menu-${name}.png` });

      await slot(page, 'weapon').click();
      await expect(page.locator('.loadout-sheet')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshots/menu-weapons-${name}.png` });
    });
  }

  test('weapon sheet lists every weapon with name and the sim description, locked ones say so', async ({ page }) => {
    await openMenu(page);
    await slot(page, 'weapon').click();
    await page.waitForTimeout(300); // sheet slide-in
    const rows = page.locator('.loadout-sheet [data-weapon]');
    await expect(rows).toHaveCount(Object.keys(WEAPONS).length);
    for (const def of Object.values(WEAPONS)) {
      const row = page.locator(`.loadout-sheet [data-weapon="${def.id}"]`);
      await expect(row).toContainText(def.name);
      await expect(row).toContainText(def.desc);
    }
    await expect(page.locator('.loadout-sheet [data-weapon="telefon"]')).toContainText('LÅST');
    await expect(page.locator('.loadout-sheet [data-weapon="nyckel"]')).not.toContainText('LÅST');
    const panel = await page.locator('.loadout-sheet__panel').boundingBox();
    expect(panel!.y).toBeGreaterThanOrEqual(0);
    expect(panel!.y + panel!.height).toBeLessThanOrEqual(SMALL.height);
  });

  test('a locked weapon routes to the shop weapons tab', async ({ page }) => {
    await openMenu(page);
    await slot(page, 'weapon').click();
    await page.locator('.loadout-sheet [data-weapon="telefon"]').click();
    await expect(page.locator('.shop')).toBeVisible();
    await expect(page.locator('.tabs__tab.is-active')).toHaveText('VAPEN');
    await expect(page.locator('.loadout-sheet')).toHaveCount(0);
  });

  test('picking a non-default weapon and character starts the run with them, and survives a reload', async ({ page }) => {
    await openMenu(page);
    const baseMaxHp = await page.evaluate(() => {
      window.__game!.startRun({ night: 1, character: 'nattvandraren', weapon: 'nyckel' });
      return window.__game!.getState().maxHp;
    });
    await page.reload();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();

    await pickWeapon(page, 'korv');
    await slot(page, 'character').click();
    await page.locator('.loadout-sheet [data-character="pensionaren"]').click();
    await expect(slot(page, 'weapon')).toContainText(WEAPONS.korv.name);
    await expect(slot(page, 'character')).toContainText('Pensionären');

    await page.reload();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await expect(slot(page, 'weapon')).toContainText(WEAPONS.korv.name);
    await expect(slot(page, 'character')).toContainText('Pensionären');
    expect(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)!), LOADOUT_KEY)).toEqual({
      character: 'pensionaren',
      weapon: 'korv',
    });

    await page.locator('[data-action="start"]').click();
    await expect.poll(() => page.evaluate(() => window.__game!.getState().phase)).toBe('run');
    const state = await page.evaluate(() => window.__game!.getState());
    expect(state.weapons.map((w) => w.id)).toEqual(['korv']);
    expect(state.maxHp).toBe(baseMaxHp + 30); // Pensionären: +30 max HP
  });

  test('keyboard: slot opens with Enter, Escape closes and returns focus, a pick closes the sheet', async ({ page }) => {
    await openMenu(page);
    await slot(page, 'weapon').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.loadout-sheet')).toBeVisible();
    await expect(page.locator('.loadout-sheet .pick.is-active')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.locator('.loadout-sheet')).toHaveCount(0);
    await expect(slot(page, 'weapon')).toBeFocused();

    await page.keyboard.press('Enter');
    await page.locator('.loadout-sheet [data-weapon="spray"]').focus();
    await page.keyboard.press('Enter');
    await expect(page.locator('.loadout-sheet')).toHaveCount(0);
    await expect(slot(page, 'weapon')).toContainText(WEAPONS.spray.name);
    await expect(slot(page, 'weapon')).toBeFocused();
  });

  test('a corrupt stored loadout falls back to the defaults instead of breaking the menu', async ({ page }) => {
    await page.addInitScript((k) => localStorage.setItem(k, '{nope'), LOADOUT_KEY);
    await openMenu(page);
    await expect(slot(page, 'weapon')).toContainText(WEAPONS.nyckel.name);
    await expect(slot(page, 'character')).toContainText('Nattvandraren');
  });
});
