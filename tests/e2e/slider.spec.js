import { test, expect } from '@playwright/test';

test('слайдер: границы, состояния, кнопки и клавиатура', async ({ page }) => {
  await page.goto('/index.html');
  const slider = page.locator('[data-projects-slider]');
  const previous = slider.locator('[data-projects-slider-previous]');
  const next = slider.locator('[data-projects-slider-next]');
  await expect(slider.locator('[data-projects-slider-current]')).toHaveText('01');
  await expect(slider.locator('[data-projects-slider-total]')).toHaveText('03');
  await expect(slider.locator('[data-projects-slider-group]:not([hidden])')).toHaveCount(1);
  await expect(previous).toBeDisabled();
  await next.focus();
  await next.click();
  await expect(next).toBeFocused();
  await next.click();
  await expect(next).toBeDisabled();
  await expect(slider).toHaveAttribute('data-state', 'end');
  await previous.focus();
  await page.keyboard.press('Home');
  await expect(slider).toHaveAttribute('data-active-index', '0');
  await next.focus();
  await page.keyboard.press('End');
  await expect(slider).toHaveAttribute('data-active-index', '2');
  await previous.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(slider).toHaveAttribute('data-state', 'middle');
  const groups = slider.locator('[data-projects-slider-group]');
  await expect(groups.nth(1)).toHaveAttribute('aria-hidden', 'false');
  await expect(groups.nth(0)).toHaveAttribute('aria-hidden', 'true');
});

test('слайдер игнорирует стрелки из редактируемых элементов', async ({ page }) => {
  await page.goto('/index.html');
  const slider = page.locator('[data-projects-slider]');
  await slider.evaluate((element) => {
    const input = document.createElement('input');
    input.dataset.testSliderInput = '';
    element.append(input);
    input.focus();
  });
  await page.keyboard.press('ArrowRight');
  await expect(slider).toHaveAttribute('data-active-index', '0');
});
