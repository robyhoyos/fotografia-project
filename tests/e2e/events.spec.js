const { test, expect, seed } = require('./fixtures');

test('crear un nuevo evento desde el botón "Nuevo Evento"', async ({ page }) => {
  await seed(page, { events: [] });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Gestión de Eventos' })).toBeVisible();

  await page.getByRole('button', { name: 'Nuevo Evento' }).click();

  const nameInput = page.getByPlaceholder('Ej: Primera Comunión San José').first();
  await expect(nameInput).toBeVisible();

  await nameInput.fill('Boda María y Juan');
  await page.getByPlaceholder('Parroquia, escuela, estudio...').first().fill('Parroquia San José');
  await page.getByPlaceholder('0.00').first().fill('150000');
  await page.locator('input[type="datetime-local"]').first().fill('2026-12-15T10:00');

  await page.getByRole('button', { name: 'Crear Evento' }).click();

  await expect(nameInput).toBeHidden();
});
