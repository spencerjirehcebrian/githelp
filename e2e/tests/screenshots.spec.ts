import { test } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const SCREENSHOT_DIR = path.resolve(__dirname, '..', '..', 'docs', 'screenshots');

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

test.describe('Capture Workstation Documentation Screenshots', () => {
  test.beforeAll(async () => {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
    const seedScript = path.resolve(__dirname, '..', 'seed.sh');
    execSync(`bash "${seedScript}" /tmp/e2e_githelp.db`);
  });

  test('capture all documentation screenshots', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // 1. Dashboard screenshot (Task Workstation)
    await page.waitForSelector('[data-testid="inspection-cockpit"]');
    await wait(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard.png') });

    // 2. Keyboard navigation active card
    await page.keyboard.press('j');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'keyboard-navigation.png') });
    await page.keyboard.press('k');
    await wait(200);

    // 3. Pipeline Board View
    await page.keyboard.press('v');
    await page.waitForSelector('[data-testid="pipeline-board"]');
    await wait(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pipeline-board.png') });
    await page.keyboard.press('v');
    await wait(300);

    // 4. Files Changed & Diff view in Cockpit
    await page.locator('[data-testid="inspection-cockpit"]').getByRole('button', { name: /Files Changed/i }).click();
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diff-inspector.png') });
    await page.locator('[data-testid="inspection-cockpit"]').getByRole('button', { name: /Overview/i }).click();
    await wait(200);

    // 5. Command Palette screenshot
    await page.getByRole('button', { name: /Command Palette/i }).click();
    await page.waitForSelector('text=Task Actions');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'command-palette.png') });
    await page.keyboard.press('Escape');
    await wait(300);

    // 6. Snooze modal
    await page.keyboard.press('z');
    await page.waitForSelector('text=Snooze Notification');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'snooze-modal.png') });
    await page.keyboard.press('Escape');
    await wait(300);

    // 7. Shortcuts cheat sheet
    await page.keyboard.press('?');
    await page.waitForSelector('text=Keyboard Shortcuts');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'shortcuts-modal.png') });
    await page.keyboard.press('Escape');
    await wait(300);

    // 8. Settings modal
    await page.click('button[title*="Settings"]');
    await page.waitForSelector('text=Preferences & Settings');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings-modal.png') });
    await page.click('text=Cancel');
  });
});
