import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test.describe('GitHelp Triage & Launcher E2E Workflows', () => {
  test.beforeAll(async () => {
    // Initial seed of test database
    const seedScript = path.resolve(__dirname, '..', 'seed.sh');
    execSync(`bash "${seedScript}" /tmp/e2e_githelp.db`);
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. loads home page, renders sidebar buckets and card stream', async ({ page }) => {
    // Check brand title
    await expect(page.locator('text=GitHelp').first()).toBeVisible();

    // Check buckets in sidebar
    await expect(page.getByRole('button', { name: /Action Required/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Waiting on Others/i })).toBeVisible();

    // Check notifications list
    await expect(page.getByText('Add biometric login support')).toBeVisible();
    await expect(page.getByText('Fix memory leak in worker')).toBeVisible();
    await expect(page.getByText('Investigate database deadlock')).toBeVisible();

    // Check branch checkout command
    await expect(page.getByText('feature/biometrics')).toBeVisible();
  });

  test('2. supports keyboard navigation (j/k) and active highlighting', async ({ page }) => {
    await expect(page.getByText('Add biometric login support')).toBeVisible();

    // Select first card to ensure focus
    await page.getByText('Add biometric login support').click();

    // Navigate down with 'j'
    await page.keyboard.press('j');
    const secondCard = page.locator('div.group.rounded-xl').filter({ hasText: 'Fix memory leak in worker' });
    await expect(secondCard).toHaveClass(/ring-github-accent/);

    // Navigate back up with 'k'
    await page.keyboard.press('k');
    const firstCard = page.locator('div.group.rounded-xl').filter({ hasText: 'Add biometric login support' });
    await expect(firstCard).toHaveClass(/ring-github-accent/);
  });

  test('3. search filtering with / shortcut', async ({ page }) => {
    await expect(page.getByText('Add biometric login support')).toBeVisible();

    // Press '/' to focus search
    await page.keyboard.press('/');
    await page.keyboard.type('biometric');

    await expect(page.getByText('Add biometric login support')).toBeVisible();
    await expect(page.getByText('Fix memory leak in worker')).not.toBeVisible();
    await expect(page.getByText('Investigate database deadlock')).not.toBeVisible();

    // Clear search
    await page.keyboard.press('Escape');
  });

  test('4. opens shortcuts cheat sheet and closes with Esc', async ({ page }) => {
    await expect(page.getByText('Add biometric login support')).toBeVisible();

    // Click shortcuts button in top bar
    await page.click('button[title*="Keyboard shortcuts"]');
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
    await expect(page.getByText('Select next notification')).toBeVisible();

    // Press 'Escape'
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).not.toBeVisible();
  });

  test('5. opens Settings modal, toggles theme, and adjusts preferences', async ({ page }) => {
    // Click settings gear icon
    await page.click('button[title*="Settings"]');
    await expect(page.getByText('Preferences & Settings')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'GitHub Authentication' })).toBeVisible();

    // Toggle Light theme
    await page.click('button:has-text("Light")');
    const htmlClass = await page.locator('html').getAttribute('class');
    expect(htmlClass).not.toContain('dark');

    // Toggle back to Dark
    await page.click('button:has-text("Dark")');
    const updatedHtmlClass = await page.locator('html').getAttribute('class');
    expect(updatedHtmlClass).toContain('dark');

    // Close settings modal
    await page.click('text=Cancel');
    await expect(page.getByText('Preferences & Settings')).not.toBeVisible();
  });

  test('6. snoozes notification (z key) and moves it to Snoozed bucket', async ({ page }) => {
    await expect(page.getByText('Add biometric login support')).toBeVisible();

    // Press 'z' to open snooze modal
    await page.keyboard.press('z');
    await expect(page.getByText('Snooze Notification')).toBeVisible();
    await expect(page.getByText('1 Hour')).toBeVisible();

    // Click 1 hour preset button
    await page.click('button:has-text("1 Hour")');
    await expect(page.getByText('Snooze Notification')).not.toBeVisible();
    await expect(page.getByText('Add biometric login support')).not.toBeVisible();

    // Switch to Snoozed bucket in sidebar
    await page.getByRole('button', { name: /Snoozed/i }).click();
    await expect(page.getByText('Add biometric login support')).toBeVisible();
  });

  test('7. marks remaining notifications as done and verifies Inbox Zero transition', async ({ page }) => {
    // Switch back to Action Required bucket
    await page.getByRole('button', { name: /Action Required/i }).click();
    await expect(page.getByText('Fix memory leak in worker')).toBeVisible();

    // Click Mark All Done in top bar
    await page.getByRole('button', { name: /Mark All Done/i }).click();

    // Check Inbox Zero state
    await expect(page.getByText('Inbox Zero Achieved')).toBeVisible();
    await expect(page.getByText('You\'re completely caught up!')).toBeVisible();
  });
});
