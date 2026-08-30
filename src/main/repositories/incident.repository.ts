// src/main/repositories/incident.repository.ts
// Repository para el módulo de Alertas (incidencias editables/resolubles).

import type { PrismaClient, Prisma } from '@prisma/client'
import type { Incident, IncidentInput } from '../../../shared/types/ipc'

type PrismaIncidentUpdateInput = Prisma.IncidentUncheckedUpdateInput

export class IncidentRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * @description Lista todas las incidencias (abiertas primero) con evento asociado.
   */
  async findAll(): Promise<Incident[]> {
    const rows = await this.prisma.incident.findMany({
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
      include: { event: { select: { name: true } } },
    })
    return rows.map((r) => this.toDto(r))
  }

  /**
   * @description Crea una nueva incidencia.
   */
  async create(input: IncidentInput): Promise<Incident> {
    const row = await this.prisma.incident.create({
      data: {
        title: input.title ?? '(Sin título)',
        description: input.description ?? null,
        type: input.type ?? 'PENDIENTE',
        status: input.status ?? 'ABIERTA',
        eventId: input.eventId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
      },
      include: { event: { select: { name: true } } },
    })
    return this.toDto(row)
  }

  /**
   * @description Actualiza una incidencia existente (campos parciales).
   */
  async update(id: string, input: IncidentInput): Promise<Incident> {
    const data: PrismaIncidentUpdateInput = {}
    if (input.title !== undefined) data.title = input.title
    if (input.description !== undefined) data.description = input.description
    if (input.type !== undefined) data.type = input.type
    if (input.status !== undefined) data.status = input.status
    if (input.eventId !== undefined) data.eventId = input.eventId
    if (input.dueDate !== undefined) data.dueDate = input.dueDate ? new Date(input.dueDate) : null
    if (input.dueDate === null) data.dueDate = null

    const row = await this.prisma.incident.update({
      where: { id },
      data,
      include: { event: { select: { name: true } } },
    })
    return this.toDto(row)
  }

  /**
   * @description Marca una incidencia como resuelta.
   */
  async resolve(id: string): Promise<Incident> {
    const row = await this.prisma.incident.update({
      where: { id },
      data: { status: 'RESUELTA' },
      include: { event: { select: { name: true } } },
    })
    return this.toDto(row)
  }

  /**
   * @description Reabre una incidencia resuelta.
   */
  async reopen(id: string): Promise<Incident> {
    const row = await this.prisma.incident.update({
      where: { id },
      data: { status: 'ABIERTA' },
      include: { event: { select: { name: true } } },
    })
    return this.toDto(row)
  }

  /**
   * @description Elimina una incidencia.
   */
  async delete(id: string): Promise<boolean> {
    await this.prisma.incident.delete({ where: { id } })
    return true
  }

  /**
   * @description Convierte la fila de Prisma al DTO compartido.
   */
  private toDto(r: {
    id: string
    title: string
    description: string | null
    type: string
    status: string
    eventId: string | null
    dueDate: Date | null
    createdAt: Date
    updatedAt: Date
    event?: { name: string } | null
  }): Incident {
    return {
      id: r.id,
      title: r.title,
      description: r.description,
      type: r.type as Incident['type'],
      status: r.status as Incident['status'],
      eventId: r.eventId,
      eventName: r.event?.name ?? null,
      dueDate: r.dueDate ? r.dueDate.toISOString() : null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }
  }
}
