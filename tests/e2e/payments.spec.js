const { test, expect, seed, defaultEvent, defaultParticipant } = require('./fixtures');

async function openParticipantDetail(page, participant = defaultParticipant) {
  await seed(page, { events: [defaultEvent], participants: [participant] });
  await page.goto('/');
  await page.getByText(defaultEvent.name).click();
  await expect(page.getByRole('button', { name: 'Nuevo Participante', exact: true })).toBeVisible();

  const row = page.getByRole('row', { name: new RegExp(participant.name) });
  await expect(row).toBeVisible();
  await row.click();
  await expect(page.getByRole('heading', { name: 'Detalle del Participante' })).toBeVisible();
}

test('registrar un pago parcial desde el detalle del participante (HU-F1)', async ({ page }) => {
  await openParticipantDetail(page);

  // Estado de cuenta: total 150.000, sin pagos.
  await expect(page.getByText('SIN PAGO', { exact: true })).toBeVisible();

  const amountInput = page.getByPlaceholder('Monto del abono (COP)');
  await expect(amountInput).toBeVisible();
  await amountInput.fill('50000');

  await page.getByRole('button', { name: 'Registrar pago', exact: true }).click();
  await expect(amountInput).toHaveValue('');
});

test('generar recibo PDF desde el detalle del participante (HU-H1)', async ({ page }) => {
  await openParticipantDetail(page);

  await page.getByRole('button', { name: 'Generar recibo PDF' }).click();
  await expect(page.getByText('Recibo generado')).toBeVisible();
});