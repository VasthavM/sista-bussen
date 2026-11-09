/**
 * Cold open (#17): four text frames on the very first launch, skippable, shown once,
 * replayable from Settings. Starts from an empty browser, unlike every other spec.
 */
import { expect, test } from '@playwright/test';

test.use({ storageState: { cookies: [], origins: [] } });
test.use({ viewport: { width: 375, height: 667 } });

const FRAMES = [
  ['A dead city.', 'One bus, lights still on.'],
  ['Everyone else is gone.', 'The bus still runs.'],
  ['One road.', 'One word on the map.', 'SURVIVORS?'],
  ['Find fuel.', 'Keep moving.'],
];

test('plays four frames on first launch, once, then replays from Settings', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/');
  const cold = page.locator('.coldopen');
  await expect(cold).toBeVisible();

  for (let i = 0; i < FRAMES.length; i++) {
    const frame = cold.locator(`[data-frame="${i + 1}"]`);
    await expect(frame).toBeVisible();
    for (const line of FRAMES[i]) {
      // The map frame carries its last line inside the artwork.
      await expect(frame).toContainText(line);
    }
    await page.waitForTimeout(i === 2 ? 2000 : 900); // let the entrance and the marker circle finish before the shot
    if (i === 0) await page.screenshot({ path: 'screenshots/07-coldopen-1.png' });
    if (i === 2) await page.screenshot({ path: 'screenshots/07-coldopen-3.png' });
    if (i === 3) await page.screenshot({ path: 'screenshots/07-coldopen-4.png' });
    await cold.click({ position: { x: 150, y: 330 } });
  }
  await expect(cold).toHaveCount(0);
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();

  // Shown once: a reload goes straight to the menu.
  await page.reload();
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  await expect(page.locator('.coldopen')).toHaveCount(0);

  // The first-run intro card (menu.ts, #16's copy) sits over a fresh menu; close it by role, not by its text.
  await page.locator('[data-screen="intro"] button').click();

  // Replay from Settings, skip at once, and the game underneath is untouched.
  await page.locator('.menu__nav-item').nth(3).click();
  await page.getByRole('button', { name: 'REPLAY' }).click();
  await expect(page.locator('.coldopen')).toBeVisible();
  await page.getByRole('button', { name: 'SKIP' }).click();
  await expect(page.locator('.coldopen')).toHaveCount(0);

  expect(errors).toEqual([]);
});

test('skip closes it at any frame and is remembered', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.coldopen')).toBeVisible();
  await page.getByRole('button', { name: 'SKIP' }).click();
  await expect(page.locator('.coldopen')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('[data-screen="menu"]')).toBeVisible();
  await expect(page.locator('.coldopen')).toHaveCount(0);
});
