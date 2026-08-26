import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import path from 'path';

test.describe('GitHelp Triage & Workstation E2E Workflows', () => {
  const seedScript = path.resolve(__dirname, '..', 'seed.sh');

  test.beforeEach(async ({ page }) => {
    // Seed fresh test database before each test
    execSync(`bash "${seedScript}" /tmp/e2e_githelp.db`);
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('1. loads home page, renders top bar scope, card stream and inspection cockpit', async ({ page }) => {
    // Check brand title
    await expect(page.locator('text=GitHelp').first()).toBeVisible();

    // Check scope selector and repo dropdown in top bar
    await expect(page.getByRole('button', { name: /Active Tasks/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /All Repos/i })).toBeVisible();

    // Check notifications list items
    const firstCard = page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' });
    await expect(firstCard).toBeVisible();
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Fix memory leak in worker' })).toBeVisible();
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Investigate database deadlock' })).toBeVisible();

    // Check inspection cockpit is open with active PR details
    const cockpit = page.locator('[data-testid="inspection-cockpit"]');
    await expect(cockpit).toBeVisible();
    await expect(cockpit.getByText('feature/biometrics').first()).toBeVisible();
    await expect(cockpit.getByRole('button', { name: /Checkout/i }).first()).toBeVisible();
  });

  test('2. supports keyboard navigation (j/k) and active highlighting in stream and cockpit', async ({ page }) => {
    const firstCard = page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' });
    await expect(firstCard).toHaveAttribute('data-selected', 'true');

    // Cockpit shows first card details
    const cockpit = page.locator('[data-testid="inspection-cockpit"]');
    await expect(cockpit.getByRole('heading', { name: 'Add biometric login support' })).toBeVisible();

    // Navigate down with 'j'
    await page.keyboard.press('j');
    const secondCard = page.locator('[data-testid="notification-card"]').filter({ hasText: 'Fix memory leak in worker' });
    await expect(secondCard).toHaveAttribute('data-selected', 'true');
    await expect(firstCard).toHaveAttribute('data-selected', 'false');
    await expect(cockpit.getByRole('heading', { name: 'Fix memory leak in worker' })).toBeVisible();

    // Navigate back up with 'k'
    await page.keyboard.press('k');
    await expect(firstCard).toHaveAttribute('data-selected', 'true');
    await expect(secondCard).toHaveAttribute('data-selected', 'false');
    await expect(cockpit.getByRole('heading', { name: 'Add biometric login support' })).toBeVisible();
  });

  test('3. search filtering with / shortcut', async ({ page }) => {
    const firstCard = page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' });
    await expect(firstCard).toBeVisible();

    // Press '/' to focus search
    await page.keyboard.press('/');
    await page.keyboard.type('biometric');

    await expect(firstCard).toBeVisible();
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Fix memory leak in worker' })).not.toBeVisible();
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Investigate database deadlock' })).not.toBeVisible();

    // Clear search
    await page.keyboard.press('Escape');
  });

  test('4. opens shortcuts cheat sheet and closes with Esc', async ({ page }) => {
    const firstCard = page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' });
    await expect(firstCard).toBeVisible();

    // Click shortcuts button in top bar
    await page.click('button[title*="Keyboard shortcuts"]');
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).toBeVisible();
    await expect(page.getByText('Navigate Tasks / Cards')).toBeVisible();

    // Press 'Escape'
    await page.keyboard.press('Escape');
    await expect(page.getByRole('heading', { name: 'Keyboard Shortcuts' })).not.toBeVisible();
  });

  test('5. opens Settings modal, toggles theme, and adjusts preferences', async ({ page }) => {
    // Click settings user profile button in top bar
    await page.click('button[title*="Preferences & Settings"]');
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

  test('6. snoozes notification (z key) and moves it to Snoozed scope', async ({ page }) => {
    const firstCard = page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' });
    await expect(firstCard).toBeVisible();

    // Press 'z' to open snooze modal
    await page.keyboard.press('z');
    await expect(page.getByText('Snooze Notification')).toBeVisible();
    await expect(page.getByText('1 Hour')).toBeVisible();

    // Click 1 hour preset button
    await page.click('button:has-text("1 Hour")');
    await expect(page.getByText('Snooze Notification')).not.toBeVisible();
    await expect(firstCard).not.toBeVisible();

    // Switch to Snoozed scope in top bar dropdown
    await page.getByRole('button', { name: /Active Tasks/i }).click();
    await page.getByRole('button', { name: /Snoozed/i }).click();
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' })).toBeVisible();
  });

  test('7. marks remaining notifications as done and verifies Inbox Zero transition', async ({ page }) => {
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Fix memory leak in worker' })).toBeVisible();

    // Click Mark All Done in top bar
    await page.getByRole('button', { name: /Mark All Done/i }).click();

    // Check Inbox Zero state
    await expect(page.getByText('All Tasks Completed!')).toBeVisible();
  });

  test('8. inspects tabs in Cockpit: Files Changed, Git Recipes, and Notes', async ({ page }) => {
    const cockpit = page.locator('[data-testid="inspection-cockpit"]');
    await expect(cockpit).toBeVisible();

    // Switch to Files Changed tab
    await cockpit.getByRole('button', { name: /Files Changed/i }).click();
    await expect(cockpit.getByText('src/auth/biometrics.ts')).toBeVisible();
    await expect(cockpit.getByText('src/components/LoginModal.tsx')).toBeVisible();

    // Switch to Git Recipes tab
    await cockpit.getByRole('button', { name: /Git Recipes/i }).click();
    await expect(cockpit.getByText('1. Checkout & Switch to Branch')).toBeVisible();
    await expect(cockpit.getByText('git checkout feature/biometrics')).toBeVisible();

    // Switch to Notes tab
    await cockpit.getByRole('button', { name: /Notes/i }).click();
    const textarea = cockpit.getByPlaceholder(/Write your private review notes/i);
    await expect(textarea).toBeVisible();
    await textarea.fill('Tested biometrics on iOS and Chrome. Everything looks solid.');
    await cockpit.getByRole('button', { name: /Save Notes/i }).click();
    await expect(page.getByText('Notes saved')).toBeVisible();
  });

  test('9. opens and searches Global Command Palette (Cmd+K)', async ({ page }) => {
    // Click Command Palette trigger button in top bar
    await page.getByRole('button', { name: /Command Palette/i }).click();
    const paletteInput = page.getByPlaceholder(/Type a command or search actions/i);
    await expect(paletteInput).toBeVisible();

    // Search command
    await paletteInput.fill('Complete');
    await expect(page.getByText('Complete Task')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(paletteInput).not.toBeVisible();
  });

  test('10. pins task to Today\'s Focus with t key and toggles CI visibility', async ({ page }) => {
    const firstCard = page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' });
    await expect(firstCard).toBeVisible();

    // Press 't' to toggle Today's Focus
    await page.keyboard.press('t');
    await expect(firstCard.getByText("Today's Focus")).toBeVisible();

    // Toggle CI badges via top bar button
    const ciBtn = page.getByRole('button', { name: /CI/i }).filter({ hasText: /CI (Off|On)/i });
    if (await ciBtn.isVisible()) {
      await ciBtn.click();
      await expect(page.getByText(/CI badges (visible|hidden)/i)).toBeVisible();
    }
  });

  test('11. toggles between Stream and Pipeline Board views with v key', async ({ page }) => {
    // Check initial stream view
    await expect(page.locator('[data-testid="notification-card"]').first()).toBeVisible();

    // Toggle to Pipeline Board via 'v' key
    await page.keyboard.press('v');
    const board = page.locator('[data-testid="pipeline-board"]');
    await expect(board).toBeVisible();
    await expect(board.getByRole('heading', { name: 'Needs Your Review' })).toBeVisible();
    await expect(board.getByRole('heading', { name: 'CI Failing' })).toBeVisible();
    await expect(board.getByRole('heading', { name: 'Ready to Merge' })).toBeVisible();
    await expect(board.getByRole('heading', { name: 'Waiting on Others' })).toBeVisible();

    // Toggle back to Stream view via 'v' key
    await page.keyboard.press('v');
    await expect(page.locator('[data-testid="pipeline-board"]')).not.toBeVisible();
  });
});
