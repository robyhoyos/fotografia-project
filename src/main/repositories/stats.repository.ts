// src/main/repositories/stats.repository.ts
// Repository para estadísticas globales del dashboard.
// Agrega métricas reales (cobrado, pendiente, entregado, por categoría y mensual)
// consultando la base de datos directamente, sin depender del frontend.

import prisma from '../database/prisma'
import type {
  DashboardStats,
  DashboardStatsParams,
  DashboardCategoryStats,
  DashboardMonthlyStats,
} from '../../../shared/types/ipc'

const CATEGORIES = ['SACRAMENTAL', 'ESCOLAR', 'ESTUDIO'] as const

const MONTH_NAMES = [
  'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
  'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic',
]

/**
 * @function participantTotalDue
 * @description Calcula el total a pagar de un participante:
 * 1. Si tiene totalAmount explícito (> 0) se usa ese.
 * 2. Si tiene items de detalle de compra, se suman los subtotales.
 * 3. Fallback: unitPrice ?? coverPrice del evento * cantidad.
 */
function participantTotalDue(p: {
  totalAmount: number
  unitPrice: number | null
  quantity: number
  items: unknown
  event: { coverPrice: number }
}): number {
  if (p.totalAmount > 0) return p.totalAmount
  if (Array.isArray(p.items) && p.items.length > 0) {
    const sum = (p.items as Array<{ subtotal?: number }>).reduce(
      (acc, it) => acc + (it.subtotal || 0),
      0
    )
    if (sum > 0) return sum
  }
  return (p.unitPrice ?? p.event.coverPrice ?? 0) * (p.quantity ?? 1)
}

export class StatsRepository {
  /**
   * @description Obtiene estadísticas globales agregadas según los filtros.
   */
  async getStats(params: DashboardStatsParams = {}): Promise<DashboardStats> {
    const { category, dateFrom, dateTo } = params

    const eventWhere: Record<string, unknown> = {
      ...(category && { category }),
      ...(dateFrom && { date: { gte: new Date(dateFrom) } }),
      ...(dateTo && { date: { lte: new Date(dateTo + 'T23:59:59.999Z') } }),
    }

    const [events, rawParticipants] = await Promise.all([
      prisma.event.findMany({
        where: eventWhere,
        include: { _count: { select: { participants: true } } },
        orderBy: { date: 'desc' },
      }),
      prisma.participant.findMany({
        where: { event: eventWhere },
        select: {
          status: true,
          paidAmount: true,
          quantity: true,
          unitPrice: true,
          totalAmount: true,
          items: true,
          event: {
            select: {
              coverPrice: true,
              category: true,
              date: true,
            },
          },
        },
      }),
    ])

    const participants = rawParticipants.map((p) => ({
      ...p,
      totalDue: participantTotalDue(p),
    }))

    const totalRevenue = participants.reduce((sum, p) => sum + p.totalDue, 0)
    const collected = participants.reduce((sum, p) => sum + (p.paidAmount || 0), 0)

    const delivered = participants.filter((p) => p.status === 'ENTREGADO').length
    const cancelled = participants.filter((p) => p.status === 'CANCELADO').length
    const pending = participants.length - delivered - cancelled

    // ─── Por categoría ────────────────────────────────────────
    const byCategory: DashboardCategoryStats[] = CATEGORIES.map((cat) => {
      const catEvents = events.filter((e) => e.category === cat)
      const catParticipants = participants.filter((p) => p.event.category === cat)
      const catRevenue = catParticipants.reduce((sum, p) => sum + p.totalDue, 0)
      const catCollected = catParticipants.reduce(
        (sum, p) => sum + (p.paidAmount || 0),
        0
      )
      return {
        category: cat,
        events: catEvents.length,
        participants: catParticipants.length,
        delivered: catParticipants.filter((p) => p.status === 'ENTREGADO').length,
        revenue: catRevenue,
        collected: catCollected,
        outstanding: Math.max(catRevenue - catCollected, 0),
      }
    })

    // ─── Serie mensual ─────────────────────────────────────────
    const monthlyMap = new Map<string, DashboardMonthlyStats>()
    for (const p of participants) {
      const date = new Date(p.event.date)
      if (isNaN(date.getTime())) continue
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const entry = monthlyMap.get(month) ?? {
        month,
        label: `${MONTH_NAMES[date.getMonth()]} ${date.getFullYear()}`,
        revenue: 0,
        collected: 0,
      }
      entry.revenue += p.totalDue
      entry.collected += p.paidAmount || 0
      monthlyMap.set(month, entry)
    }
    const monthly = Array.from(monthlyMap.values()).sort((a, b) =>
      a.month.localeCompare(b.month)
    )

    // ─── Últimos eventos ───────────────────────────────────────
    const lastEvents = events.slice(0, 10).map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      subtype: e.subtype,
      date: e.date.toISOString(),
      location: e.location,
      notes: e.notes,
      coverPrice: e.coverPrice,
      status: e.status,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
      participants: [],
      _count: { participants: e._count.participants },
    }))

    return {
      totalEvents: events.length,
      activeEvents: events.filter((e) => e.status === 'ACTIVO').length,
      totalParticipants: participants.length,
      delivered,
      pending,
      cancelled,
      totalRevenue,
      collected,
      outstanding: Math.max(totalRevenue - collected, 0),
      byCategory,
      monthly,
      lastEvents,
    }
  }
}