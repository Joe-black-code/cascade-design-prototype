import { test, expect } from '@playwright/test';
import { monitorRuntime } from './helpers.js';

const qa = (name) => `/tmp/cascade-qa/${name}`;
async function noOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}
async function openModal(page) {
  await page.locator('.header-inner > [data-modal-open]').click();
  await expect(page.locator('[data-modal]')).toBeVisible();
}

test.describe.configure({ mode: 'serial' });

test('desktop A/B: header, mega menu, modal, footer, notice and boundary widths', async ({ page }) => {
  const clean = monitorRuntime(page);
  for (const width of [1280, 1440, 1920]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/index.html?concept=a');
    await noOverflow(page);
    await expect(page.locator('.header-contacts a').nth(0)).toHaveAttribute('href', /^tel:/);
    await expect(page.locator('.header-contacts a').nth(1)).toHaveAttribute('href', /^mailto:/);
  }
  for (const concept of ['a', 'b']) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(`/index.html?concept=${concept}`);
    await page.locator('[data-mega-menu-trigger]').first().click();
    await expect(page.locator('#mega-menu-products')).toBeVisible();
    await page.screenshot({ path: qa(`${concept}-desktop-mega.png`), fullPage: false });
    await page.keyboard.press('Escape');
    await openModal(page);
    const form = page.locator('[data-modal] [data-estimate-form]');
    await form.getByLabel(/Прикрепить файл/).setInputFiles('tests/fixtures/brief.pdf');
    await expect(form.locator('[data-file-clear]')).toBeVisible();
    await form.locator('[data-file-clear]').click();
    await expect(form.locator('[data-file-name]')).toHaveText('Файл не выбран.');
    await page.screenshot({ path: qa(`${concept}-modal.png`), fullPage: false });
    await page.keyboard.press('Escape');
    await page.locator('.site-footer').scrollIntoViewIfNeeded();
    await expect(page.locator('.footer-legal')).toBeVisible();
    await page.screenshot({ path: qa(`${concept}-desktop-footer.png`), fullPage: false });
  }
  await page.goto('/index.html?concept=a');
  await page.locator('#mega-menu-trigger-company').click();
  await page.locator('#mega-menu-company a[href="#not-implemented"]').click();
  await expect(page.locator('[data-demo-notice]')).toBeVisible();
  await page.locator('[data-demo-notice-close]').click();
  await clean();
});

test('mobile A/B: contacts, drawer, drill-down, modal and overflow boundaries', async ({ page }) => {
  const clean = monitorRuntime(page);
  for (const width of [360, 390, 1279]) {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/catalog.html?concept=a');
    await noOverflow(page);
    await expect(page.locator('.mobile-header-actions a[href^="tel:"]')).toBeVisible();
    await expect(page.locator('.mobile-header-actions a[href^="mailto:"]')).toBeVisible();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/index.html?concept=a');
  await page.locator('[data-mobile-navigation-toggle]').click();
  await page.screenshot({ path: qa('a-mobile-root.png'), fullPage: false });
  await page.locator('[data-mobile-navigation-close]').click();
  await page.goto('/index.html?concept=b');
  await page.locator('[data-mobile-navigation-toggle]').click();
  await page.locator('[data-mobile-navigation-trigger]').first().click();
  await page.screenshot({ path: qa('b-mobile-nested.png'), fullPage: false });
  await page.keyboard.press('Escape');
  await page.keyboard.press('Escape');
  await noOverflow(page);
  await clean();
});
