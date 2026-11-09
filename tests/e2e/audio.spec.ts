import { expect, test } from '@playwright/test';

/**
 * Automated browsers must be silent: with navigator.webdriver true the audio engine never
 * creates an AudioContext. The counter wraps both constructors before any page script runs.
 */
declare global {
  interface Window {
    __audioContexts?: number;
  }
}

test.describe('audio under automation', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.__audioContexts = 0;
      const w = window as unknown as Record<string, unknown>;
      for (const key of ['AudioContext', 'webkitAudioContext']) {
        const Orig = w[key] as (new (...a: unknown[]) => unknown) | undefined;
        if (!Orig) continue;
        w[key] = class extends (Orig as new (...a: unknown[]) => object) {
          constructor(...args: unknown[]) {
            super(...args);
            window.__audioContexts = (window.__audioContexts ?? 0) + 1;
          }
        };
      }
    });
  });

  test('no AudioContext is created in a run, and the saved mute setting is untouched', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-screen="menu"]')).toBeVisible();
    expect(await page.evaluate(() => navigator.webdriver)).toBe(true);

    const intro = page.locator('.intro');
    if (await intro.isVisible()) await page.getByRole('button', { name: 'UPPFATTAT' }).click();
    await page.locator('[data-action="start"]').click(); // a real gesture: unlocks audio in an unmuted build
    await expect.poll(() => page.evaluate(() => window.__game?.getState().phase ?? '')).toBe('run');
    await page.waitForTimeout(1500);

    expect(await page.evaluate(() => window.__audioContexts)).toBe(0);
    expect(await page.evaluate(() => localStorage.getItem('sista-bussen.audio.v1'))).toBeNull();
  });

  test('control: the counter does see a context when one is constructed', async ({ page }) => {
    await page.goto('/');
    // Silent: a context with nothing connected to it makes no sound.
    await page.evaluate(() => {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      void new Ctor().close();
    });
    expect(await page.evaluate(() => window.__audioContexts)).toBe(1);
  });
});
