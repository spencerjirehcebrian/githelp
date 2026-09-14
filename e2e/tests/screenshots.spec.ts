import { expect, test, type Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import { briefPayload } from '../fixtures/brief';

const SCREENSHOT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'screenshots');

async function serveBrief(page: Page) {
  await page.route('**/api/brief*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(briefPayload()),
    });
  });
}

test.describe('documentation screenshots', () => {
  test.beforeAll(() => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  });

  // Both schemes are captured because the app follows the operating system
  // and has no toggle, so a single screenshot would misrepresent it for half
  // the people reading the README.
  for (const scheme of ['light', 'dark'] as const) {
    test(`capture the ${scheme} scheme`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.setViewportSize({ width: 1100, height: 900 });
      await serveBrief(page);

      await page.goto('/');
      await expect(page.getByRole('listbox', { name: 'Brief' })).toBeVisible();
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `brief-${scheme}.png`),
        fullPage: true,
      });

      await page.keyboard.press('/');
      await page.keyboard.type('claimable');
      await expect(page.getByRole('option')).toHaveCount(5);
      await page.screenshot({
        path: path.join(SCREENSHOT_DIR, `filter-${scheme}.png`),
        fullPage: true,
      });
      await page.keyboard.press('Escape');

      await page.keyboard.press('?');
      await expect(page.getByRole('dialog', { name: 'Keys' })).toBeVisible();
      await page.screenshot({ path: path.join(SCREENSHOT_DIR, `keys-${scheme}.png`) });
    });
  }
});
