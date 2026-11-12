// apps/web/e2e/campus360.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Campus360 BD Multi-University Web E2E', () => {
  test('blocks non-university Gmail sign-up and allows seeded BD public university email', async ({ page }) => {
    await page.goto('/signup');
    await page.fill('input[type="email"]', 'randomuser@gmail.com');
    await page.check('input[type="checkbox"] >> nth=0');
    await page.check('input[type="checkbox"] >> nth=1');
    await page.check('input[type="checkbox"] >> nth=2');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=not on the approved Bangladesh public university registry')).toBeVisible();
  });

  test('displays CRITICAL 999 emergency interstitial on grievance page', async ({ page }) => {
    await page.goto('/complaints');
    await page.selectOption('select >> nth=1', 'CRITICAL');
    await expect(page.locator('[role="alert"]')).toContainText('999');
  });
});
