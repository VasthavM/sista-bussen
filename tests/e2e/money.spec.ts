/**
 * The money loop, driven end to end: die, take the rewarded revive, exhaust the
 * revive cap, double the materials of an extracted map, then spend Biljetter on a
 * permanent upgrade and see it in the next run. Every price, cap and duration comes from the frozen
 * catalog/shop modules — the only hardcoded numbers here are screen-independent
 * arithmetic.
 */
import { expect, test, type Page } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';
import { upgradeCost, SHOP_UPGRADES } from '../../src/meta/shop';
import { SAVE_KEY, SAVE_VERSION } from '../../src/meta/save';
import { AD_PLACEMENTS, REWARDED_ONBOARDING_FREE_MINUTES } from '../../src/monetize/catalog';

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

const CHARACTER = 'pensionaren' as const;
const WEAPON = 'nyckel' as const;
// Character tree, paid in Supplies since save v4.
const UPGRADE = 'c_hp' as const;

function digits(text: string | null): number {
  return Number((text ?? '').replace(/[^0-9]/g, ''));
}

async function state(page: Page) {
  return page.evaluate(() => window.__game!.getState());
}

async function profile(page: Page) {
  return page.evaluate(() => window.__game!.profile());
}

/** Level-up cards pause the run; click through them so gameplay keeps moving. */
async function drainLevelUps(page: Page): Promise<void> {
  for (let i = 0; i < 20; i++) {
    if ((await state(page)).phase !== 'levelup') return;
    await page
      .locator('.cards .card')
      .first()
      .click({ timeout: 2000 })
      .catch(() => undefined);
    await page.waitForTimeout(120);
  }
}

/** Play until the run has earned Växel, without getting stuck on a card screen. */
async function waitForChange(page: Page, minimum: number): Promise<void> {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const current = await state(page);
    if (current.change >= minimum) return;
    if (current.phase === 'levelup') await drainLevelUps(page);
    await page.waitForTimeout(150);
  }
  throw new Error(`No Växel earned within 30s (wanted ${minimum})`);
}

async function die(page: Page): Promise<void> {
  await drainLevelUps(page);
  await page.evaluate(() => window.__game!.endRun());
  await expect.poll(async () => (await state(page)).phase).toBe('summary');
  await expect(page.locator('.summary')).toBeVisible();
}

async function takeRevive(page: Page): Promise<void> {
  const offer = page.locator('.summary__offer--hero');
  await expect(offer).toHaveCount(1);
  await offer.click();
  // The mock provider plays a real countdown; wait for the run to resume.
  await expect.poll(async () => (await state(page)).phase, { timeout: 20_000 }).toBe('run');
}

