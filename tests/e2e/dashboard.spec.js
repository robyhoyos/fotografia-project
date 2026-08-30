const { test, expect, seed, defaultEvent, defaultParticipant } = require('./fixtures');

test('dashboard muestra los KPIs con datos sembrados', async ({ page }) => {
  await seed(page, { events: [defaultEvent], participants: [defaultParticipant] });
  await page.goto('/');
  await page.locator('aside').getByText('Dashboard', { exact: true }).click();

  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  // KPIs grandes (Total Eventos, Participantes, Cobrado, Por Cobrar)
  const kpis = page.locator('p.font-bold.text-3xl');
  await expect(kpis).toHaveCount(4);
  await expect(kpis.nth(0)).toHaveText('1'); // Total Eventos
  await expect(kpis.nth(1)).toHaveText('1'); // Participantes
  await expect(kpis.nth(3)).toHaveText('$150.000'); // Por Cobrar
});

test('dashboard lista los últimos eventos y permite navegar a ellos', async ({ page }) => {
  await seed(page, { events: [defaultEvent], participants: [defaultParticipant] });
  await page.goto('/');
  await page.locator('aside').getByText('Dashboard', { exact: true }).click();

  await expect(page.getByText('Últimos Eventos')).toBeVisible();
  await expect(page.getByRole('cell', { name: defaultEvent.name, exact: false })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Sacramental', exact: true })).toBeVisible();

  await page.getByRole('cell', { name: defaultEvent.name, exact: false }).click();
  await expect(page.getByRole('button', { name: 'Nuevo Participante', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: new RegExp(defaultEvent.name) }).first()).toBeVisible();
});