import { test, expect } from '@playwright/test';
import { monitorRuntime } from './helpers.js';

for (const path of ['/index.html', '/catalog.html']) {
  test(`модалка: CTA, состояния и способы закрытия — ${path}`, async ({ page }) => {
    const clean = monitorRuntime(page);
    await page.goto(path);
    const modal = page.locator('[data-modal]');
    const triggers = page.locator('[data-modal-open="estimate-modal"]:visible');
    const count = await triggers.count();
    expect(count).toBeGreaterThanOrEqual(2);
    for (let index = 0; index < count; index += 1) {
      const trigger = triggers.nth(index);
      await trigger.click();
      await expect(modal).toHaveAttribute('aria-hidden', 'false');
      await expect(page.locator('body')).toHaveClass(/is-scroll-locked/);
      await expect(modal.locator('[data-modal-dialog]')).toContainText('Запросить расчёт');
      await expect(modal.locator(':focus')).toHaveCount(1);
      await page.keyboard.press('Escape');
      await expect(modal).toBeHidden();
      await expect(trigger).toBeFocused();
    }
    await triggers.first().click();
    await modal.locator('[data-modal-dialog]').click();
    await expect(modal).toBeVisible();
    await modal.locator('[data-modal-close]').click();
    await triggers.first().click();
    await modal.click({ position: { x: 1, y: 1 } });
    await expect(modal).toBeHidden();
    await clean();
  });
}

test('модалка удерживает фокус и безопасно открывается из мобильной панели', async ({ page }) => {
  await page.goto('/index.html');
  const modal = page.locator('[data-modal]');
  await page.locator('[data-mobile-navigation-toggle]').click();
  await page.locator('[data-mobile-navigation] [data-modal-open]').click();
  await expect(page.locator('[data-mobile-navigation]')).toBeHidden();
  await expect(modal).toBeVisible();
  const first = modal.getByRole('button', { name: 'Закрыть окно запроса расчёта' });
  await expect(first).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(modal.locator(':focus')).toHaveCount(1);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-mobile-navigation-toggle]')).toBeFocused();
  await expect(page.locator('body')).not.toHaveClass(/is-scroll-locked/);
});
