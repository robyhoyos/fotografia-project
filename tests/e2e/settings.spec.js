const { test, expect, seed } = require('./fixtures');

const settings = [
  { key: 'business_name', value: 'Foto Estudio Andrés', category: 'negocio', label: 'Nombre del negocio', description: null },
  { key: 'business_tagline', value: 'Gestión Fotográfica', category: 'negocio', label: 'Eslogan', description: null },
  { key: 'default_event_category', value: 'SACRAMENTAL', category: 'eventos', label: 'Categoría de evento', description: null },
  { key: 'default_event_subtype', value: 'COMUNION', category: 'eventos', label: 'Subtipo de evento', description: null },
  { key: 'delivery_payment_threshold', value: '50', category: 'entregas', label: 'Umbral de entrega (%)', description: null },
];

async function goToSettings(page) {
  await page.goto('/');
  await page.locator('aside').getByText('Configuración', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
}

test('editar y guardar el nombre del negocio', async ({ page }) => {
  await seed(page, { events: [], settings });
  await goToSettings(page);

  const nameInput = page.getByText('Nombre del negocio', { exact: true }).locator('..').locator('input');
  await expect(nameInput).toBeVisible();

  await nameInput.fill('Foto Estudio Andrés E2E');
  await expect(page.getByText('Cambios sin guardar')).toBeVisible();

  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Configuración guardada')).toBeVisible();
});

test('avisar al intentar navegar con cambios sin guardar', async ({ page }) => {
  await seed(page, { events: [], settings });
  await goToSettings(page);

  await page.getByText('Nombre del negocio', { exact: true }).locator('..').locator('input').fill('Nombre sin guardar');
  await page.locator('aside').getByText('Eventos', { exact: true }).click();

  await expect(page.getByText('Tienes cambios sin guardar en Configuración. Si sales ahora, se perderán.')).toBeVisible();

  await page.getByRole('button', { name: 'Permanecer aquí' }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();
});