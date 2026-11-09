/**
 * Menu loadout (#5): character and starting weapon are choosable from the first screen,
 * the choice persists across reloads, and the run starts with it.
 */
import { expect, test, type Page } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';
import { SAVE_KEY } from '../../src/meta/save';
import { LOADOUT_KEY } from '../../src/ui/loadout';
import { PASSIVES, WEAPONS } from '../../src/sim/content';
import { EVOLUTION_PASSIVE_LEVEL, WEAPON_MAX_LEVEL } from '../../src/sim/upgrades';

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
      await expect(slot(page, 'weapon')).toContainText('Starting weapon');
      await expect(slot(page, 'weapon')).toContainText(WEAPONS.nyckel.name);
      await page.screenshot({ path: `screenshots/menu-${name}.png` });

      await slot(page, 'weapon').click();
      await expect(page.locator('.loadout-sheet')).toBeVisible();
      await page.waitForTimeout(300);
      await page.screenshot({ path: `screenshots/menu-weapons-${name}.png` });
    });
  }

  for (const [name, size] of [
    ['375x667', SMALL],
    ['430x932', LARGE],
  ] as const) {
    test(`body ACs at ${name}: bottom nav with icons, compact chip, no dead space, no repeated strings`, async ({ page }) => {
      await openMenu(page, size);
      const box = async (sel: string) => (await page.locator(sel).first().boundingBox())!;

      // Secondary destinations: icon bottom nav, one tap, subordinate to the CTA, inside the viewport.
      const items = page.locator('.menu__nav-item');
      await expect(items).toHaveCount(4);
      await expect(page.locator('.menu__nav-item svg')).toHaveCount(4);
      const cta = await box('[data-action="start"]');
      for (let i = 0; i < 4; i++) {
        const b = (await items.nth(i).boundingBox())!;
        expect(b.height).toBeGreaterThanOrEqual(44);
        expect(b.height).toBeLessThan(cta.height);
        expect(b.y).toBeGreaterThan(cta.y + cta.height);
        expect(b.y + b.height).toBeLessThanOrEqual(size.height);
      }
      const bodyHeight = await page.evaluate(() => document.documentElement.scrollHeight);
      expect(bodyHeight).toBeLessThanOrEqual(size.height + 1);

      // The three materials are chips, not full-width rows.
      for (const id of ['scrap', 'parts', 'supplies']) {
        const chip = await box(`.wallet--${id}`);
        expect(chip.width).toBeLessThan(size.width * 0.5);
      }
      await expect(page.locator('.menu__wallet [data-material]')).toHaveCount(3);
      // The night picker is gone; the route card replaces it.
      await expect(page.locator('.nights')).toHaveCount(0);
      await expect(page.locator('[data-menu="route"]')).toContainText('Stop 1 / 10');

      // No void: every gap between stacked blocks stays small.
      const blocks = ['.menu__sign', '.wallet--scrap', '.menu__card', '.loadout', '[data-action="start"]', '.menu__nav'];
      let prev = await box(blocks[0]);
      for (const sel of blocks.slice(1)) {
        const b = await box(sel);
        expect(b.y - (prev.y + prev.height), `gap before ${sel}`).toBeLessThanOrEqual(40);
        prev = b;
      }

      // No string appears twice; the CTA no longer repeats the loadout; no unexplained colour dots.
      const texts = await page.evaluate(() =>
        Array.from(document.querySelectorAll('[data-screen="menu"] *'))
          .filter((n) => n.children.length === 0 && n.textContent?.trim())
          .map((n) => n.textContent!.trim()),
      );
      // Numbers repeat legitimately (three empty material chips all read 0).
      expect(texts.filter((t, i) => texts.indexOf(t) !== i && !/^\d+$/.test(t))).toEqual([]);
      await expect(page.locator('[data-action="start"]')).toHaveText('START');
      await expect(page.locator('.choice__dot')).toHaveCount(0);
      await page.screenshot({ path: `screenshots/menu-${name}.png` });
    });
  }

  test('settings is one tap from the menu', async ({ page }) => {
    await openMenu(page);
    await page.getByRole('button', { name: 'SETTINGS' }).click();
    await expect(page.locator('.settings')).toBeVisible();
  });

  test('weapon keys show in the header chips only when owned', async ({ page }) => {
    await openMenu(page);
    await expect(page.locator('.wallet--token')).toHaveCount(0);
    await page.evaluate(() => window.__game!.grantTickets(1)); // forces a save to exist
    await page.addInitScript((key) => {
      // Runs before the game boots on the next load; the previous page's unload save lands first.
      const raw = localStorage.getItem(key);
      if (raw) localStorage.setItem(key, JSON.stringify({ ...JSON.parse(raw), weaponTokens: 2 }));
    }, SAVE_KEY);
    await page.reload();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await expect(page.locator('.wallet--token')).toContainText('2');
    const chip = (await page.locator('.wallet--token').boundingBox())!;
    expect(chip.width).toBeLessThan(SMALL.width * 0.5);
  });

  test('weapon sheet explains the evolution name and its requirement from sim data', async ({ page }) => {
    await openMenu(page);
    await slot(page, 'weapon').click();
    for (const def of Object.values(WEAPONS)) {
      const row = page.locator(`.loadout-sheet [data-weapon="${def.id}"]`);
      await expect(row).toContainText(`→ ${def.evolvedName}`);
      await expect(row).toContainText(
        `Evolves at level ${WEAPON_MAX_LEVEL} + ${PASSIVES[def.passive].name} ${EVOLUTION_PASSIVE_LEVEL}`,
      );
    }
  });

  test('all three characters are legible in the character sheet without clipping', async ({ page }) => {
    await openMenu(page);
    await slot(page, 'character').click();
    await page.waitForTimeout(300);
    const panel = (await page.locator('.loadout-sheet__panel').boundingBox())!;
    for (const id of ['nattvandraren', 'pensionaren', 'studenten']) {
      const row = page.locator(`.loadout-sheet [data-character="${id}"]`);
      const b = (await row.boundingBox())!;
      expect(b.x).toBeGreaterThanOrEqual(panel.x);
      expect(b.x + b.width).toBeLessThanOrEqual(panel.x + panel.width);
      expect(b.y + b.height).toBeLessThanOrEqual(SMALL.height);
      const clipped = await row.evaluate((n) => Array.from(n.querySelectorAll('*')).some((c) => c.scrollWidth > c.clientWidth + 1));
      expect(clipped).toBe(false);
    }
    await page.screenshot({ path: 'screenshots/menu-characters-375x667.png' });
  });

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
    await expect(page.locator('.loadout-sheet [data-weapon="telefon"]')).toContainText('LOCKED');
    await expect(page.locator('.loadout-sheet [data-weapon="nyckel"]')).not.toContainText('LOCKED');
    const scrolls = await page.locator('.picks').evaluate((n) => n.scrollHeight > n.clientHeight);
    expect(scrolls).toBe(false);
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
      window.__game!.startRun({ character: 'nattvandraren', weapon: 'nyckel' });
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
    await page.locator('.stop:not([data-stop="safe"])').first().click(); // the route screen passes the loadout on
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
