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

// ─── Helpers ────────────────────────────────────────────────────────────
async function createEventViaUi(page, name) {
  await page.getByRole('button', { name: 'Nuevo Evento' }).click();
  await page.getByPlaceholder('Ej: Primera Comunión San José').first().fill(name);
  await page.getByPlaceholder('Parroquia, escuela, estudio...').first().fill('Parroquia San José');
  await page.getByPlaceholder('0.00').first().fill('150000');
  await page.locator('input[type="datetime-local"]').first().fill('2026-12-15T10:00');
  await page.getByRole('button', { name: 'Crear Evento' }).click();
  await expect(page.getByText(`"${name}" se registró correctamente`)).toBeVisible();
}

async function openEvent(page, name) {
  await page.getByText(name, { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Nuevo Participante', exact: true })).toBeVisible();
}

// payment: 'SIN_PAGO' (default) | 'PAGO_TOTAL'
async function createParticipant(page, { name, cedula, phone, payment = 'SIN_PAGO' }) {
  await page.getByRole('button', { name: 'Nuevo Participante', exact: true }).click();
  await expect(page.getByText('Nombre *', { exact: false })).toBeVisible();
  await page.getByText('Nombre *', { exact: false }).locator('..').locator('input').fill(name);
  await page.getByPlaceholder('Número de documento').fill(cedula);
  await page.getByPlaceholder('300 123 4567').fill(phone);
  if (payment === 'PAGO_TOTAL') {
    await page.getByText('Pago total', { exact: false }).click();
  }
  await page.getByRole('button', { name: 'Guardar' }).click();
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

test('crear un participante con pago total persiste en la base de datos real', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Primera Comunión Elena';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);
  await createParticipant(page, {
    name: 'Juan Rodríguez',
    cedula: '100200300',
    phone: '3001234567',
    payment: 'PAGO_TOTAL',
  });

  await expect(page.getByText('Participante y pago registrado')).toBeVisible();

  const prisma = await testDb();
  const event = await prisma.event.findFirst({ where: { name: eventName } });
  const participant = await prisma.participant.findFirst({
    where: { name: 'Juan Rodríguez' },
  });
  const payments = participant
    ? await prisma.payment.findMany({ where: { participantId: participant.id } })
    : [];
  await prisma.$disconnect();

  expect(event).not.toBeNull();
  expect(participant).not.toBeNull();
  expect(participant.eventId).toBe(event.id);
  expect(participant.cedula).toBe('100200300');
  expect(participant.phone).toBe('3001234567');
  expect(participant.status).toBe('PENDIENTE');
  expect(participant.quantity).toBe(1);
  expect(participant.unitPrice).toBe(150000);
  expect(participant.totalAmount).toBe(150000);
  expect(participant.paidAmount).toBe(150000);
  expect(participant.paymentStatus).toBe('PAGO_TOTAL');
  expect(participant.barcode).toBeTruthy();

  expect(payments).toHaveLength(1);
  expect(payments[0].amount).toBe(150000);
  expect(payments[0].notes).toBe('Pago total al crear participante');
});

test('registrar un abono desde el detalle persiste en la base de datos real', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Grado Daniela';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);
  await createParticipant(page, {
    name: 'María López',
    cedula: '1023456789',
    phone: '3209876543',
  });

  await page.getByRole('row', { name: /María López/ }).click();
  await expect(page.getByText('Detalle del Participante')).toBeVisible();

  await page.getByPlaceholder('Monto del abono (COP)').fill('50000');
  await page.getByRole('button', { name: 'Registrar pago' }).click();

  await expect(page.getByText('+$50.000', { exact: false })).toBeVisible();

  const prisma = await testDb();
  const participant = await prisma.participant.findFirst({
    where: { name: 'María López' },
  });
  const payments = participant
    ? await prisma.payment.findMany({ where: { participantId: participant.id } })
    : [];
  await prisma.$disconnect();

  expect(participant).not.toBeNull();
  expect(participant.paidAmount).toBe(50000);
  expect(participant.paymentStatus).toBe('PAGO_PARCIAL');
  expect(payments).toHaveLength(1);
  expect(payments[0].amount).toBe(50000);
  expect(payments[0].method).toBeNull();
  expect(payments[0].notes).toBeNull();
});

test('se rechaza marcar ENTREGADO sin el pago mínimo (regla de negocio en BD real)', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Boda Andrés y Pao';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);
  await createParticipant(page, {
    name: 'Luis Pardo',
    cedula: '1066778899',
    phone: '3101112222',
  });

  await page.getByRole('row', { name: /Luis Pardo/ }).click();
  await expect(page.getByText('Detalle del Participante')).toBeVisible();

  await page.getByRole('button', { name: 'ENTREGADO', exact: true }).click();
  await page.waitForTimeout(800);

  const prisma = await testDb();
  const participant = await prisma.participant.findFirst({
    where: { name: 'Luis Pardo' },
  });
  await prisma.$disconnect();

  expect(participant).not.toBeNull();
  expect(participant.status).toBe('PENDIENTE');
  expect(participant.deliveredAt).toBeNull();
});

test('marcar ENTREGADO con pago total persiste en la base de datos real', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'XV de Valentina';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);
  await createParticipant(page, {
    name: 'Ana Pérez',
    cedula: '100345678',
    phone: '3184445566',
    payment: 'PAGO_TOTAL',
  });

  await page.getByRole('row', { name: /Ana Pérez/ }).locator('input[type="checkbox"]').check();
  await page.getByRole('button', { name: 'Marcar Entregado' }).click();
  await expect(page.getByText('Estado actualizado', { exact: false })).toBeVisible();

  const prisma = await testDb();
  const participant = await prisma.participant.findFirst({
    where: { name: 'Ana Pérez' },
  });
  await prisma.$disconnect();

  expect(participant).not.toBeNull();
  expect(participant.status).toBe('ENTREGADO');
  expect(participant.deliveredAt).not.toBeNull();
});