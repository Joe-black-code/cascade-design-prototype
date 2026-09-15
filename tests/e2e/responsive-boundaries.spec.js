import { expect, test } from '@playwright/test';
import { monitorRuntime } from './helpers.js';

const checkpoints = [
  { width: 360, columns: 4, catalogColumns: 2 },
  { width: 390, columns: 4, catalogColumns: 2 },
  { width: 767, columns: 4, catalogColumns: 2 },
  { width: 768, columns: 8, catalogColumns: 2 },
  { width: 1024, columns: 8, catalogColumns: 2 },
  { width: 1079, columns: 8, catalogColumns: 2 },
  { width: 1080, columns: 12, catalogColumns: 3 },
  { width: 1439, columns: 12, catalogColumns: 3 },
  { width: 1440, columns: 12, catalogColumns: 4 },
  { width: 1920, columns: 12, catalogColumns: 4 },
];

const columnCount = (value) => value.split(' ').filter(Boolean).length;

test('CP-1.3C: основные и граничные ширины проходят последовательно', async ({ page }) => {
  const assertNoRuntimeErrors = monitorRuntime(page);

  for (const { width, columns, catalogColumns } of checkpoints) {
    await page.setViewportSize({ width, height: 1000 });

    for (const path of ['/index.html', '/catalog.html']) {
      await page.goto(path);
      const geometry = await page.evaluate(() => {
        const root = document.documentElement;
        const bodyRect = document.body.getBoundingClientRect();
        const visible = (node) => !node.closest('[hidden]') && getComputedStyle(node).display !== 'none';
        const outsideParent = [...document.querySelectorAll('button, input, .content-card')]
          .filter(visible)
          .some((node) => {
            const rect = node.getBoundingClientRect();
            const parent = node.parentElement?.getBoundingClientRect();
            return parent && (rect.left < parent.left - 1 || rect.right > parent.right + 1);
          });

        return {
          bodyWidth: bodyRect.width,
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          columns: Number.parseInt(getComputedStyle(root).getPropertyValue('--layout-columns'), 10),
          nestedContainers: document.querySelectorAll('.layout-container .layout-container').length,
          outsideParent,
          containersFit: [...document.querySelectorAll('.layout-container')].filter(visible).every((node) => {
            const rect = node.getBoundingClientRect();
            return rect.left >= -1 && rect.right <= root.clientWidth + 1;
          }),
          sectionsAreFullWidth: [...document.querySelectorAll('main > section')].every((node) => node.getBoundingClientRect().width >= root.clientWidth - 1),
        };
      });

      expect(geometry.scrollWidth, `${path} @ ${width}px: document overflow`).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.bodyWidth, `${path} @ ${width}px: body шире viewport`).toBeLessThanOrEqual(geometry.clientWidth + 1);
      expect(geometry.columns, `${path} @ ${width}px: глобальная сетка`).toBe(columns);
      expect(geometry.nestedContainers, `${path} @ ${width}px: вложенный контейнер`).toBe(0);
      expect(geometry.containersFit, `${path} @ ${width}px: контейнер вне viewport`).toBe(true);
      expect(geometry.sectionsAreFullWidth, `${path} @ ${width}px: section не полноширинная`).toBe(true);
      expect(geometry.outsideParent, `${path} @ ${width}px: control/card вне родителя`).toBe(false);

      if (path === '/catalog.html') {
        const catalog = await page.locator('.category-list').evaluate((list) => ({
          columns: getComputedStyle(list).gridTemplateColumns,
          autoFlow: getComputedStyle(list).gridAutoFlow,
          itemWidths: [...list.children].map((item) => item.getBoundingClientRect().width),
          visualOrder: [...list.children].map((item) => item.getBoundingClientRect()).map(({ top, left }) => ({ top, left })),
        }));
        expect(columnCount(catalog.columns), `Каталог @ ${width}px`).toBe(catalogColumns);
        expect(catalog.autoFlow).not.toContain('dense');
        expect(Math.max(...catalog.itemWidths) - Math.min(...catalog.itemWidths)).toBeLessThanOrEqual(1);
        for (let index = 1; index < catalog.visualOrder.length; index += 1) {
          const previous = catalog.visualOrder[index - 1];
          const current = catalog.visualOrder[index];
          expect(current.top > previous.top - 1 || current.left > previous.left).toBe(true);
        }
      }
    }
  }

  await assertNoRuntimeErrors();
});

test('CP-2.1A: header переключается точно на 1280px без пересечений', async ({ page }) => {
  const assertNoRuntimeErrors = monitorRuntime(page);
  await page.goto('/index.html');

  await page.setViewportSize({ width: 1279, height: 800 });
  await expect(page.locator('.desktop-navigation')).toBeHidden();
  await expect(page.locator('.header-contacts')).toBeHidden();
  await expect(page.locator('.header-inner > [data-modal-open]')).toBeHidden();
  await expect(page.locator('[data-mobile-navigation-toggle]')).toBeVisible();
  expect(await page.locator('.desktop-navigation, .header-contacts, .header-inner > [data-modal-open]').evaluateAll((nodes) => nodes.every((node) => node.getClientRects().length === 0))).toBe(true);

  await page.setViewportSize({ width: 1280, height: 800 });
  await expect(page.locator('.desktop-navigation')).toBeVisible();
  await expect(page.locator('.header-contacts')).toBeVisible();
  await expect(page.locator('.header-inner > [data-modal-open]')).toBeVisible();
  await expect(page.locator('[data-mobile-navigation-toggle]')).toBeHidden();
  await expect(page.locator('[data-mega-menu-trigger]')).toHaveCount(4);
  expect(await page.locator('.header-inner > *:not([hidden])').evaluateAll((nodes) => nodes.filter((node) => getComputedStyle(node).display !== 'none').every((node, index, visible) => {
    const rect = node.getBoundingClientRect();
    return visible.slice(index + 1).every((other) => {
      const otherRect = other.getBoundingClientRect();
      return rect.right <= otherRect.left + 1 || otherRect.right <= rect.left + 1 || rect.bottom <= otherRect.top + 1 || otherRect.bottom <= rect.top + 1;
    });
  }))).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1)).toBe(true);
  await assertNoRuntimeErrors();
});

test('CP-1.3C: footer сохраняет порядок и 1/2/многоколоночную структуру', async ({ page }) => {
  const assertNoRuntimeErrors = monitorRuntime(page);
  for (const [width, expectedColumns] of [[360, 1], [768, 2], [1440, 12]]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/index.html');
    const footer = await page.locator('.site-footer').evaluate((node) => ({
      columns: getComputedStyle(node.querySelector('.footer-primary')).gridTemplateColumns,
      firstId: node.querySelector('.footer-primary > :first-child')?.id,
      fullWidth: node.getBoundingClientRect().width,
      overflow: node.scrollWidth - node.clientWidth,
    }));
    expect(columnCount(footer.columns)).toBe(expectedColumns);
    expect(footer.firstId).toBe('contacts');
    expect(footer.fullWidth).toBeGreaterThanOrEqual(width - 1);
    expect(footer.overflow).toBeLessThanOrEqual(1);
  }
  await assertNoRuntimeErrors();
});
