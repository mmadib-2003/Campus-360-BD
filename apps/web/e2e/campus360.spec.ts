// apps/web/e2e/campus360.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Campus360 BD Multi-University Web E2E', () => {
  test('blocks non-university Gmail sign-up and allows seeded BD public university email', async ({ page }) => {
    await page.goto('/signup');
    await page.selectOption('#signup-role', 'student');

    await page.fill('#university-combobox', 'University of Dhaka');
    await page
      .locator('#university-combobox-list button')
      .filter({ hasText: 'University of Dhaka' })
      .first()
      .click();

    await expect(page.getByText(/Approved email domains:.*@du\.ac\.bd/i)).toBeVisible();

    await page.click('#residential-hall');
    await page.locator('#residential-hall-list button').first().click();

    await page.fill('#program-session', '2023-24');
    await page.keyboard.press('Escape');
    await page.locator('#signup-program').selectOption({ index: 1 });
    if ((await page.locator('#signup-department').count()) > 0) {
      await page.locator('#signup-department').selectOption({ index: 1 });
    }
    await page.fill('#signup-name', 'Nusrat Jahan');
    await page.fill('#signup-student-id', 'DU-2026-12345');

    await page.check('input[type="checkbox"] >> nth=0');
    await page.check('input[type="checkbox"] >> nth=1');
    await page.check('input[type="checkbox"] >> nth=2');

    await page.fill('#signup-email', 'randomuser@gmail.com');
    await expect(page.locator('#signup-email')).toHaveAttribute('aria-invalid', 'true');
    await expect(page.locator('#signup-email-error')).toContainText(/Approved domains:.*@du\.ac\.bd/i);
    await page.click('button[type="submit"]');
    await expect(page.getByText('This email domain is not approved for the selected university.')).toBeVisible();

    await page.fill('#signup-email', 'student@du.ac.bd');
    await expect(page.locator('#signup-email')).toHaveAttribute('aria-invalid', 'false');
    await expect(page.locator('#signup-email-error')).toHaveCount(0);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/verify/);
  });

  test('displays CRITICAL 999 emergency interstitial on grievance page', async ({ page }) => {
    await page.goto('/complaints');
    await page.locator('form select').nth(1).selectOption('CRITICAL');
    const emergencyAlert = page.locator('main [role="alert"]').first();
    await expect(emergencyAlert).toBeVisible();
    await expect(emergencyAlert).toContainText('999');
    await expect(emergencyAlert).toContainText(/Immediate Crisis/i);
  });
});
