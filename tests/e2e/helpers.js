import { expect } from '@playwright/test';

export function monitorRuntime(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });
  return async () => expect(errors).toEqual([]);
}

export async function fillValidForm(form) {
  await form.getByLabel('Ваше имя или компания').fill('ООО Тест');
  await form.getByLabel('Телефон для связи').fill('+7 (999) 123-45-67');
  await form.getByLabel(/Я даю согласие/).check();
}
