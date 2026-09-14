import { test, expect } from '@playwright/test';

test('мегаменю: четыре панели, клавиатура, внешнее закрытие и hover → click', async ({ page }) => {
  await page.goto('/index.html');
  const triggers = page.locator('[data-mega-menu-trigger]');
  await expect(triggers).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await triggers.nth(index).click();
    await expect(triggers.nth(index)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('[data-mega-menu-panel]:not([hidden])')).toHaveCount(1);
  }
  await page.mouse.click(1000, 900);
  await expect(page.locator('[data-mega-menu-panel]:not([hidden])')).toHaveCount(0);
  await triggers.first().focus();
  await page.keyboard.press('ArrowRight');
  await expect(triggers.nth(1)).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('[data-mega-menu-panel]:not([hidden]) a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(triggers.nth(1)).toBeFocused();
  await triggers.first().hover();
  await expect(triggers.first()).toHaveAttribute('aria-expanded', 'true');
  await triggers.first().click();
  await expect(triggers.first()).toHaveAttribute('aria-expanded', 'true');
  await triggers.first().click();
  await expect(triggers.first()).toHaveAttribute('aria-expanded', 'false');
});

test('мобильная drill-down-навигация: уровни, Escape, trap и сброс', async ({ page }) => {
  await page.goto('/catalog.html');
  const nav = page.locator('[data-mobile-navigation]');
  const toggle = page.locator('[data-mobile-navigation-toggle]');
  await toggle.click();
  await expect(nav).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/is-scroll-locked/);
  const sections = nav.locator('[data-mobile-navigation-trigger]');
  await expect(sections).toHaveCount(4);
  for (let index = 0; index < 4; index += 1) {
    await sections.nth(index).click();
    await expect(nav.locator('[data-mobile-navigation-level]:not([hidden])')).toHaveCount(1);
    await nav.getByRole('button', { name: 'Назад' }).click();
    await expect(sections.nth(index)).toBeFocused();
  }
  await sections.first().click();
  await page.keyboard.press('Escape');
  await expect(sections.first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(nav).toBeHidden();
  await expect(toggle).toBeFocused();
  await toggle.click();
  await page.keyboard.press('Shift+Tab');
  await expect(nav.locator(':focus')).toHaveCount(1);
  await nav.locator('[data-mobile-navigation-close]').click();
  await expect(page.locator('body')).not.toHaveClass(/is-scroll-locked/);
});

test('открытие мобильной навигации закрывает остальные компоненты', async ({ page }) => {
  await page.goto('/index.html');
  await page.locator('[data-modal-open]').first().click();
  await page.locator('[data-mobile-navigation-toggle]').evaluate((button) => button.click());
  await expect(page.locator('[data-modal]')).toBeHidden();
  await expect(page.locator('[data-mobile-navigation]')).toBeVisible();
});
