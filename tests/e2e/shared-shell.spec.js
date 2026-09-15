import { test, expect } from '@playwright/test';
import { monitorRuntime } from './helpers.js';

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
}

test('desktop: общий shell концепций A и B', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const assertNoRuntimeErrors = monitorRuntime(page);
  for (const concept of ['a', 'b']) {
    await page.goto(`/index.html?concept=${concept}`);
    await expect(page.locator('html')).toHaveAttribute('data-concept', concept);
    for (const width of [1280, 1440, 1920]) {
      await page.setViewportSize({ width, height: 900 });
      await expect(page.locator('.desktop-navigation')).toBeVisible();
      await expectNoOverflow(page);
    }
    await page.setViewportSize({ width: 1440, height: 900 });
    const contacts = page.locator('.header-contacts a');
    await expect(contacts.nth(0)).toHaveAttribute('href', /^tel:/);
    await expect(contacts.nth(1)).toHaveAttribute('href', /^mailto:/);
    await page.locator('[data-mega-menu-trigger]').first().click();
    await expect(page.locator('#mega-menu-products')).toBeVisible();
    await expectNoOverflow(page);
    await page.keyboard.press('Escape');
    await page.locator('.header-estimate').click();
    const modal = page.locator('[data-modal]');
    await expect(modal).toBeVisible();
    const file = modal.getByLabel(/Прикрепить файл/);
    const longFileName = `${'длинное-имя-файла-'.repeat(4)}смета.pdf`;
    await file.setInputFiles({ name: longFileName, mimeType: 'application/pdf', buffer: Buffer.from('QA') });
    await expect(modal.locator('[data-file-name]')).toHaveText(longFileName);
    const clear = modal.getByRole('button', { name: 'Удалить выбранный файл' });
    await expect(clear).toBeVisible();
    await clear.click();
    await expect(file).toHaveValue('');
    await expect(clear).toBeHidden();
    await modal.locator('[data-modal-close]').click();
    await expect(page.locator('.site-footer')).toBeVisible();
    await page.locator('[data-mega-menu-trigger]').nth(3).click();
    await page.locator('#mega-menu-company a[href="#not-implemented"]').click();
    await expect(page.locator('[data-demo-notice]')).toBeVisible();
    await page.locator('[data-demo-notice-close]').click();
  }
  await assertNoRuntimeErrors();
});

test('mobile: actions, drawer и вложенный уровень концепций A и B', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 700 });
  const assertNoRuntimeErrors = monitorRuntime(page);
  for (const concept of ['a', 'b']) {
    await page.goto(`/catalog.html?concept=${concept}`);
    const actions = page.locator('.mobile-header-actions');
    for (const width of [360, 390, 1279]) {
      await page.setViewportSize({ width, height: 700 });
      await expect(actions).toBeVisible();
      await expectNoOverflow(page);
    }
    await page.setViewportSize({ width: 390, height: 700 });
    await expect(actions.locator('a[href^="tel:"]')).toBeVisible();
    await expect(actions.locator('a[href^="mailto:"]')).toBeVisible();
    for (const control of await actions.locator('.icon-control').all()) {
      const box = await control.boundingBox();
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
    await actions.locator('[data-mobile-navigation-toggle]').click();
    const drawer = page.locator('[data-mobile-navigation]');
    await expect(drawer).toBeVisible();
    await drawer.locator('[data-mobile-navigation-trigger]').first().click();
    await expect(drawer.locator('#mobile-products')).toBeVisible();
    await drawer.locator('[data-mobile-navigation-back]:visible').click();
    await drawer.locator('[data-modal-open]').click();
    await expect(page.locator('[data-modal]')).toBeVisible();
    await expectNoOverflow(page);
    await page.locator('[data-modal-close]').click();
    await expect(page.locator('.site-footer')).toBeAttached();
  }
  await assertNoRuntimeErrors();
});
