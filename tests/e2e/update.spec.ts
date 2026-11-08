import { expect, test, type Page } from '@playwright/test';

import type { GameDebugApi } from '../../src/debug';

/**
 * Issue #6: boot screen and controlled update flow.
 *
 * `/__update-sw.js?tag=x` is a test-only endpoint (vite.config.ts, dev + preview servers
 * only) that serves the real worker template under a different build tag, i.e. "a new
 * service worker version".
 */

declare global {
  interface Window {
    __game?: GameDebugApi;
    __marker?: string;
  }
}

const VERSION_LINE = /v\d+\.\d+\.\d+ · \S+/;

async function dismissIntro(page: Page): Promise<void> {
  const intro = page.locator('.intro');
  if (await intro.isVisible()) {
    await page.getByRole('button', { name: 'UPPFATTAT' }).click();
    await expect(intro).toHaveCount(0);
  }
}

/** Menu is up, the intro is out of the way and a service worker controls the page. */
async function bootControlled(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  await dismissIntro(page);
  await page.waitForFunction(() => !!navigator.serviceWorker.controller);
}

async function installTestWorker(page: Page, query: string): Promise<void> {
  await page.evaluate((q) => navigator.serviceWorker.register(`/__update-sw.js?${q}`, { scope: '/' }), query);
}

const controllerScript = (page: Page): Promise<string> =>
  page.evaluate(() => navigator.serviceWorker.controller?.scriptURL ?? '');

const gameState = (page: Page) => page.evaluate(() => window.__game!.getState());

async function settingsVersion(page: Page): Promise<string> {
  await page.getByRole('button', { name: 'INSTÄLLNINGAR' }).click();
  const node = page.locator('.settings__version');
  await expect(node).toBeVisible();
  const text = (await node.textContent()) ?? '';
  await page.getByRole('button', { name: 'STÄNG' }).click();
  await expect(page.locator('.settings')).toHaveCount(0);
  return text;
}

test.describe('boot screen', () => {
  test.use({ serviceWorkers: 'block' });

  test('is painted from static markup before JS, then removed when the menu is ready', async ({ page }) => {
    // Hold every script back: whatever is on screen now comes from index.html alone.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/assets/*.js', async (route) => {
      await gate;
      await route.continue();
    });

    await page.goto('/', { waitUntil: 'commit' });
    const boot = page.locator('#boot');
    await expect(boot).toBeVisible();
    await expect(boot.locator('.boot__title')).toHaveText('SISTA BUSSEN');
    await expect(boot.locator('.boot__track .boot__runner')).toBeVisible();
    const bootVersion = ((await boot.locator('.boot__version').textContent()) ?? '').trim();
    expect(bootVersion).toMatch(new RegExp(`^${VERSION_LINE.source}$`));
    expect(bootVersion).not.toContain('[SB_');
    expect(bootVersion).not.toContain('utveckling');
    await expect(page.locator('[data-screen="menu"]')).toHaveCount(0);
    const html = await page.evaluate(() => getComputedStyle(document.documentElement).backgroundColor);
    expect(html).not.toBe('rgba(0, 0, 0, 0)'); // no white/transparent flash behind the boot
    await page.screenshot({ path: 'screenshots/boot-screen.png' });

    release();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await expect(boot).toHaveCount(0);

    // Settings show the same injected version line as the boot screen.
    await dismissIntro(page);
    expect(await settingsVersion(page)).toContain(bootVersion);
  });
});

