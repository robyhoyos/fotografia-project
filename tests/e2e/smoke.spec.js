const { test, expect, seed } = require('./fixtures');

async function loginAsAdmin(page) {
  await seed(page);
  await page.goto('/');
  // Primer arranque o sesión: por seguridad la app exige login. Con el mock
  // autenticamos como administrador para alcanzar el AppShell.
  const isLogin = page.getByRole('heading', { name: 'Acceso profesional' });
  if (await isLogin.isVisible().catch(() => false)) {
    await page.getByPlaceholder('nombre de usuario').fill('admin');
    await page.getByPlaceholder('••••••••').fill('e2e-password');
    await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  }
  await page.locator('aside').waitFor({ timeout: 10000 });
}

test('la aplicación carga y muestra el sidebar con las secciones principales', async ({ page }) => {
  await loginAsAdmin(page);
  for (const label of ['Eventos', 'Escanear', 'Dashboard', 'Alertas', 'Configuración']) {
    await expect(page.locator('aside').getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Gestión de Eventos' })).toBeVisible();
});

test('navegación entre secciones principales desde el sidebar', async ({ page }) => {
  await loginAsAdmin(page);
  const sidebar = page.locator('aside');

  await sidebar.getByText('Dashboard', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  await sidebar.getByText('Configuración', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

  await sidebar.getByText('Eventos', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Gestión de Eventos' })).toBeVisible();
});
