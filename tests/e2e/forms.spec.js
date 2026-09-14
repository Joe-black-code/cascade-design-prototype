import { test, expect } from '@playwright/test';
import { fillValidForm } from './helpers.js';

for (const path of ['/index.html', '/catalog.html']) {
  test(`форма: валидация, файл, локальная отправка и повтор — ${path}`, async ({ page }) => {
    await page.goto(path);
    const requests = [];
    page.on('request', (request) => requests.push(request.url()));
    const initialUrl = page.url();
    if (path === '/catalog.html') await page.locator('[data-modal-open]').first().click();
    const form = page.locator('[data-estimate-form]:visible').first();
    await form.locator('[data-estimate-submit]').click();
    await expect(form.getByLabel('Ваше имя или компания')).toBeFocused();
    await expect(form.getByLabel('Ваше имя или компания')).toHaveAttribute('aria-invalid', 'true');
    await form.getByLabel('Ваше имя или компания').fill('Тест');
    await expect(form.getByLabel('Ваше имя или компания')).not.toHaveAttribute('aria-invalid', 'true');
    for (const phone of ['123', '+1234567890123456']) {
      await form.getByLabel('Телефон для связи').fill(phone);
      await form.locator('[data-estimate-submit]').click();
      await expect(form.getByLabel('Телефон для связи')).toHaveAttribute('aria-invalid', 'true');
    }
    await fillValidForm(form);
    await form.getByLabel(/Прикрепить файл/).setInputFiles('tests/fixtures/brief.pdf');
    await expect(form.locator('[data-file-name]')).toHaveText('brief.pdf');
    await form.locator('[data-estimate-submit]').click();
    await expect(form).toHaveAttribute('data-form-state', 'submitting');
    await expect(form.locator('[data-estimate-submit]')).toBeDisabled();
    await expect(form).toHaveAttribute('data-form-state', 'success');
    expect(page.url()).toBe(initialUrl);
    expect(requests).toEqual([]);
    await form.locator('[data-estimate-retry]').click();
    await expect(form).toHaveAttribute('data-form-state', 'idle');
    await expect(form.getByLabel('Ваше имя или компания')).toHaveValue('');
  });
}

test('модальная форма сохраняет черновик, сбрасывает success и безопасно закрывается', async ({ page }) => {
  await page.goto('/index.html');
  const modal = page.locator('[data-modal]');
  const form = modal.locator('[data-estimate-form]');
  await page.locator('[data-modal-open]').first().click();
  await form.getByLabel('Ваше имя или компания').fill('Черновик');
  await modal.locator('[data-modal-close]').click();
  await page.locator('[data-modal-open]').first().click();
  await expect(form.getByLabel('Ваше имя или компания')).toHaveValue('Черновик');
  await fillValidForm(form);
  await form.locator('[data-estimate-submit]').click();
  await modal.locator('[data-modal-close]').click();
  await expect(modal).toBeHidden();
  await page.waitForTimeout(750);
  await page.locator('[data-modal-open]').first().click();
  await expect(form).toHaveAttribute('data-form-state', 'idle');
});
