const { test, expect, seed, defaultEvent, defaultParticipant } = require('./fixtures');

async function openScanner(page, participants) {
  await seed(page, { events: [defaultEvent], participants });
  await page.goto('/');
  await page.getByText(defaultEvent.name).click();
  const scanBtn = page.locator('header').getByRole('button', { name: 'Escanear', exact: true });
  await expect(scanBtn).toBeVisible();
  await scanBtn.click();
  await page.locator('aside').getByText('Escanear', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Escanear Código', exact: true })).toBeVisible();
  return page.getByPlaceholder('Escanear o escribir código...');
}

test('entregar participante con el pago mínimo vía escáner (HU-G2)', async ({ page }) => {
  const paidParticipant = {
    ...defaultParticipant,
    id: 'part-2',
    name: 'Carlos Gómez',
    cedula: '200300400',
    paidAmount: 75000,
    paymentStatus: 'PAGO_PARCIAL',
  };

  const scannerInput = await openScanner(page, [paidParticipant]);

  await scannerInput.fill(paidParticipant.barcode);
  await expect(page.getByText('Carlos Gómez', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como Entregado' }).click();

  await expect(page.getByText('Entrega registrada')).toBeVisible();
});

test('bloquear entrega sin el pago mínimo (regla de negocio)', async ({ page }) => {
  const scannerInput = await openScanner(page, [defaultParticipant]);

  await scannerInput.fill(defaultParticipant.barcode);
  await expect(page.getByText('Ana Pérez', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como Entregado' }).click();

  await expect(page.getByText('Pago insuficiente')).toBeVisible();
  await expect(page.getByText('Debe tener al menos 50% pagado para entregar')).toBeVisible();
});