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

// payment: 'SIN_PAGO' (default) | 'PAGO_TOTAL' | 'PAGO_PARCIAL' (requiere `abono`)
async function createParticipant(page, { name, cedula, phone, payment = 'SIN_PAGO', abono }) {
  await page.getByRole('button', { name: 'Nuevo Participante', exact: true }).click();
  await expect(page.getByText('Nombre *', { exact: false })).toBeVisible();
  await page.getByText('Nombre *', { exact: false }).locator('..').locator('input').fill(name);
  await page.getByPlaceholder('Número de documento').fill(cedula);
  await page.getByPlaceholder('300 123 4567').fill(phone);
  if (payment === 'PAGO_TOTAL') {
    await page.getByText('Pago total', { exact: false }).click();
  } else if (payment === 'PAGO_PARCIAL') {
    await page.getByText('Abono', { exact: false }).click();
    await page
      .getByText('Monto del abono (COP) *', { exact: false })
      .locator('..')
      .locator('input')
      .fill(String(abono));
  }
  await page.getByRole('button', { name: 'Guardar' }).click();
}

// Abre la vista de escáner desde el detalle del evento y devuelve el input de código.
async function openScanner(page) {
  const scanBtn = page.locator('header').getByRole('button', { name: 'Escanear', exact: true });
  await expect(scanBtn).toBeVisible();
  await scanBtn.click();
  await page.locator('aside').getByText('Escanear', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Escanear Código', exact: true })).toBeVisible();
  return page.getByPlaceholder('Escanear o escribir código...');
}

async function getParticipantBarcode(name) {
  const prisma = await testDb();
  const participant = await prisma.participant.findFirst({ where: { name } });
  await prisma.$disconnect();
  expect(participant).not.toBeNull();
  return participant.barcode;
}

async function findParticipant(name) {
  const prisma = await testDb();
  const participant = await prisma.participant.findFirst({ where: { name } });
  await prisma.$disconnect();
  return participant;
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

test('entregar participante con el pago mínimo vía escáner en BD real (HU-G2)', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Scanner Con Pago';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);
  await createParticipant(page, {
    name: 'Carlos Gómez',
    cedula: '200300400',
    phone: '3202223333',
    payment: 'PAGO_TOTAL',
  });
  await expect(page.getByText('Participante y pago registrado')).toBeVisible();

  const barcode = await getParticipantBarcode('Carlos Gómez');
  const scannerInput = await openScanner(page);
  await scannerInput.fill(barcode);
  await expect(page.getByText('Carlos Gómez', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como Entregado' }).click();
  await expect(page.getByText('Entrega registrada')).toBeVisible();

  const delivered = await findParticipant('Carlos Gómez');
  expect(delivered.status).toBe('ENTREGADO');
  expect(delivered.deliveredAt).not.toBeNull();
});

test('bloquear entrega por escáner sin el pago mínimo en BD real (regla de negocio)', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Scanner Sin Pago';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);
  await createParticipant(page, {
    name: 'Luis Pardo',
    cedula: '1066778899',
    phone: '3101112222',
  });

  const barcode = await getParticipantBarcode('Luis Pardo');
  const scannerInput = await openScanner(page);
  await scannerInput.fill(barcode);
  await expect(page.getByText('Luis Pardo', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Marcar como Entregado' }).click();

  await expect(page.getByText('Pago insuficiente')).toBeVisible();
  await expect(page.getByText('Debe tener al menos 50% pagado para entregar')).toBeVisible();

  const unaffected = await findParticipant('Luis Pardo');
  expect(unaffected.status).toBe('PENDIENTE');
  expect(unaffected.deliveredAt).toBeNull();
});

test('dashboard calcula los KPIs desde la base de datos real', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Dashboard Real 2026';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);
  await createParticipant(page, {
    name: 'Ana Pérez',
    cedula: '100200301',
    phone: '3184445566',
    payment: 'PAGO_TOTAL',
  });
  await expect(page.getByText('Participante y pago registrado')).toBeHidden();
  await createParticipant(page, {
    name: 'María López',
    cedula: '100200302',
    phone: '3121112233',
    payment: 'PAGO_PARCIAL',
    abono: 75000,
  });
  await expect(page.getByText('Participante y pago registrado')).toBeHidden();

  await page.locator('aside').getByText('Dashboard', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();

  const kpis = page.locator('p.font-bold.text-3xl');
  await expect(kpis).toHaveCount(4);
  await expect(kpis.nth(0)).toHaveText('1'); // Total Eventos
  await expect(kpis.nth(1)).toHaveText('2'); // Participantes
  await expect(kpis.nth(2)).toHaveText('$225.000'); // Cobrado (150.000 + 75.000)
  await expect(kpis.nth(3)).toHaveText('$75.000'); // Por Cobrar (150.000 - 75.000)

  await expect(page.getByText('Últimos Eventos')).toBeVisible();
  const eventCell = page.getByRole('cell', { name: eventName, exact: false }).first();
  await expect(eventCell).toBeVisible();
  await eventCell.click();
  await expect(page.getByRole('button', { name: 'Nuevo Participante', exact: true })).toBeVisible();
});

test('guardar configuración persiste en la base de datos real', async ({ realApp }) => {
  const { page } = realApp;

  await page.locator('aside').getByText('Configuración', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Configuración' })).toBeVisible();

  const nameInput = page.getByText('Nombre del negocio', { exact: true }).locator('..').locator('input');
  await expect(nameInput).toBeVisible();
  await nameInput.fill('Foto Estudio Andrés E2E');
  await page.getByRole('button', { name: 'Guardar cambios' }).click();
  await expect(page.getByText('Configuración guardada')).toBeVisible();

  const prisma = await testDb();
  const setting = await prisma.setting.findFirst({ where: { key: 'business_name' } });
  await prisma.$disconnect();
  expect(setting).not.toBeNull();
  expect(setting.value).toBe('Foto Estudio Andrés E2E');
});

test('cambiar el estado del evento a Finalizado persiste en BD real (HU-B2)', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Boda Finalizada';

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);

  await page.getByRole('button', { name: 'Finalizado' }).click();
  await expect(page.getByText('Cambiar a finalizado', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Eliminar' }).click();
  await expect(page.getByText('Estado actualizado', { exact: false })).toBeVisible();

  const prisma = await testDb();
  const event = await prisma.event.findFirst({ where: { name: eventName } });
  await prisma.$disconnect();
  expect(event).not.toBeNull();
  expect(event.status).toBe('FINALIZADO');
});

test('editar un evento persiste en la base de datos real (HU-B2)', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Evento A Editar';

  await createEventViaUi(page, eventName);
  await page.getByTitle('Editar').click();
  await expect(page.getByRole('heading', { name: 'Editar Evento' })).toBeVisible();

  await page.getByPlaceholder('Ej: Primera Comunión San José').first().fill('Boda María y Juan Actualizada');
  await page.getByRole('button', { name: 'Guardar Cambios' }).click();
  await expect(page.getByRole('heading', { name: 'Editar Evento' })).toBeHidden();

  const prisma = await testDb();
  const event = await prisma.event.findFirst({ where: { name: 'Boda María y Juan Actualizada' } });
  await prisma.$disconnect();
  expect(event).not.toBeNull();
});

test('crear y resolver una incidencia persiste en la base de datos real', async ({ realApp }) => {
  const { page } = realApp;

  await page.locator('aside').getByText('Alertas', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Alertas' })).toBeVisible();

  await page.getByRole('button', { name: '+ Nueva incidencia' }).click();
  await expect(page.getByText('Nueva incidencia', { exact: true })).toBeVisible();
  await page.getByPlaceholder('Ej: Reparar reflector principal').fill('Comprar baterías de repuesto');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Incidencia creada')).toBeVisible();

  let prisma = await testDb();
  let created = await prisma.incident.findFirst({ where: { title: 'Comprar baterías de repuesto' } });
  await prisma.$disconnect();
  expect(created).not.toBeNull();
  expect(created.status).toBe('ABIERTA');

  await page.getByTitle('Resolver').click();
  await expect(page.getByText('Incidencia resuelta')).toBeVisible();

  prisma = await testDb();
  created = await prisma.incident.findFirst({ where: { title: 'Comprar baterías de repuesto' } });
  await prisma.$disconnect();
  expect(created.status).toBe('RESUELTA');
});

test('importar participantes desde CSV persiste en la base de datos real (HU-D5)', async ({ realApp }) => {
  const { page } = realApp;
  const eventName = 'Evento CSV';
  const CSV = [
    'nombre,cedula,telefono,email,cantidad',
    'Juan Rodríguez,100200300,3001234567,juan@example.com,1',
    'Ana Pérez,100200301,3112345678,ana@example.com,2',
  ].join('\n');

  await createEventViaUi(page, eventName);
  await openEvent(page, eventName);

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

  const prisma = await testDb();
  const event = await prisma.event.findFirst({ where: { name: eventName } });
  const count = await prisma.participant.count({ where: { eventId: event.id } });
  const juan = await prisma.participant.findFirst({ where: { name: 'Juan Rodríguez' } });
  await prisma.$disconnect();
  expect(count).toBe(2);
  expect(juan).not.toBeNull();
  expect(juan.cedula).toBe('100200300');
});