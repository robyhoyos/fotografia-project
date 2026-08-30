// src/main/handlers/event.handler.ts
// Registrador de canales IPC para eventos.
// Cada canal valida con Zod, ejecuta el Service y retorna un ApiResponse.

import { ipcMain } from 'electron'
import { EventService } from '../services/event.service'
import { EventRepository } from '../repositories/event.repository'
import prisma from '../database/prisma'
import {
  CreateEventSchema,
  UpdateEventSchema,
  ListEventsSchema,
} from '../../../shared/schemas/event.schema'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import type { ApiResponse, EventStats } from '../../../shared/types/ipc'

/**
 * @function registerEventHandlers
 * @description Registra todos los canales IPC relacionados con eventos.
 *
 * Flujo de cada handler:
 * ```text
 * Renderer (window.api.events.xxx)
 *   ↓ ipcRenderer.invoke('events:xxx', payload)
 * ipcMain.handle('events:xxx')  ← ESTE ARCHIVO
 *   ↓ ZodSchema.parse(payload)  → valida entrada
 *   ↓ eventService.xxx()        → ejecuta lógica de negocio
 *   ↓ { success: true, data }   → retorna respuesta tipada
 * Renderer recibe ApiResponse<T>
 * ```
 *
 * @security
 * - Cada payload se valida con Zod ANTES de ejecutar任何 lógica
 * - Los errores se capturan y retornan como { success: false, error }
 * - Nunca se exponen stack traces internos al Renderer
 *
 * @param {EventService} eventService - Instancia del servicio de eventos
 */
export function registerEventHandlers(eventService: EventService): void {
  const channels = IPC_CHANNELS.EVENTS

  // ─── GET_ALL: Listar eventos paginados ────────────────────────

  /**
   * Canal: events:getAll
   * Payload: { page, pageSize, category?, search?, sortBy, sortOrder }
   * Response: ApiResponse<PaginatedResponse<Event>>
   */
  ipcMain.handle(
    channels.GET_ALL,
    async (_, payload): Promise<ApiResponse<any>> => {
      try {
        const params = ListEventsSchema.parse(payload)
        const data = await eventService.getAll(params)
        return { success: true, data }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── GET_BY_ID: Obtener evento con participantes ─────────────

  /**
   * Canal: events:getById
   * Payload: { id: string }
   * Response: ApiResponse<EventWithParticipants | null>
   */
  ipcMain.handle(
    channels.GET_BY_ID,
    async (_, payload: { id: string }): Promise<ApiResponse<any>> => {
      try {
        const { id } = payload
        const data = await eventService.getById(id)
        return { success: true, data }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── CREATE: Crear nuevo evento ─────────────────────────────

  /**
   * Canal: events:create
   * Payload: CreateEventInput (validado con Zod)
   * Response: ApiResponse<Event>
   */
  ipcMain.handle(
    channels.CREATE,
    async (_, payload): Promise<ApiResponse<any>> => {
      try {
        const data = CreateEventSchema.parse(payload)
        const event = await eventService.create(data)
        return { success: true, data: event, message: 'Evento creado' }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── UPDATE: Actualizar evento ──────────────────────────────

  /**
   * Canal: events:update
   * Payload: UpdateEventInput (ID + campos parciales)
   * Response: ApiResponse<Event>
   */
  ipcMain.handle(
    channels.UPDATE,
    async (_, payload): Promise<ApiResponse<any>> => {
      try {
        const data = UpdateEventSchema.parse(payload)
        const event = await eventService.update(data)
        return { success: true, data: event, message: 'Evento actualizado' }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── DELETE: Eliminar evento ────────────────────────────────

  /**
   * Canal: events:delete
   * Payload: { id: string }
   * Response: ApiResponse<null>
   */
  ipcMain.handle(
    channels.DELETE,
    async (_, payload: { id: string }): Promise<ApiResponse<any>> => {
      try {
        await eventService.delete(payload.id)
        return { success: true, message: 'Evento eliminado' }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── GET_STATS: Estadísticas del evento ─────────────────────

  /**
   * Canal: events:getStats
   * Payload: { eventId: string }
   * Response: ApiResponse<EventStats>
   */
  ipcMain.handle(
    channels.GET_STATS,
    async (_, payload: { eventId: string }): Promise<ApiResponse<any>> => {
      try {
        const stats = await eventService.getStats(payload.eventId)
        return { success: true, data: stats }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )
}
