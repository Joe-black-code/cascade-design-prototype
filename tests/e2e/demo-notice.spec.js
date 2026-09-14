import { test, expect } from '@playwright/test';
import { monitorRuntime } from './helpers.js';

test('контентная заглушка сохраняет URL, показывает строгий UTF-8 текст и возвращает фокус', async ({ page }) => {
  const clean = monitorRuntime(page);
  await page.goto('/catalog.html');
  const initialUrl = page.url();
  const link = page.locator('main a[href="#not-implemented"]').first();
  const name = (await link.textContent()).replace(/[→←]+\s*$/, '').trim();
  await link.click();
  const notice = page.locator('[data-demo-notice]');
  await expect(notice).toBeVisible();
  await expect(notice.locator('[data-demo-notice-message]')).toHaveText(`Раздел „${name}“ пока не входит в демонстрационный макет.`);
  await expect(notice).not.toContainText('\uFFFD');
  expect(page.url()).toBe(initialUrl);
  await notice.locator('[data-demo-notice-close]').focus();
  await page.keyboard.press('Escape');
  await expect(link).toBeFocused();
  await clean();
});

test('заглушка из мегаменю закрывает панель и безопасно восстанавливает фокус', async ({ page }) => {
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'О компании', exact: true }).first().click();
  await page.locator('#mega-menu-company a[href="#not-implemented"]').click();
  await expect(page.locator('#mega-menu-company')).toBeHidden();
  await expect(page.locator('[data-demo-notice-message]')).toHaveText('Раздел „О заводе“ пока не входит в демонстрационный макет.');
  await page.locator('[data-demo-notice-close]').click();
  await expect(page.getByRole('button', { name: 'О компании', exact: true }).first()).toBeFocused();
});

test('заглушка из мобильной навигации закрывает overlay и не оставляет скрытый фокус', async ({ page }) => {
  await page.goto('/index.html');
  const initialUrl = page.url();
  await page.locator('[data-mobile-navigation-toggle]').click();
  await page.locator('[data-mobile-navigation-trigger]', { hasText: 'О компании' }).click();
  await page.locator('#mobile-company a[href="#not-implemented"]').click();
  await expect(page.locator('[data-mobile-navigation]')).toBeHidden();
  expect(page.url()).toBe(initialUrl);
  await page.locator('[data-demo-notice-close]').click();
  await expect(page.locator('[data-mobile-navigation-toggle]')).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/is-scroll-locked/);
});

test('страницы не используют запрещённые runtime-механизмы', async ({ page }) => {
  for (const path of ['/index.html', '/catalog.html']) {
    await page.addInitScript(() => {
      window.alert = () => { throw new Error('alert запрещён'); };
      window.fetch = () => { throw new Error('fetch запрещён'); };
      window.XMLHttpRequest = class { constructor() { throw new Error('XHR запрещён'); } };
    });
    await page.goto(path);
    await expect(page.locator('main')).toBeVisible();
  }
});
