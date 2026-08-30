const { test, expect, seed } = require('./fixtures');

const openIncident = {
  id: 'inc-1',
  title: 'Reparar reflector principal',
  description: 'El reflector del estudio parpadea',
  type: 'EQUIPO_DANADO',
  status: 'ABIERTA',
  eventId: null,
  eventName: null,
  dueDate: '2026-09-10T10:00:00.000Z',
  createdAt: '2026-08-01T10:00:00.000Z',
  updatedAt: '2026-08-01T10:00:00.000Z',
};

async function goToAlerts(page) {
  await page.goto('/');
  await page.locator('aside').getByText('Alertas', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();
}

test('crear una incidencia desde la vista de Alertas', async ({ page }) => {
  await seed(page, { events: [], incidents: [] });
  await goToAlerts(page);

  await page.getByRole('button', { name: '+ Nueva incidencia' }).click();
  await expect(page.getByText('Nueva incidencia', { exact: true })).toBeVisible();

  await page.getByPlaceholder('Ej: Reparar reflector principal').fill('Comprar baterías de repuesto');
  await page.getByRole('button', { name: 'Guardar' }).click();

  await expect(page.getByText('Incidencia creada')).toBeVisible();
  await expect(page.getByPlaceholder('Ej: Reparar reflector principal')).toBeHidden();
});

test('resolver una incidencia existente', async ({ page }) => {
  await seed(page, { events: [], incidents: [openIncident] });
  await goToAlerts(page);

  await expect(page.getByText('Reparar reflector principal')).toBeVisible();
  await expect(page.getByText('1 abiertas')).toBeVisible();

  await page.getByTitle('Resolver').click();
  await expect(page.getByText('Incidencia resuelta')).toBeVisible();
});