test.describe('update flow', () => {
  test('a new worker raises the banner, never touches a run, and accepting updates the version', async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await bootControlled(page);
    const before = await settingsVersion(page);
    expect(before).toMatch(VERSION_LINE);
    expect(before).not.toContain('e2eupd');

    await page.evaluate(() => window.__game!.startRun({ night: 1 }));
    await expect.poll(async () => (await gameState(page)).phase).toBe('run');
    await page.evaluate(() => (window.__marker = 'same-page'));
    const started = (await gameState(page)).elapsed;

    // A new version appears and downloads in the background.
    await installTestWorker(page, 'tag=e2eupd');
    const banner = page.locator('.update-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('Ny version klar');
    await expect(banner).toHaveClass(/update-banner--in/);
    await page.waitForTimeout(300); // let the fade-in finish before capturing
    await page.screenshot({ path: 'screenshots/update-banner.png' });

    // The app keeps playing: same page, same controller, clock still running.
    await expect.poll(async () => (await gameState(page)).elapsed).toBeGreaterThan(started + 1.5);
    expect((await gameState(page)).phase).toBe('run');
    expect(await page.evaluate(() => window.__marker)).toBe('same-page');
    expect(await controllerScript(page)).toMatch(/\/sw\.js$/);

    // Accepting restarts into the new version, which the settings line now reports.
    await banner.getByRole('button', { name: /uppdatera/i }).click();
    await page.waitForFunction(() => window.__marker === undefined && !!window.__game);
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    expect(await controllerScript(page)).toContain('__update-sw.js');
    await dismissIntro(page);
    await expect.poll(() => settingsVersion(page)).toContain('e2eupd');
    expect(errors).toEqual([]);
  });

  test('at the run summary the update is only re-offered; leaving to the menu applies it', async ({ page }) => {
    await bootControlled(page);
    await page.evaluate(() => window.__game!.startRun({ night: 1 }));
    await expect.poll(async () => (await gameState(page)).phase).toBe('run');
    const runsBefore = await page.evaluate(() => window.__game!.profile().totalRuns);
    await page.evaluate(() => (window.__marker = 'same-page'));

    await installTestWorker(page, 'tag=e2ebreak');
    const banner = page.locator('.update-banner');
    await expect(banner).toBeVisible();
    await banner.getByRole('button', { name: 'SENARE' }).click(); // dismissed mid-run
    await expect(banner).toHaveCount(0);

    await page.evaluate(() => window.__game!.endRun());
    await expect.poll(async () => (await gameState(page)).phase).toBe('summary');
    await expect(page.locator('.summary')).toBeVisible();

    // Summary: banner is back, the page is untouched, the payout is not forfeited.
    await expect(banner).toBeVisible();
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => window.__marker)).toBe('same-page');
    expect((await gameState(page)).phase).toBe('summary');
    expect(await controllerScript(page)).toMatch(/\/sw\.js$/);

    // Natural break: the player leaves for the menu, the update lands without a tap.
    await page.getByRole('button', { name: 'TILL KUREN' }).click();
    await page.waitForFunction(() => window.__marker === undefined && !!window.__game);
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    expect(await controllerScript(page)).toContain('__update-sw.js');
    expect(await page.evaluate(() => window.__game!.profile().totalRuns)).toBe(runsBefore + 1);
  });
});

test.describe('offline and broken caches', () => {
  test('cold start works offline after one visit', async ({ page, context }) => {
    await bootControlled(page);
    // Wait for the install to finish precaching the app, not just the shell.
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const keys = await caches.keys();
          if (keys.length === 0) return 0;
          return (await (await caches.open(keys[0])).keys()).length;
        }),
      )
      .toBeGreaterThanOrEqual(10);

    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await expect(page.locator('#boot')).toHaveCount(0);
    await context.setOffline(false);
  });

  test('a failed precache still installs and boots the game', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await bootControlled(page);
    // This worker's precache includes a file that 404s: addAll-style install would reject.
    await installTestWorker(page, 'tag=e2efail&fail=1');
    await expect(page.locator('.update-banner')).toBeVisible();
    await page.locator('.update-banner').getByRole('button', { name: /uppdatera/i }).click();
    await page.waitForFunction(() => navigator.serviceWorker.controller?.scriptURL.includes('__update-sw.js'));
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await dismissIntro(page);
    await page.locator('[data-action="start"]').click();
    await expect.poll(async () => (await gameState(page)).phase).toBe('run');
    expect(errors).toEqual([]);
  });

  test('a wiped cache falls back to the network and still boots', async ({ page }) => {
    await bootControlled(page);
    await page.evaluate(async () => {
      for (const key of await caches.keys()) await caches.delete(key);
    });
    await page.reload();
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    await expect(page.locator('#boot')).toHaveCount(0);
  });
});
