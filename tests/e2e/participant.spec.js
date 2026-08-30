const { test, expect, seed, defaultEvent, defaultParticipant } = require('./fixtures');

async function selectEvent(page, participants) {
  await seed(page, { events: [defaultEvent], participants });
  await page.goto('/');
  await expect(page.getByText(defaultEvent.name)).toBeVisible();
  await page.getByText(defaultEvent.name).click();
  await expect(page.getByRole('button', { name: 'Nuevo Participante', exact: true })).toBeVisible();
}

test('crear un participante con pago total (HU-D1 + HU-F1)', async ({ page }) => {
  await selectEvent(page, []);

  await page.getByRole('button', { name: 'Nuevo Participante', exact: true }).click();
  await expect(page.getByText('Nombre *', { exact: false })).toBeVisible();

  await page.getByText('Nombre *', { exact: false }).locator('..').locator('input').fill('Juan Rodríguez');
  await page.getByPlaceholder('Número de documento').fill('100200300');
  await page.getByPlaceholder('300 123 4567').fill('3001234567');

  await page.getByText('Pago total', { exact: false }).click();
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('Nombre *', { exact: false })).toBeHidden();
});

test('marcar entrega de participante (HU-G2)', async ({ page }) => {
  await selectEvent(page, [defaultParticipant]);

  const row = page.getByRole('row', { name: /Ana Pérez/ });
  await expect(row).toBeVisible();
  await row.locator('input[type="checkbox"]').check();

  await expect(page.getByRole('button', { name: 'Marcar Entregado' })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar Entregado' }).click();

  await expect(page.getByText('Estado actualizado', { exact: false })).toBeVisible();
});
