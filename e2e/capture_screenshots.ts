import { chromium } from '@playwright/test';
import { spawn, execSync } from 'child_process';
import path from 'path';
import fs from 'fs';

const PORT = 8098;
const DB_PATH = '/tmp/screenshot_githelp.db';
const BASE_URL = `http://127.0.0.1:${PORT}`;
const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'docs', 'screenshots');

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(url: string, maxAttempts = 30): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const res = await fetch(`${url}/api/status`);
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await wait(300);
  }
  return false;
}

async function main() {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });

  // 1. Build fresh binary and seed database
  console.log('Seeding screenshot database...');
  const seedScript = path.resolve(__dirname, 'seed.sh');
  execSync(`bash "${seedScript}" "${DB_PATH}"`);

  console.log('Building standalone binary...');
  execSync('make build');

  // 2. Start server
  const binaryPath = path.resolve(__dirname, '..', 'bin', 'githelp');
  console.log(`Starting server on port ${PORT}...`);
  const server = spawn(binaryPath, [], {
    env: { ...process.env, PORT: `${PORT}`, DB_PATH },
    stdio: 'ignore',
  });

  try {
    const ready = await waitForServer(BASE_URL);
    if (!ready) {
      throw new Error(`Server failed to start on ${BASE_URL}`);
    }

    console.log('Server is ready. Launching Playwright browser...');
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2, // High-DPI Retina crispness
      colorScheme: 'dark',
    });

    const page = await context.newPage();

    // 1. Dashboard screenshot (Zen Task Workstation)
    console.log('Capturing dashboard.png...');
    await page.goto(BASE_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('[data-testid="task-section-list"]');
    await wait(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'dashboard.png') });

    // 1b. Keyboard navigation active card
    console.log('Capturing keyboard-navigation.png...');
    await page.keyboard.press('j');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'keyboard-navigation.png') });
    await page.keyboard.press('k');
    await wait(200);

    // 2. Pipeline Board screenshot
    console.log('Capturing pipeline-board.png...');
    await page.keyboard.press('v');
    await page.waitForSelector('[data-testid="pipeline-board"]');
    await wait(600);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'pipeline-board.png') });
    await page.keyboard.press('v');
    await wait(300);

    // 3. Inspection Drawer & Diff view
    console.log('Capturing diff-inspector.png...');
    await page.keyboard.press('Enter');
    await page.waitForSelector('[data-testid="inspection-drawer"]');
    await page.locator('[data-testid="inspection-drawer"]').getByRole('button', { name: /Files Changed/i }).click();
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'diff-inspector.png') });
    await page.keyboard.press('Escape');
    await wait(300);

    // 4. Command Palette screenshot
    console.log('Capturing command-palette.png...');
    await page.getByRole('button', { name: /Command Palette/i }).click();
    await page.waitForSelector('text=Task Actions');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'command-palette.png') });
    await page.keyboard.press('Escape');
    await wait(300);

    // 5. Snooze modal
    console.log('Capturing snooze-modal.png...');
    await page.keyboard.press('z');
    await page.waitForSelector('text=Snooze Notification');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'snooze-modal.png') });
    await page.keyboard.press('Escape');
    await wait(300);

    // 6. Shortcuts cheat sheet
    console.log('Capturing shortcuts-modal.png...');
    await page.keyboard.press('?');
    await page.waitForSelector('text=Keyboard Shortcuts');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'shortcuts-modal.png') });
    await page.keyboard.press('Escape');
    await wait(300);

    // 7. Settings modal
    console.log('Capturing settings-modal.png...');
    await page.click('button[title*="Settings"]');
    await page.waitForSelector('text=Preferences & Settings');
    await wait(400);
    await page.screenshot({ path: path.join(SCREENSHOT_DIR, 'settings-modal.png') });
    await page.click('text=Cancel');

    await browser.close();
    console.log('All screenshots captured successfully in docs/screenshots/');
  } finally {
    server.kill('SIGTERM');
  }
}

main().catch((err) => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});
