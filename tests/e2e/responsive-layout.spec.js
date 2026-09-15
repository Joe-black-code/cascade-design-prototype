import { expect, test } from '@playwright/test';
import { monitorRuntime } from './helpers.js';

const widths = [360, 390, 768, 1024, 1440, 1920];
const expected = {
  '.product-list': [2, 2, 2, 2, 4, 4],
  '.solution-list': [1, 1, 2, 2, 3, 3],
  '.link-list': [1, 1, 2, 2, 4, 4],
  '.project-list:not([hidden])': [1, 1, 2, 2, 2, 2],
  '.fact-list': [1, 1, 2, 2, 4, 4],
};

function columns(style) {
  return style.gridTemplateColumns.split(' ').filter(Boolean).length;
}

test('переключение и responsive-синхронизация навигации', async ({ page }) => {
  const assertNoRuntimeErrors = monitorRuntime(page);
  await page.setViewportSize({ width: 1024, height: 800 });
  await page.goto('/index.html');
  await expect(page.locator('.desktop-navigation')).toBeHidden();
  await expect(page.locator('[data-mobile-navigation-toggle]')).toBeVisible();
  await page.locator('[data-mobile-navigation-toggle]').click();
  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('[data-mobile-navigation]')).toBeHidden();
  await expect(page.locator('body')).not.toHaveClass(/is-scroll-locked/);
  await expect(page.locator('.desktop-navigation')).toBeVisible();
  await expect(page.locator('[data-mobile-navigation-toggle]')).toBeHidden();
  expect(await page.evaluate(() => document.activeElement?.closest('[hidden]') === null)).toBe(true);

  const trigger = page.locator('[data-mega-menu-trigger]').first();
  await trigger.click();
  await page.locator('#mega-menu-products a').first().focus();
  await page.setViewportSize({ width: 1024, height: 800 });
  await expect(page.locator('#mega-menu-products')).toBeHidden();
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  expect(await page.evaluate(() => document.activeElement?.closest('[hidden]') === null)).toBe(true);
  await assertNoRuntimeErrors();
});

test('композиции Главной и Каталога на контрольных ширинах', async ({ page }) => {
  const assertNoRuntimeErrors = monitorRuntime(page);
  for (const [index, width] of widths.entries()) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/index.html');
    const result = await page.evaluate(({ expectedSelectors }) => {
      const sectionShells = [...document.querySelectorAll('main > section')];
      return {
        overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        fullWidth: sectionShells.every((node) => node.getBoundingClientRect().width >= document.documentElement.clientWidth - 1),
        contained: sectionShells.every((node) => {
          const rect = node.querySelector(':scope > .layout-container')?.getBoundingClientRect();
          return rect && rect.left >= -1 && rect.right <= document.documentElement.clientWidth + 1;
        }),
        columns: Object.fromEntries(expectedSelectors.map((selector) => [selector, getComputedStyle(document.querySelector(selector)).gridTemplateColumns.split(' ').filter(Boolean).length])),
      };
    }, { expectedSelectors: Object.keys(expected) });
    expect(result.overflow, `${width}px: overflow Главной`).toBeLessThanOrEqual(1);
    expect(result.fullWidth).toBe(true);
    expect(result.contained).toBe(true);
    for (const [selector, values] of Object.entries(expected)) expect(result.columns[selector], `${width}px: ${selector}`).toBe(values[index]);

    await page.goto('/catalog.html');
    const catalog = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      columns: getComputedStyle(document.querySelector('.category-list')).gridTemplateColumns.split(' ').filter(Boolean).length,
    }));
    expect(catalog.overflow, `${width}px: overflow Каталога`).toBeLessThanOrEqual(1);
    expect(catalog.columns).toBe([2, 2, 2, 2, 4, 4][index]);
  }
  await page.setViewportSize({ width: 1080, height: 1000 });
  await page.goto('/catalog.html');
  expect(await page.locator('.category-list').evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(' ').filter(Boolean).length)).toBe(3);
  await assertNoRuntimeErrors();
});

test('overlay-компоненты помещаются в компактный viewport', async ({ page }) => {
  const assertNoRuntimeErrors = monitorRuntime(page);
  for (const viewport of [{ width: 360, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(viewport);
    await page.goto('/index.html');
    await page.locator('[data-mobile-navigation-toggle]').click();
    await expect(page.locator('[data-mobile-navigation]')).toBeInViewport();
    expect(await page.locator('[data-mobile-navigation]').evaluate((node) => getComputedStyle(node).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    await page.locator('[data-mobile-navigation-close]').click();
    await expect(page.locator('body')).not.toHaveClass(/is-scroll-locked/);
    await page.locator('main [data-modal-open]').first().click();
    await expect(page.locator('[data-modal-dialog]')).toBeInViewport();
    await page.locator('[data-modal-close]').click();
    await page.locator('main a[href="#not-implemented"]').first().click();
    await expect(page.locator('[data-demo-notice]')).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  }
  await assertNoRuntimeErrors();
});
