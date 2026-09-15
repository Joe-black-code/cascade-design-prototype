import { expect, test } from '@playwright/test';

test('CP-2.1A: URL последовательно управляет концепцией между страницами', async ({ page }) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(`console.error: ${message.text()}`);
  });

  await page.goto('/index.html');
  await expect(page.locator('html')).toHaveAttribute('data-concept', 'a');
  expect(new URL(page.url()).search).toBe('');

  await page.goto('/index.html?concept=b');
  await expect(page.locator('html')).toHaveAttribute('data-concept', 'b');
  expect(new URL(page.url()).search).toBe('?concept=b');
  const catalogLink = page.locator('.home-products a[href*="catalog.html"]').first();
  await expect(catalogLink).toHaveAttribute('href', /catalog\.html\?concept=b/);
  await catalogLink.click();
  await expect(page).toHaveURL(/catalog\.html\?concept=b$/);
  await expect(page.locator('html')).toHaveAttribute('data-concept', 'b');

  await page.goto('/catalog.html?concept=a');
  await expect(page.locator('html')).toHaveAttribute('data-concept', 'a');
  expect(new URL(page.url()).search).toBe('?concept=a');

  await page.goto('/index.html?concept=test&campaign=demo');
  await expect(page.locator('html')).toHaveAttribute('data-concept', 'a');
  expect(new URL(page.url()).search).toBe('?concept=test&campaign=demo');
  expect(errors).toEqual([]);
});
