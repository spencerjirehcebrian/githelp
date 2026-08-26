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

  test('1. loads home page, renders sidebar buckets, card stream and inspection cockpit', async ({ page }) => {
    // Check brand title
    await expect(page.locator('text=GitHelp').first()).toBeVisible();

    // Check buckets in sidebar
    await expect(page.getByRole('button', { name: /Action Required/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Waiting on Others/i })).toBeVisible();

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

    // Switch to Snoozed bucket in sidebar
    await page.getByRole('button', { name: /Snoozed/i }).click();
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Add biometric login support' })).toBeVisible();
  });

  test('7. marks remaining notifications as done and verifies Inbox Zero transition', async ({ page }) => {
    // Switch back to Action Required bucket
    await page.getByRole('button', { name: /Action Required/i }).click();
    await expect(page.locator('[data-testid="notification-card"]').filter({ hasText: 'Fix memory leak in worker' })).toBeVisible();

    // Click Mark All Done in top bar
    await page.getByRole('button', { name: /Mark All Done/i }).click();

    // Check Inbox Zero state
    await expect(page.getByText('Inbox Zero Achieved')).toBeVisible();
    await expect(page.getByText('You\'re completely caught up!')).toBeVisible();
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
    await paletteInput.fill('Assistant');
    await expect(page.getByText('Open Git Assistant & Workflow Solver')).toBeVisible();

    // Press Escape to close
    await page.keyboard.press('Escape');
    await expect(paletteInput).not.toBeVisible();
  });

  test('10. switches to Git Assistant & Workflow Solver view', async ({ page }) => {
    // Click Git Assistant in sidebar
    await page.getByRole('button', { name: /Git Assistant/i }).click();
    await expect(page.getByText('Git Assistant & Workflow Solver')).toBeVisible();
    await expect(page.getByText('Undo last commit (keep changes staged/modified)')).toBeVisible();

    // Search for rebase recipes
    const search = page.getByPlaceholder(/Search problem/i);
    await search.fill('rebase');
    await expect(page.getByText('Rebase current branch on top of latest main')).toBeVisible();

    // Switch back to Triage Workstation
    await page.getByRole('button', { name: /Triage Workstation/i }).click();
    await expect(page.locator('[data-testid="inspection-cockpit"]')).toBeVisible();
  });
});