test('revive, material doubling and permanent upgrades all move real state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  // Start past the onboarding ad gate so the offers under test are rendered.
  await page.addInitScript(
    ({ key, version, seconds }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify({ version, nightUnlocked: 1, playtimeSeconds: seconds }));
      }
    },
    { key: SAVE_KEY, version: SAVE_VERSION, seconds: REWARDED_ONBOARDING_FREE_MINUTES * 60 },
  );
  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();

  // 1. Baseline: one run at a known character, before any permanent upgrade.
  await page.evaluate(
    ({ character, weapon }) => window.__game!.startRun({ character, weapon }),
    { character: CHARACTER, weapon: WEAPON },
  );
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  const baseline = await state(page);
  expect(baseline.maxHp).toBeGreaterThan(0);

  // Earn real Växel first: doubling zero would prove nothing.
  await waitForChange(page, 1);
  const earned = await state(page);
  expect(earned.change).toBeGreaterThan(0);

  // 2. First death: the revive offer must show the remaining count from the catalog.
  await die(page);
  const cap = AD_PLACEMENTS.revive.cap;
  const firstOffer = page.locator('.summary__offer--hero');
  await expect(firstOffer).toContainText(`${cap} of ${cap} left`);

  await takeRevive(page);
  const revived = await state(page);
  expect(revived.status).toBe('running');
  expect(revived.hp).toBeGreaterThan(0);
  expect(revived.hp).toBeGreaterThan(revived.maxHp * 0.5);
  expect(revived.revivesUsed).toBe(1);

  // 3. Second death: one revive left, then the allowance is gone.
  await die(page);
  await expect(page.locator('.summary__offer--hero')).toContainText(`${cap - 1} of ${cap} left`);
  await takeRevive(page);
  const afterSecond = await state(page);
  expect(afterSecond.status).toBe('running');
  expect(afterSecond.revivesUsed).toBe(cap);

  await die(page);
  await expect(page.locator('.summary__offer--hero')).toHaveCount(0);
  expect((await state(page)).revivesUsed).toBe(cap);

  // 4. Back on the route, extract a map: the doubling offer must bank exactly one more copy of the haul.
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await expect(page.locator('[data-screen="route"]')).toBeVisible();
  await page.locator('.stop:not([data-stop="safe"])').first().click();
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  await waitForChange(page, 1);
  await page.evaluate(() => window.__game!.completeObjective());
  await expect.poll(async () => (await state(page)).phase).toBe('summary');
  const gained = (await state(page)).materials;
  const bankedOnce = (await profile(page)).materials;

  const doubleOffer = page.locator('.summary__offers button', { hasText: AD_PLACEMENTS.double_fares.title });
  await doubleOffer.click();
  await expect(page.locator('.summary__loot-label')).toHaveText('Gained · doubled', { timeout: 20_000 });
  const bankedTwice = (await profile(page)).materials;
  expect(bankedTwice.scrap - bankedOnce.scrap).toBe(gained.scrap);
  expect(bankedTwice.parts - bankedOnce.parts).toBe(gained.parts);
  expect(bankedTwice.supplies - bankedOnce.supplies).toBe(gained.supplies);
  await expect(page.locator('.summary__offers button', { hasText: 'MATERIALS DOUBLED' })).toBeDisabled();

  // 5. Spend Biljetter on a permanent upgrade and watch the balance move.
  await page.getByRole('button', { name: 'CONTINUE' }).click();
  await page.getByRole('button', { name: 'Menu', exact: true }).click();
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();

  const levelBefore = (await profile(page)).upgrades[UPGRADE] ?? 0;
  const cost = upgradeCost(UPGRADE, levelBefore);
  await page.evaluate((amount) => window.__game!.grantMaterials({ supplies: amount }), cost + 5);

  const walletBefore = (await profile(page)).materials.supplies;
  expect(walletBefore).toBeGreaterThanOrEqual(cost);

  await page.getByRole('button', { name: 'SHOP', exact: true }).click();
  await expect(page.locator('.shop')).toBeVisible();

  const row = page.locator('.shoprow').filter({ hasText: SHOP_UPGRADES[UPGRADE].name });
  const buy = row.locator('.shoprow__action');
  expect(digits(await buy.textContent())).toBe(cost);
  await buy.click();

  const walletAfter = (await profile(page)).materials.supplies;
  const levelAfter = (await profile(page)).upgrades[UPGRADE] ?? 0;
  expect(levelAfter).toBe(levelBefore + 1);
  expect(walletBefore - walletAfter).toBe(cost);

  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();
  await expect(page.locator('.shop')).toHaveCount(0);

  // 6. The upgrade is real in the next run: same character, higher max HP.
  await page.evaluate(
    ({ character, weapon }) => window.__game!.startRun({ character, weapon }),
    { character: CHARACTER, weapon: WEAPON },
  );
  await expect.poll(async () => (await state(page)).phase).toBe('run');
  const upgraded = await state(page);

  // The per-level effect is read out of the shop definition, not restated here.
  const hpPerLevel = digits(SHOP_UPGRADES[UPGRADE].description(1));
  expect(hpPerLevel).toBeGreaterThan(0);
  expect(upgraded.maxHp).toBe(baseline.maxHp + hpPerLevel * (levelAfter - levelBefore));
  expect(upgraded.maxHp).toBeGreaterThan(baseline.maxHp);

  expect(errors).toEqual([]);
});