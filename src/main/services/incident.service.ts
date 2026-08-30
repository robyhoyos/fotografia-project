// src/main/services/incident.service.ts
// Service del módulo de Alertas: incidencias + eventos próximos + cuentas por cobrar.

import type { PrismaClient } from '@prisma/client'
import type {
  UpcomingEvent,
  AlertsSummary,
  ReceivableItem,
  IncidentInput,
} from '../../../shared/types/ipc'
import { IncidentRepository } from '../repositories/incident.repository'

/**
 * @function participantTotalDue
 * @description Calcula el total a pagar de un participante siguiendo la misma
 * lógica que el dashboard (totalAmount > items > unitPrice/coverPrice * cantidad).
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

export class IncidentService {
  constructor(
    private repository: IncidentRepository,
    private prisma: PrismaClient
  ) {}

  /**
   * @description Resumen agregado de alertas: incidencias + eventos próximos.
   */
  async getSummary(): Promise<AlertsSummary> {
    const [incidents, upcomingRows] = await Promise.all([
      this.repository.findAll(),
      this.prisma.event.findMany({
        where: {
          status: 'ACTIVO',
          date: { gte: new Date() },
        },
        take: 10,
        orderBy: { date: 'asc' },
        include: { _count: { select: { participants: true } } },
      }),
    ])

    const upcomingEvents: UpcomingEvent[] = upcomingRows.map((e) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      subtype: e.subtype,
      date: e.date.toISOString(),
      location: e.location,
      participantCount: e._count.participants,
    }))

    return {
      upcomingEvents,
      openIncidents: incidents.filter((i) => i.status === 'ABIERTA').length,
      totalIncidents: incidents.length,
      incidents,
    }
  }

  async getIncidents() {
    return this.repository.findAll()
  }

  async createIncident(input: IncidentInput) {
    return this.repository.create(input)
  }

  async updateIncident(id: string, input: IncidentInput) {
    return this.repository.update(id, input)
  }

  async resolveIncident(id: string, resolved: boolean) {
    return resolved ? this.repository.resolve(id) : this.repository.reopen(id)
  }

  async deleteIncident(id: string) {
    return this.repository.delete(id)
  }

  /**
   * @description Cuentas por cobrar globales: participantes con saldo pendiente.
   */
  async getReceivables(): Promise<ReceivableItem[]> {
    const rows = await this.prisma.participant.findMany({
      where: {
        status: { not: 'CANCELADO' },
      },
      select: {
        id: true,
        name: true,
        phone: true,
        paidAmount: true,
        quantity: true,
        unitPrice: true,
        totalAmount: true,
        items: true,
        event: {
          select: {
            id: true,
            name: true,
            date: true,
            coverPrice: true,
            status: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    return rows
      .map((p) => {
        const totalDue = participantTotalDue(p)
        const paidAmount = p.paidAmount || 0
        return {
          participantId: p.id,
          participantName: p.name,
          phone: p.phone,
          eventId: p.event.id,
          eventName: p.event.name,
          eventDate: p.event.date.toISOString(),
          totalDue,
          paidAmount,
          outstanding: Math.max(totalDue - paidAmount, 0),
        }
      })
      .filter((r) => r.outstanding > 0)
      .sort((a, b) => b.outstanding - a.outstanding)
  }
}
