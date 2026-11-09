/**
 * Onboarding ad gate: a fresh profile sees no rewarded-ad offer anywhere, playtime
 * accumulates and is persisted, and the offers appear once the gate is passed.
 */
import { expect, test, type Page } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';
import { SAVE_KEY, SAVE_VERSION } from '../../src/meta/save';
import { AD_PLACEMENTS, REWARDED_ONBOARDING_FREE_MINUTES } from '../../src/monetize/catalog';

declare global {
  interface Window {
    __game?: GameDebugApi;
  }
}

const GATE_SECONDS = REWARDED_ONBOARDING_FREE_MINUTES * 60;

async function phase(page: Page): Promise<string> {
  return page.evaluate(() => window.__game!.getState().phase);
}

async function storedPlaytime(page: Page, key: string): Promise<number> {
  return page.evaluate((k) => Number(JSON.parse(localStorage.getItem(k) ?? '{}').playtimeSeconds ?? 0), key);
}

async function startAndDie(page: Page): Promise<void> {
  await page.evaluate(() => window.__game!.startRun({ night: 1 }));
  await expect.poll(() => phase(page)).toBe('run');
  await page.evaluate(() => window.__game!.endRun());
  await expect.poll(() => phase(page)).toBe('summary');
}

test('a fresh profile is offered no rewarded ad anywhere', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();

  // Level-up cards: no reroll button.
  await page.evaluate(() => window.__game!.startRun({ night: 1 }));
  await expect.poll(() => phase(page)).toBe('run');
  await page.evaluate(() => window.__game!.grantXp(500));
  await expect.poll(() => phase(page)).toBe('levelup');
  await expect(page.locator('.cards .card').first()).toBeVisible();
  await expect(page.locator('.levelup__reroll')).toHaveCount(0);
  // 500 xp is several levels; click through every card screen.
  for (let i = 0; i < 20 && (await phase(page)) === 'levelup'; i++) {
    await page.locator('.cards .card').first().click({ timeout: 2000 }).catch(() => undefined);
    await page.waitForTimeout(120);
  }

  // Death: no revive, no double fares, nothing mentioning a rewarded ad.
  await expect.poll(() => phase(page)).toBe('run');
  await page.evaluate(() => window.__game!.endRun());
  await expect.poll(() => phase(page)).toBe('summary');
  await expect(page.locator('.summary')).toBeVisible();
  await expect(page.locator('.summary__offer--hero')).toHaveCount(0);
  await expect(page.locator('.summary__offers')).toHaveCount(0);
  await expect(page.locator('.summary')).not.toContainText(AD_PLACEMENTS.double_fares.title);
  await expect(page.locator('.summary')).not.toContainText('annons');
  await page.getByRole('button', { name: 'TILL KUREN' }).click();
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();

  // Crate: the free claim works, the ad pull is not rendered.
  await page.getByRole('button', { name: 'DAGLÅDA' }).click();
  await expect(page.locator('.crate__claim')).toBeVisible();
  await expect(page.locator('.crate__extra')).toHaveCount(0);
  await expect(page.locator('.crate')).not.toContainText('annons');
  await page.locator('.crate__claim').click();
  await expect.poll(async () => (await page.evaluate(() => window.__game!.profile())).tickets).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'CLOSE', exact: true }).click();

  // Contracts: no ad skip, no extra-pull teaser.
  await page.getByRole('button', { name: 'KONTRAKT' }).click();
  await expect(page.locator('.contract').first()).toBeVisible();
  await expect(page.locator('.contracts')).not.toContainText('annons');
  await expect(page.locator('.contracts')).not.toContainText('ANNONS');

  expect(errors).toEqual([]);
});

test('playtime accumulates only while running and is persisted', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  expect(await storedPlaytime(page, SAVE_KEY)).toBe(0);

  await page.evaluate(() => window.__game!.startRun({ night: 1 }));
  await expect.poll(() => phase(page)).toBe('run');
  await page.waitForTimeout(1500);

  // Pause: the clock stops. `visibilitychange` hidden is what persists, so fire it to read the value.
  const flush = () =>
    page.evaluate(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
  await page.evaluate(() => window.__game!.setPhase('pause'));
  await expect(page.locator('body.has-overlay')).toHaveCount(1);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
  });
  await flush();
  const atPause = await storedPlaytime(page, SAVE_KEY);
  expect(atPause).toBeGreaterThan(1);
  expect(atPause).toBeLessThan(5);
  await page.waitForTimeout(800);
  await flush();
  expect(await storedPlaytime(page, SAVE_KEY)).toBe(atPause);
});

test('past the gate the offers come back', async ({ page }) => {
  await page.addInitScript(
    ({ key, version, seconds }) => {
      if (!localStorage.getItem(key)) {
        localStorage.setItem(key, JSON.stringify({ version, nightUnlocked: 1, playtimeSeconds: seconds }));
      }
    },
    { key: SAVE_KEY, version: SAVE_VERSION, seconds: GATE_SECONDS },
  );
  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  await startAndDie(page);
  await expect(page.locator('.summary__offer--hero')).toHaveCount(1);
  await expect(page.locator('.summary__offers button', { hasText: AD_PLACEMENTS.double_fares.title })).toBeVisible();
});
