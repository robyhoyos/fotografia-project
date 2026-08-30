// tests/e2e-real/real.spec.js
// Smoke tests contra la app real: IPC real → Service → Repository → SQLite.
// No se stubea `window.api`: cada acción verifica la persistencia real en la
// BD de prueba (prisma/test-e2e.db) consultada desde Node con PrismaClient.
const { test, expect, TEST_DB_URL } = require('./fixture');
const { PrismaClient } = require('@prisma/client');

async function testDb() {
  const prisma = new PrismaClient({ datasources: { db: { url: TEST_DB_URL } } });
  await prisma.$connect();
  return prisma;
}

test('crear un evento desde la UI persiste en la base de datos real', async ({ realApp }) => {
  const { page } = realApp;

  await page.getByRole('button', { name: 'Nuevo Evento' }).click();
  await page.getByPlaceholder('Ej: Primera Comunión San José').first().fill('Boda María y Juan');
  await page.getByPlaceholder('Parroquia, escuela, estudio...').first().fill('Parroquia San José');
  await page.getByPlaceholder('0.00').first().fill('150000');
  await page.locator('input[type="datetime-local"]').first().fill('2026-12-15T10:00');
  await page.getByRole('button', { name: 'Crear Evento' }).click();

  await expect(page.getByText('"Boda María y Juan" se registró correctamente')).toBeVisible();

  const prisma = await testDb();
  const total = await prisma.event.count();
  const created = await prisma.event.findFirst({ where: { name: 'Boda María y Juan' } });
  await prisma.$disconnect();

  expect(total).toBe(1);
  expect(created).not.toBeNull();
  expect(created.coverPrice).toBe(150000);
  expect(created.category).toBe('SACRAMENTAL');
});

test('la app inicializa la configuración por defecto en la base de datos real', async ({ realApp }) => {
  const prisma = await testDb();
  const settings = await prisma.setting.findMany();
  await prisma.$disconnect();

  const businessName = settings.find((s) => s.key === 'business_name');
  expect(businessName).toBeTruthy();
  expect(businessName.value).toBe('FotoApp');
  expect(settings.length).toBeGreaterThanOrEqual(10);
});