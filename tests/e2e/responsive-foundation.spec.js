import { expect, test } from '@playwright/test';
import { monitorRuntime } from './helpers.js';

const cases = [
  { width: 360, columns: 4 },
  { width: 390, columns: 4 },
  { width: 768, columns: 8 },
  { width: 1024, columns: 8 },
  { width: 1440, columns: 12 },
  { width: 1920, columns: 12 },
];

test('responsive-фундамент обеих страниц на контрольных ширинах', async ({ page }) => {
  const assertNoRuntimeErrors = monitorRuntime(page);

  for (const path of ['/index.html', '/catalog.html']) {
    for (const { width, columns } of cases) {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(path);

      const metrics = await page.evaluate(() => {
        const root = document.documentElement;
        const containers = [...document.querySelectorAll('.layout-container')]
          .map((container) => container.getBoundingClientRect())
          .map(({ left, right, width }) => ({ left, right, width }));
        const shells = [...document.querySelectorAll('header, main, footer')]
          .map((shell) => shell.getBoundingClientRect())
          .map(({ left, right }) => ({ left, right }));
        const overlaysAreLimited = [...document.querySelectorAll('[data-mega-menu-panel], [data-mobile-navigation], [data-modal], [data-demo-notice]')]
          .some((overlay) => overlay.closest('.layout-container'));

        return {
          clientWidth: root.clientWidth,
          scrollWidth: root.scrollWidth,
          columns: Number.parseInt(getComputedStyle(root).getPropertyValue('--layout-columns'), 10),
          containers,
          overlaysAreLimited,
          shells,
        };
      });

      expect(metrics.scrollWidth, `${path}, ${width}px: горизонтальное переполнение`).toBeLessThanOrEqual(metrics.clientWidth + 1);
      expect(metrics.containers, `${path}, ${width}px: layout-контейнеры отсутствуют`).not.toHaveLength(0);
      for (const container of metrics.containers) {
        expect(container.left).toBeGreaterThanOrEqual(-1);
        expect(container.right).toBeLessThanOrEqual(metrics.clientWidth + 1);
        expect(Math.abs(container.left - (metrics.clientWidth - container.right))).toBeLessThanOrEqual(1);
      }
      for (const shell of metrics.shells) {
        expect(shell.left).toBeGreaterThanOrEqual(-1);
        expect(shell.right).toBeGreaterThanOrEqual(metrics.clientWidth - 1);
      }
      expect(metrics.overlaysAreLimited, `${path}, ${width}px: overlay вложен в layout-container`).toBe(false);
      expect(metrics.columns, `${path}, ${width}px: неверное число колонок`).toBe(columns);
    }
  }

  await assertNoRuntimeErrors();
});
