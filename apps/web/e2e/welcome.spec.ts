// apps/web/e2e/welcome.spec.ts
import { test, expect, type Page } from '@playwright/test';

/** Pathnames the main frame visits (full loads and history/router navigations alike). */
function trackNavigations(page: Page) {
  const visited: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) visited.push(new URL(frame.url()).pathname);
  });
  return visited;
}

test.describe('Welcome screen', () => {
  test('first visit to / redirects to /welcome exactly once, then / shows the dashboard', async ({ page }) => {
    const visited = trackNavigations(page);

    await page.goto('/');
    await expect(page).toHaveURL(/\/welcome$/);
    await expect(page.getByRole('heading', { level: 1, name: /One Verified Super-App/i })).toBeVisible();
    // 13 supported universities, from the registry.
    await expect(page.getByRole('list', { name: /Supported Public Universities/i }).getByRole('listitem')).toHaveCount(13);
    // Let any (incorrect) redirect loop show itself before counting.
    await page.waitForTimeout(1500);
    expect(visited.filter((path) => path === '/welcome')).toHaveLength(1);

    // The flag is now stored: a later visit to / goes straight to the dashboard.
    await page.goto('/');
    await expect(page.getByRole('heading', { name: /Campus360 Interactive Modules/i }).first()).toBeVisible();
    await page.waitForTimeout(1500);
    expect(new URL(page.url()).pathname).toBe('/');
    expect(visited.filter((path) => path === '/welcome')).toHaveLength(1);
  });

  test('/welcome stays reachable after it has been seen, and its CTAs work', async ({ page }) => {
    await page.goto('/welcome');
    await page.getByRole('link', { name: /Explore Modules/i }).click();
    await expect(page.locator('#modules')).toBeInViewport();
    await expect(page.getByRole('link', { name: /Privacy/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Terms/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Contact/i })).toBeVisible();
  });
});
