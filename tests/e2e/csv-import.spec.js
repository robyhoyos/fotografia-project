const { test, expect, seed, defaultEvent } = require('./fixtures');

const CSV = `nombre,cedula,telefono,email,cantidad
Juan Rodríguez,100200300,3001234567,juan@example.com,1
Ana Pérez,100200301,3112345678,ana@example.com,2
`;

test('importar participantes desde CSV (HU-D5)', async ({ page }) => {
  await seed(page, { events: [defaultEvent], participants: [] });
  await page.goto('/');
  await page.getByText(defaultEvent.name).click();
  await expect(page.getByRole('button', { name: 'Importar CSV' })).toBeVisible();

  await page.getByRole('button', { name: 'Importar CSV' }).click();
  await expect(page.getByRole('heading', { name: 'Importar CSV' })).toBeVisible();

  await page.locator('input[type="file"]').setInputFiles({
    name: 'participantes.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(CSV),
  });

  await expect(page.getByRole('button', { name: /Importar 2 participantes/ })).toBeVisible();
  await page.getByRole('button', { name: /Importar 2 participantes/ }).click();

  await expect(page.getByText('Importación completada', { exact: false }).first()).toBeVisible();
});
