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
  { path: '/marketplace', heading: 'Campus Economy & Marketplace', probe: 'Campus Pickup Points' },
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

      if (route.path === '/') {
        // The dashboard sits behind the one-time /welcome redirect: visit /welcome
        // first so the "seen" flag exists, exactly as a returning visitor would.
        await page.goto('/welcome');
        await page.waitForFunction(() =>
          Object.keys(window.localStorage).some((key) => key.startsWith('campus360:welcome-seen:'))
        );
      }
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
    await expect(page.getByRole('button', { name: /Reserve & pick locker/i }).first()).toBeEnabled();
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
    await expect(page.getByText('Blue backpack with laptop charger', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: /I found something/i }).click();
    await expect(page.getByText('Found: blue backpack near library stairs', { exact: false })).toBeVisible();
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
