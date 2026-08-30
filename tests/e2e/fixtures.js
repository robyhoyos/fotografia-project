const { test, expect } = require('@playwright/test');

const defaultEvent = {
  id: 'evt-1',
  name: 'Boda María y Juan',
  category: 'SACRAMENTAL',
  subtype: 'BODA',
  date: '2026-12-15T10:00:00.000Z',
  location: 'Parroquia San José',
  notes: null,
  coverPrice: 150000,
  status: 'ACTIVO',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  participants: [],
  _count: { participants: 0 },
};

const defaultParticipant = {
  id: 'part-1',
  name: 'Ana Pérez',
  cedula: '100200300',
  phone: '3001234567',
  email: 'ana@example.com',
  quantity: 1,
  unitPrice: 150000,
  coverPrice: 150000,
  paidAmount: 0,
  status: 'PENDIENTE',
  paymentStatus: 'PENDIENTE',
  barcode: '100200300',
  items: [{ id: 'it-1', descripcion: 'Paquete Básico', cantidad: 1, precio_unitario: 150000, subtotal: 150000 }],
  event: { id: 'evt-1', name: 'Boda María y Juan', date: '2026-12-15T10:00:00.000Z', location: 'Parroquia San José', coverPrice: 150000 },
};

const initScript = function () {
  function ok(data) {
    return { success: true, data };
  }

  const seed = window.__seed || {};
  const events = seed.events || [];
  const participants = seed.participants || [];
  const incidents = seed.incidents || [];
  const pageSize = seed.pageSize || 20;

  const totalCostOf = (p) => {
    if (p.items && p.items.length > 0) {
      const sum = p.items.reduce((acc, it) => acc + (it.subtotal || 0), 0);
      if (sum > 0) return sum;
    }
    return (p.unitPrice || 0) * (p.quantity || 1);
  };

  // Resumen de cuenta coherente para el historial de pagos de un participante.
  const summaryOf = (p) => {
    const totalCost = totalCostOf(p);
    const paidAmount = p.paidAmount || 0;
    const outstanding = Math.max(totalCost - paidAmount, 0);
    const paymentStatus =
      p.paymentStatus ||
      (totalCost > 0 && paidAmount >= totalCost
        ? 'PAGO_TOTAL'
        : paidAmount > 0
        ? 'PAGO_PARCIAL'
        : 'SIN_PAGO');
    return {
      payments: [],
      summary: {
        totalCost,
        paidAmount,
        outstanding,
        paymentStatus,
        paid: paidAmount,
        owed: outstanding,
        remaining: outstanding,
      },
    };
  };

  const dashboardStats = () => {
    const byCategory = [];
    for (const category of ['SACRAMENTAL', 'ESCOLAR', 'ESTUDIO']) {
      const catEvents = events.filter((e) => e.category === category);
      if (catEvents.length === 0) continue;
      const catIds = new Set(catEvents.map((e) => e.id));
      const catParticipants = participants.filter((p) => p.event && catIds.has(p.event.id));
      const collected = catParticipants.reduce((s, p) => s + (p.paidAmount || 0), 0);
      byCategory.push({
        category,
        events: catEvents.length,
        participants: catParticipants.length,
        delivered: 0,
        revenue: 0,
        collected,
        outstanding: catParticipants.reduce((s, p) => s + Math.max(totalCostOf(p) - (p.paidAmount || 0), 0), 0),
      });
    }
    const collected = participants.reduce((s, p) => s + (p.paidAmount || 0), 0);
    return {
      totalEvents: events.length,
      activeEvents: events.filter((e) => e.status === 'ACTIVO').length,
      totalParticipants: participants.length,
      delivered: participants.filter((p) => p.status === 'ENTREGADO').length,
      pending: participants.filter((p) => p.status !== 'ENTREGADO' && p.status !== 'CANCELADO').length,
      cancelled: participants.filter((p) => p.status === 'CANCELADO').length,
      totalRevenue: participants.reduce((s, p) => s + totalCostOf(p), 0),
      collected,
      outstanding: participants.reduce((s, p) => s + Math.max(totalCostOf(p) - (p.paidAmount || 0), 0), 0),
      byCategory,
      monthly: [],
      lastEvents: events,
    };
  };

  const alertsSummary = () => ({
    upcomingEvents: events
      .filter((e) => e.status !== 'CANCELADO')
      .map((e) => ({
        id: e.id,
        name: e.name,
        category: e.category,
        subtype: e.subtype,
        date: e.date,
        location: e.location || null,
        participantCount: participants.filter((p) => p.event && p.event.id === e.id).length,
      })),
    openIncidents: incidents.filter((i) => i.status === 'ABIERTA').length,
    totalIncidents: incidents.length,
    incidents,
  });

  window.api = {
    events: {
      getAll: async (p) => {
        const filtered = events.filter((e) => !p.search || e.name.toLowerCase().includes(p.search.toLowerCase()));
        return ok({ items: filtered, total: filtered.length, page: 1, pageSize, totalPages: Math.ceil(filtered.length / pageSize) });
      },
      getById: async (p) => ok(events.find((e) => e.id === p.id) || null),
      create: async (p) => ok({ id: 'evt-new', ...p }),
      update: async (p) => {
        const idx = events.findIndex((e) => e.id === p.id);
        if (idx >= 0) events[idx] = { ...events[idx], ...p };
        return ok(true);
      },
delete: async () => ok(null),
      getStats: async (p) => {
        const evParts = participants.filter((x) => !p.id || (x.event && x.event.id === p.id));
        return ok({
          totalParticipants: evParts.length,
          delivered: evParts.filter((x) => x.status === 'ENTREGADO').length,
          pending: evParts.filter((x) => x.status !== 'ENTREGADO' && x.status !== 'CANCELADO').length,
          totalRevenue: evParts.reduce((s, x) => s + totalCostOf(x), 0),
          collected: evParts.reduce((s, x) => s + (x.paidAmount || 0), 0),
          outstanding: evParts.reduce((s, x) => s + Math.max(totalCostOf(x) - (x.paidAmount || 0), 0), 0),
        });
      },
    },
    participants: {
      getByEvent: async (p) => {
        const filtered = participants.filter(
          (x) =>
            (!p.eventId || (x.event && x.event.id === p.eventId)) &&
            (!p.search || x.name.toLowerCase().includes(p.search.toLowerCase()))
        );
        return ok({ items: filtered, total: filtered.length, page: 1, pageSize, totalPages: Math.ceil(filtered.length / pageSize) });
      },
      getById: async (p) => ok(participants.find((x) => x.id === p.id) || null),
      getByBarcode: async (p) => ok(participants.find((x) => x.barcode === p.barcode) || null),
      create: async (p) => ok({ id: 'part-new', ...p }),
      update: async (p) => ok({ id: p.id, ...p }),
      delete: async () => ok(null),
      bulkUpdateStatus: async (p) => {
        participants.forEach((x) => {
          if (p.participantIds.includes(x.id)) x.status = p.status;
        });
        return ok({ updated: p.participantIds.length });
      },
      bulkUpdatePayment: async () => ok({ updated: 0 }),
      bulkDelete: async () => ok({ deleted: 0 }),
      importCsv: async () => ok({ imported: 2, errors: [], total: 2 }),
    },
    database: {
      backup: async () => ok({ path: 'backup.db', size: 0 }),
      restore: async () => ok({ path: 'restore.db', size: 0 }),
      getInfo: async () => ok({ path: ':memory:', exists: true, size: 0, eventCount: events.length, participantCount: participants.length }),
    },
    payments: {
      create: async (p) => ok({ id: 'pay-1', ...p }),
      findByParticipant: async (p) => {
        const participant = participants.find((x) => x.id === p.participantId) || participants[0];
        return ok(
          participant
            ? summaryOf(participant)
            : { payments: [], summary: { totalCost: 0, paidAmount: 0, outstanding: 0, paymentStatus: 'SIN_PAGO', paid: 0, owed: 0, remaining: 0 } }
        );
      },
      delete: async () => ok({ deleted: true }),
    },
    pdf: {
      generateReceipt: async () => ok({ path: 'receipt.pdf' }),
    },
    export: {
      xlsxParticipants: async () => ok({ path: 'export.xlsx', count: participants.length }),
    },
    settings: {
      getAll: async () => {
        const grouped = {};
        const items = seed.settings || [];
        for (const item of items) {
          const category = item.category || 'general';
          if (!grouped[category]) grouped[category] = [];
          grouped[category].push(item);
        }
        return ok(grouped);
      },
      get: async (key) => ok((seed.settings || []).find((s) => s.key === key)?.value ?? null),
      getMany: async () => ok([]),
      set: async () => ok(),
      setMany: async () => ok(),
      resetCategory: async () => ok(),
      resetAll: async () => ok(),
    },
    dashboard: {
      getStats: async () => ok(dashboardStats()),
    },
    dialog: {
      pickDirectory: async () => ok(null),
    },
    alerts: {
      getSummary: async () => ok(alertsSummary()),
      createIncident: async (p) => ok({ id: 'inc-1', ...p }),
      updateIncident: async () => ok(),
      deleteIncident: async () => ok(true),
      getUpcomingEvents: async () => ok([]),
      getReceivables: async () => ok([]),
    },
  };
};

/**
 * Instala el mock con datos de semilla (eventos y participantes) para el test.
 * Debe llamarse DENTRO del test y ANTES del primer page.goto().
 *
 * Orden de init scripts (se ejecutan en orden de registro):
 *   1. beforeEach registra el setter de `window.__seed` (datos planos)
 *   2. seed() registra el constructor de `window.api` (lee __seed en runtime)
 * → El api-builder siempre corre después del setter de semilla.
 */
async function seed(page, { events = [], participants = [], settings = [], incidents = [] } = {}) {
  const theEvents = events.length ? events : [defaultEvent];
  await page.addInitScript(
    (payload) => {
      window.__seed = payload;
    },
    { events: theEvents, participants, settings, incidents }
  );
  await page.addInitScript(initScript);
  return { events: theEvents, participants };
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript((payload) => {
    window.__seed = payload;
  }, { events: [], participants: [], settings: [], incidents: [] });
  await page.addInitScript(initScript);
});

module.exports = { test, expect, seed, defaultEvent, defaultParticipant };
