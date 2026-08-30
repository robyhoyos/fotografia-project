// src/main/services/event.service.ts
// Capa de lógica de negocio para eventos.
// Orquesta las llamadas a Repository y aplica reglas de negocio antes de persistir.

import { EventRepository } from '../repositories/event.repository'
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsInput,
} from '../../../shared/schemas/event.schema'

/**
 * @class EventService
 * @description Servicio de negocio para eventos.
 *
 * Responsabilidades:
 * - Validar reglas de negocio que van más allá de Zod
 * - Coordinar operaciones que involucran múltiples repositories
 * - Transformar datos antes de enviar a repositories
 * - Manejar errores de dominio
 *
 * Flujo:
 * ```text
 * IPC Handler
 *   ↓ valida payload con Zod
 * EventService  ← ESTE ARCHIVO
 *   ↓ aplica reglas de negocio
 * EventRepository
 *   ↓ Prisma Client
 * SQLite
 * ```
 */
export class EventService {
  constructor(private eventRepo: EventRepository) {}

  /**
   * @method getAll
   * @description Obtiene la lista paginada de eventos.
   *
   * @param {ListEventsInput} params - Filtros y paginación
   * @returns PaginatedResponse con eventos y conteo de participantes
   */
  async getAll(params: ListEventsInput) {
    return this.eventRepo.findAll(params)
  }

  /**
   * @method getById
   * @description Obtiene un evento con todos sus participantes.
   *
   * @param {string} id - CUID del evento
   * @returns Evento con participantes o null si no existe
   */
  async getById(id: string) {
    return this.eventRepo.findById(id)
  }

  /**
   * @method create
   * @description Crea un nuevo evento.
   * Valida que la fecha no sea en el pasado (regla de negocio).
   *
   * @param {CreateEventInput} data - Datos validados por Zod
   * @returns Evento creado
   * @throws Error si la fecha es en el pasado
   */
  async create(data: CreateEventInput) {
    const eventDate = new Date(data.date)
    const now = new Date()

    // Normalizar a midnight local para comparar solo fechas (sin horas)
    const eventDay = new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate())
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

    // Regla de negocio: no crear eventos en el pasado
    // (excepto si es un evento de estudio que puede ser retroactivo)
    if (eventDay < today && data.category !== 'ESTUDIO') {
      throw new Error(
        'No se pueden crear eventos con fecha en el pasado'
      )
    }

    return this.eventRepo.create(data)
  }

  /**
   * @method update
   * @description Actualiza un evento existente.
   * Valida que no se pueda modificar un evento cancelado.
   *
   * @param {UpdateEventInput} input - ID + campos a modificar
   * @returns Evento actualizado
   * @throws Error si el evento está cancelado
   */
  async update(input: UpdateEventInput) {
    const existing = await this.eventRepo.findById(input.id)

    if (!existing) {
      throw new Error('Evento no encontrado')
    }

    if (existing.status === 'CANCELADO') {
      throw new Error(
        'No se puede modificar un evento cancelado'
      )
    }

    return this.eventRepo.update(input)
  }

  /**
   * @method delete
   * @description Elimina un evento y todos sus participantes (CASCADE).
   * Valida que no tenga participantes entregados.
   *
   * @param {string} id - CUID del evento
   * @throws Error si tiene participantes con estado ENTREGADO
   */
  async delete(id: string) {
    const existing = await this.eventRepo.findById(id)

    if (!existing) {
      throw new Error('Evento no encontrado')
    }

    // Regla de negocio: no eliminar si ya se entregaron fotos
    const hasDelivered = existing.participants.some(
      (p) => p.status === 'ENTREGADO'
    )

    if (hasDelivered) {
      throw new Error(
        'No se puede eliminar un evento con participantes entregados. Cancela el evento primero.'
      )
    }

    return this.eventRepo.delete(id)
  }

  /**
   * @method getStats
   * @description Retorna métricas agregadas de un evento.
   *
   * @param {string} eventId - ID del evento
   * @returns Estadísticas: total, entregados, pendientes, ingresos, cobrado, pendiente
   */
  async getStats(eventId: string) {
    return this.eventRepo.getStats(eventId)
  }
}
