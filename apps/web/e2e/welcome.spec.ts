// apps/web/e2e/welcome.spec.ts
import { test, expect } from '@playwright/test';

test.describe('SSR Welcome, Overview & Legal Pages', () => {
  test('delivers complete SSR HTML on / and /welcome with JavaScript disabled (zero skeleton, single header/main)', async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();

    for (const path of ['/', '/welcome']) {
      const response = await page.goto(`${baseURL}${path}`);
      expect(response?.status()).toBe(200);

      await expect(page.locator('header')).toHaveCount(1);
      await expect(page.locator('main')).toHaveCount(1);
      await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);

      await expect(
        page.getByRole('heading', {
          level: 1,
          name: /One verified super-app for every public university campus in Bangladesh/i,
        })
      ).toBeVisible();

      // All 4 pillar tabs and all 12+ module links exist in SSR HTML
      await expect(page.getByRole('tab')).toHaveCount(4);
      for (const href of [
        '/archive',
        '/skills',
        '/mentorship',
        '/careers',
        '/marketplace',
        '/lost-found',
        '/events',
        '/dining',
        '/sports',
        '/health',
        '/housing',
        '/complaints',
        '/trust',
      ]) {
        await expect(page.locator(`main a[href^="${href}"]`).first()).toHaveCount(1);
      }

      // Server-supplied public universities and logos render without client fetch
      await expect(page.getByText('University of Dhaka')).toBeVisible();
      await expect(page.getByText('Jahangirnagar University')).toBeVisible();
      await expect(page.locator('img[alt="University of Dhaka logo"]')).toHaveCount(1);

      // Footer legal links
      await expect(page.locator('footer a[href="/privacy"]')).toBeVisible();
      await expect(page.locator('footer a[href="/terms"]')).toBeVisible();
    }

    await context.close();
  });

  test('/welcome interactive pillars, university filter and instant demo modal work end-to-end', async ({
    page,
  }) => {
    await page.goto('/welcome');
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);

    await page.getByRole('tab', { name: /Campus Life & Circular Economy/i }).click();
    await expect(page.getByRole('link', { name: /Marketplace/i }).first()).toBeVisible();

    await page.getByRole('tab', { name: /Hall & Campus Governance/i }).click();
    await expect(page.getByRole('link', { name: /Residential Hall Registries/i })).toBeVisible();

    await page.getByLabel(/Search universities by name, code or city/i).fill('Dhaka');
    await page.getByRole('button', { name: /University of Dhaka/i }).first().click();
    await expect(page.getByRole('button', { name: /Explore DU Campus/i })).toBeVisible();

    await page.getByRole('button', { name: /Try Instant Demo/i }).first().click();
    await expect(page.getByRole('dialog', { name: /Try Instant Demo/i })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog', { name: /Try Instant Demo/i })).toHaveCount(0);
  });

  test('/privacy and /terms render HTTP 200 standalone legal pages', async ({ page }) => {
    const privacyRes = await page.goto('/privacy');
    expect(privacyRes?.status()).toBe(200);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Privacy & Data Retention' })).toBeVisible();
    await expect(
      page.getByText(/scheduled for permanent deletion 7 days after upload/i)
    ).toBeVisible();
    await expect(page.locator('a[href="mailto:support@campus360bd.com"]')).toBeVisible();

    const termsRes = await page.goto('/terms');
    expect(termsRes?.status()).toBe(200);
    await expect(page.locator('header')).toHaveCount(1);
    await expect(page.locator('main')).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1, name: 'Terms of Service' })).toBeVisible();
    await expect(
      page.getByText(/require a verified institutional email address/i)
    ).toBeVisible();
  });
});
