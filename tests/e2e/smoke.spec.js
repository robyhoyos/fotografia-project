const { test, expect } = require('./fixtures');

test('la aplicación carga y muestra el sidebar con las secciones principales', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('aside')).toBeVisible();
  for (const label of ['Eventos', 'Escanear', 'Dashboard', 'Alertas', 'Configuración']) {
    await expect(page.locator('aside').getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Gestión de Eventos' })).toBeVisible();
});

test('navegación entre secciones principales desde el sidebar', async ({ page }) => {
  await page.goto('/');
  const sidebar = page.locator('aside');

  await sidebar.getByText('Dashboard', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await sidebar.getByText('Configuración', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

  await sidebar.getByText('Eventos', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gestión de Eventos' })).toBeVisible();
});
