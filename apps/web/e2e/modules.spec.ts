// apps/web/e2e/modules.spec.ts
import { test, expect } from '@playwright/test';

/**
 * End-to-end coverage for the twelve real-time modules.
 *
 * These specs run against the app in its preview/demo data mode (no Supabase
 * environment configured), which is exactly how a fresh Vercel preview boots.
 * When `NEXT_PUBLIC_SUPABASE_*` secrets are present the same assertions hold
 * against live data, because every module renders from the same components.
 */
const ROUTES: Array<{ path: string; heading: string; probe?: string }> = [
  { path: '/', heading: 'Campus360 Interactive Modules' },
  { path: '/marketplace', heading: 'Campus Economy & Marketplace', probe: 'Campus pickup point' },
  { path: '/skills', heading: 'Skill Hub, Tutoring & Part-Time Jobs' },
  { path: '/civic', heading: 'Complaint Box' },
  { path: '/events', heading: 'Events' },
  { path: '/health', heading: 'Emergency, Mental & Physical Health' },
  { path: '/mentorship', heading: 'Mentorship' },
  { path: '/archive', heading: 'Academic Archive' },
  { path: '/housing', heading: 'Housing & Commute' },
  { path: '/careers', heading: 'Alumni Network & Career Hub' },
  { path: '/dining', heading: 'Smart Cafeteria & Home-Made Food' },
  { path: '/lost-found', heading: 'Lost & Found' },
  { path: '/sports', heading: 'Sports & Crowdfunding' },
  { path: '/trust', heading: 'Trust & Verification Panel' },
  { path: '/admin/console', heading: 'Administration Console' },
  { path: '/reviews', heading: 'Live Service Reviews' },
];

test.describe('Campus360 interactive modules', () => {
  for (const route of ROUTES) {
    test(`${route.path} renders ${route.heading}`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      page.on('console', (message) => {
        if (message.type() === 'error' && !message.text().includes('favicon')) errors.push(message.text());
      });

      await page.goto(route.path);
      await expect(page.getByRole('heading', { name: new RegExp(route.heading, 'i') }).first()).toBeVisible();

      if (route.probe) {
        await expect(page.getByText(route.probe, { exact: false }).first()).toBeVisible();
      }

      expect(errors, `no client errors on ${route.path}`).toEqual([]);
    });
  }

  test('marketplace listings are interactive in preview mode', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByText('Casio FX-991EX', { exact: false }).first()).toBeVisible();
    const reserveButton = page.getByRole('button', { name: /^Reserve$/i }).first();
    await expect(reserveButton).toBeEnabled();
    await reserveButton.click();
    await expect(page.getByRole('button', { name: /Confirm reservation/i })).toBeVisible();
  });

  test('civic upvote button increments the counter', async ({ page }) => {
    await page.goto('/civic');
    const upvote = page.locator('button[aria-label^="Upvote"]').first();
    const before = await upvote.innerText();
    await upvote.click();
    await expect(upvote).not.toHaveText(before);
  });

  test('lost & found filters between lost and found boards', async ({ page }) => {
    await page.goto('/lost-found');
    await expect(page.getByText('Lost black backpack at TSC', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /^Found/i }).click();
    await expect(page.getByText('Found Casio calculator in Central Library', { exact: false })).toBeVisible();
  });

  test('academic archive filter controls and upload modal are interactive', async ({ page }) => {
    await page.goto('/archive');
    const courseInput = page.getByLabel('Filter by course code');
    await courseInput.fill('CSE-301');
    await expect(courseInput).toHaveValue('CSE-301');

    await page.getByRole('button', { name: /\+ Upload/i }).click();
    const uploadDialog = page.getByRole('dialog');
    await expect(uploadDialog).toContainText('Upload to the academic archive');
    await uploadDialog.getByPlaceholder('CSE-301').fill('CSE-301');
    await uploadDialog.getByPlaceholder('Data Structures').fill('Data Structures');
    await uploadDialog.getByRole('button', { name: /^Upload file$/i }).click();
    await expect(uploadDialog.getByText('Choose a file to upload.')).toBeVisible();
    await uploadDialog.getByRole('button', { name: /^Cancel$/i }).click();
    await expect(uploadDialog).toHaveCount(0);
  });

  test('live service reviews rating selector and submission flow are interactive', async ({ page }) => {
    await page.goto('/reviews');
    await expect(page.getByText(/Real-Time Verified Reviews/i)).toBeVisible();
    await page.getByRole('button', { name: '4 star' }).click();
    await expect(page.getByText('4/5')).toBeVisible();
    await page.getByPlaceholder('Headline (optional)').fill('Quiet reading room');
    await page
      .getByPlaceholder(/What was your experience/i)
      .fill('Clean desks, reliable Wi-Fi and helpful librarians.');
    await page.getByRole('button', { name: /Publish review/i }).click();
    await expect(page.getByText('Quiet reading room')).toBeVisible();
    await expect(page.getByText('Avg: 4.00 / 5.00')).toBeVisible();
  });

  test('health page exposes the blood bank tabs and emergency numbers', async ({ page }) => {
    await page.goto('/health');
    await expect(page.getByRole('button', { name: /Blood requests/i })).toBeVisible();
    await page.getByRole('button', { name: /Donor network/i }).click();
    await expect(page.getByText(/Smart Blood Bank donor search/i)).toBeVisible();
    await expect(page.getByRole('link', { name: /Call 999/i })).toBeVisible();
  });

  test('the notification bell is present in the persistent header', async ({ page }) => {
    await page.goto('/marketplace');
    await expect(page.getByRole('button', { name: /Notifications/i }).first()).toBeVisible();
  });
});
