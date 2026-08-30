const { test, expect, seed, defaultEvent } = require('./fixtures');

async function selectFirstEvent(page) {
  await page.goto('/');
  await expect(page.getByText(defaultEvent.name)).toBeVisible();
  await page.getByText(defaultEvent.name).click();
  await expect(page.getByRole('button', { name: 'Nuevo Participante', exact: true })).toBeVisible();
}

test('cambiar el estado del evento a Finalizado (HU-B2)', async ({ page }) => {
  await seed(page, { events: [defaultEvent] });
  await selectFirstEvent(page);

  await page.getByRole('button', { name: 'Finalizado' }).click();
  await expect(page.getByText('Cambiar a finalizado', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar' }).click();

  await expect(page.getByText('Estado actualizado', { exact: false })).toBeVisible();
});

test('exportar el evento a Excel (HU-I1)', async ({ page }) => {
  await seed(page, { events: [defaultEvent], participants: [] });
  await selectFirstEvent(page);

  await page.getByRole('button', { name: 'Exportar Excel' }).click();
  await expect(page.getByText('Exportado', { exact: true })).toBeVisible();
});

test('editar un evento (HU-B2)', async ({ page }) => {
  await seed(page, { events: [defaultEvent], participants: [] });
  await page.goto('/');
  await expect(page.getByText(defaultEvent.name)).toBeVisible();

  await page.getByTitle('Editar').click();
  await expect(page.getByRole('heading', { name: 'Editar Evento' })).toBeVisible();

  await page.getByPlaceholder('Ej: Primera Comunión San José').first().fill('Boda María y Juan Actualizada');
  await page.getByRole('button', { name: 'Guardar Cambios' }).click();

  await expect(page.getByRole('heading', { name: 'Editar Evento' })).toBeHidden();
});
