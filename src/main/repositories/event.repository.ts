// src/main/repositories/event.repository.ts
// Repository Pattern para la entidad Event.
// Abstrae todas las consultas Prisma/SQLite del domain de eventos.
// Los Services llaman a estos métodos; los Handlers IPC llaman a los Services.

import { PrismaClient, Prisma, EventCategory, EventSubtype } from '@prisma/client'
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsInput,
} from '../../../shared/schemas/event.schema'

/**
 * @class EventRepository
 * @description Capa de acceso a datos para eventos.
 *
 * Patrón Repository:
 * - Cada método corresponde a una operación CRUD atómica
 * - No contiene lógica de negocio (eso va en Services)
 * - Usa Prisma Client como implementación del ORM
 * - Fácil de reemplazar por otro ORM o por tests mock
 *
 * Flujo de datos:
 * ```text
 * Renderer (React)
 *   ↓ window.api.events.create()
 * Preload (IPC Bridge)
 *   ↓ ipcRenderer.invoke()
 * Main Process Handler
 *   ↓ valida con Zod
 * EventService
 *   ↓ lógica de negocio
 * EventRepository  ← ESTE ARCHIVO
 *   ↓ Prisma Client
 * SQLite (dev.db)
 * ```
 */
export class EventRepository {
  constructor(private prisma: PrismaClient) {}

  /**
   * @method findAll
   * @description Lista todos los eventos con paginación, filtros y ordenamiento.
   * Incluye conteo de participantes para mostrar en la tabla.
   *
   * @param {ListEventsInput} params - Parámetros de filtrado y paginación
   * @returns Lista de eventos con conteo de participantes
   */
  async findAll(params: ListEventsInput) {
    const { page, pageSize, category, search, dateFrom, dateTo, sortBy, sortOrder } = params
    const skip = (page - 1) * pageSize

    const where: Prisma.EventWhereInput = {
      ...(category && { category: category as EventCategory }),
      ...(search && {
        OR: [
          { name: { contains: search } },
          { location: { contains: search } },
        ],
      }),
      ...(dateFrom && { date: { gte: new Date(dateFrom) } }),
      ...(dateTo && { date: { lte: new Date(dateTo + 'T23:59:59.999Z') } }),
    }

    const [items, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        include: {
          _count: { select: { participants: true } },
        },
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: pageSize,
      }),
      this.prisma.event.count({ where }),
    ])

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * @method findById
   * @description Busca un evento por ID con todos sus participantes.
   * Usado para la vista de detalle del evento.
   *
   * @param {string} id - CUID del evento
   * @returns Evento con participantes incluidos o null
   */
  async findById(id: string) {
    return this.prisma.event.findUnique({
      where: { id },
      include: {
        participants: {
          orderBy: { name: 'asc' },
        },
        _count: { select: { participants: true } },
      },
    })
  }

  /**
   * @method create
   * @description Crea un nuevo evento en la base de datos.
   *
   * @param {CreateEventInput} data - Datos validados por Zod
   * @returns El evento creado con su ID generado por Prisma
   */
  async create(data: CreateEventInput) {
    return this.prisma.event.create({
      data: {
        name: data.name,
        category: data.category,
        subtype: data.subtype,
        date: new Date(data.date),
        location: data.location ?? null,
        notes: data.notes ?? null,
        coverPrice: data.coverPrice,
      },
      include: {
        _count: { select: { participants: true } },
      },
    })
  }

  /**
   * @method update
   * @description Actualización parcial de un evento.
   *
   * @param {UpdateEventInput} input - ID + campos a actualizar
   * @returns Evento actualizado
   */
  async update(input: UpdateEventInput) {
    const { id, ...data } = input

    const updateData: Prisma.EventUpdateInput = {
      ...(data.name && { name: data.name }),
      ...(data.category && { category: data.category as EventCategory }),
      ...(data.subtype && { subtype: data.subtype as EventSubtype }),
      ...(data.date && { date: new Date(data.date) }),
      ...(data.location !== undefined && { location: data.location }),
      ...(data.notes !== undefined && { notes: data.notes }),
      ...(data.coverPrice !== undefined && { coverPrice: data.coverPrice }),
      ...(data.status && { status: data.status }),
    }

    return this.prisma.event.update({
      where: { id },
      data: updateData,
      include: {
        _count: { select: { participants: true } },
      },
    })
  }

  /**
   * @method delete
   * @description Elimina un evento y todos sus participantes (CASCADE).
   *
   * @param {string} id - CUID del evento
   */
  async delete(id: string) {
    return this.prisma.event.delete({ where: { id } })
  }

  /**
   * @method getStats
   * @description Estadísticas agregadas de un evento para el dashboard.
   * Calcula total de participantes, entregados, pendientes, ingresos.
   *
   * @param {string} eventId - ID del evento
   * @returns Objeto con métricas del evento
   */
  async getStats(eventId: string) {
    const participants = await this.prisma.participant.findMany({
      where: { eventId },
      select: {
        quantity: true,
        unitPrice: true,
        status: true,
        paidAmount: true,
      },
    })

    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: { coverPrice: true },
    })

    const totalParticipants = participants.length
    const delivered = participants.filter(
      (p) => p.status === 'ENTREGADO'
    ).length
    const pending = totalParticipants - delivered

    const totalRevenue = participants.reduce((sum, p) => {
      const price = p.unitPrice ?? event?.coverPrice ?? 0
      return sum + price * p.quantity
    }, 0)

    const collected = participants.reduce(
      (sum, p) => sum + p.paidAmount,
      0
    )

    return {
      totalParticipants,
      delivered,
      pending,
      totalRevenue,
      collected,
      outstanding: totalRevenue - collected,
    }
  }
}
