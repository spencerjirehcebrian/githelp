import { expect, test, type Page } from '@playwright/test';
import { briefPayload } from '../fixtures/brief';

/**
 * Serves the brief fixture and records every request to it.
 *
 * The returned array is the point of most of these tests: the interface is
 * supposed to fetch once and then work entirely from memory, and the only
 * honest way to check that is to count what crosses the network.
 */
async function mockBrief(page: Page, items?: Parameters<typeof briefPayload>[0]) {
  const calls: string[] = [];

  await page.route('**/api/brief*', async (route) => {
    calls.push(new URL(route.request().url()).search || '(no query)');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(briefPayload(items)),
    });
  });

  return calls;
}

async function load(page: Page) {
  const calls = await mockBrief(page);
  await page.goto('/');
  await expect(page.getByRole('listbox', { name: 'Brief' })).toBeVisible();
  return calls;
}

test.describe('the brief', () => {
  test('renders lanes in priority order with a row per item', async ({ page }) => {
    await load(page);

    const headings = page.getByRole('heading', { level: 2 });
    await expect(headings).toHaveText([
      'Unblock others',
      'Land work in flight',
      'Needs a decision',
      'Pick up next',
    ]);

    const first = page.getByRole('option').first();
    await expect(first).toContainText('#101');
    await expect(first).toContainText('Add retry to the uploader');
    await expect(first).toContainText('grace requested your review today');
    await expect(first).toContainText('Review and leave a decision');
  });

  test('collapses items that are only waiting into one line', async ({ page }) => {
    await load(page);

    await expect(page.getByText('2 PRs waiting on reviewers: #203, #204')).toBeVisible();
    await expect(page.getByRole('option', { name: /Tidy the config loader/ })).toHaveCount(0);
  });

  test('caps the claimable lane and expands it on demand', async ({ page }) => {
    await load(page);

    await expect(page.getByText('Claimable 405')).toHaveCount(0);

    await page.getByText('2 more').click();
    await expect(page.getByText('Claimable 405')).toBeVisible();
    await expect(page.getByText('2 more')).toHaveCount(0);
  });

  test('fetches once and never again while you use it', async ({ page }) => {
    const calls = await load(page);
    expect(calls).toHaveLength(1);

    // Move the cursor across every row.
    for (let i = 0; i < 8; i += 1) await page.keyboard.press('j');
    for (let i = 0; i < 4; i += 1) await page.keyboard.press('k');

    // Filter, which used to be a request per keystroke.
    await page.keyboard.press('/');
    await page.keyboard.type('claimable');
    await expect(page.getByRole('option')).toHaveCount(5);
    await page.keyboard.press('Escape');

    // Expand a lane and export.
    await page.getByText('2 more').click();
    await page.keyboard.press('y');
    await expect(page.getByText('Copied brief as markdown')).toBeVisible();

    expect(calls).toHaveLength(1);
  });

  test('only refresh goes back to the network, and it bypasses the cache', async ({ page }) => {
    const calls = await load(page);

    await page.keyboard.press('r');
    await expect.poll(() => calls.length).toBe(2);
    expect(calls[1]).toContain('refresh=1');
  });

  test('moves the cursor with j and k', async ({ page }) => {
    await load(page);

    const rows = page.getByRole('option');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');

    await page.keyboard.press('j');
    await expect(rows.nth(1)).toHaveAttribute('aria-selected', 'true');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'false');

    await page.keyboard.press('k');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');
  });

  test('stops at the ends rather than wrapping', async ({ page }) => {
    await load(page);

    const rows = page.getByRole('option');
    await page.keyboard.press('k');
    await expect(rows.nth(0)).toHaveAttribute('aria-selected', 'true');

    for (let i = 0; i < 20; i += 1) await page.keyboard.press('j');
    await expect(rows.last()).toHaveAttribute('aria-selected', 'true');
  });

  test('filters across every visible field', async ({ page }) => {
    await load(page);

    await page.keyboard.press('/');
    await page.keyboard.type('uploader');
    await expect(page.getByRole('option')).toHaveCount(1);
    await expect(page.getByRole('option').first()).toContainText('#101');

    await page.keyboard.press('Escape');
    await expect(page.getByRole('option').first()).toContainText('#101');
    await expect(page.getByRole('option')).toHaveCount(7);
  });

  test('explains an empty filter result instead of showing a blank page', async ({ page }) => {
    await load(page);

    await page.keyboard.press('/');
    await page.keyboard.type('kubernetes');

    await expect(page.getByText('No matches.')).toBeVisible();
    await expect(page.getByText(/10 items in the brief/)).toBeVisible();
  });

  test('copies the checkout command for the selected row', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await load(page);

    await page.keyboard.press('c');
    await expect(page.getByText('Copied checkout command')).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe('gh pr checkout 101');
  });

  test('exports the brief as markdown, disclosing what it left out', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await load(page);

    await page.keyboard.press('y');
    await expect(page.getByText('Copied brief as markdown')).toBeVisible();

    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toContain('# acme/widgets');
    expect(copied).toContain('## Unblock others');
    expect(copied).toContain('- [#101](https://github.com/acme/widgets/pull/101)');
    expect(copied).toContain('- Action: Review and leave a decision');
    expect(copied).toContain('- Checkout: `gh pr checkout 101`');
    expect(copied).toContain('2 PRs waiting on reviewers: #203, #204');
    expect(copied).toContain('2 more not shown');
  });

  test('shows the key reference and closes it with Escape', async ({ page }) => {
    await load(page);

    await page.keyboard.press('?');
    const sheet = page.getByRole('dialog', { name: 'Keys' });
    await expect(sheet).toBeVisible();
    await expect(sheet.getByText('Copy the brief as markdown')).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(sheet).toBeHidden();
  });

  test('says so when there is nothing waiting on you', async ({ page }) => {
    await mockBrief(page, []);
    await page.goto('/');

    await expect(page.getByText('Nothing is waiting on you.')).toBeVisible();
    await expect(page.getByRole('option')).toHaveCount(0);
  });
});
