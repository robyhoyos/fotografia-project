// src/main/handlers/participant.handler.ts
// Registrador de canales IPC para participantes.
// Maneja CRUD, acciones en lote (HU-D6) e importación masiva (HU-D5).

import { ipcMain } from 'electron'
import { ParticipantService } from '../services/participant.service'
import {
  CreateParticipantSchema,
  UpdateParticipantSchema,
  ListParticipantsSchema,
  BulkUpdateStatusSchema,
  BulkUpdatePaymentSchema,
  BulkDeleteSchema,
  ImportCsvSchema,
  SetCustomerRatingSchema,
} from '../../../shared/schemas/participant.schema'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import type { ApiResponse } from '../../../shared/types/ipc'
import { requireAdmin, requireRole } from '../auth/permissions'

/**
 * @function registerParticipantHandlers
 * @description Registra todos los canales IPC para participantes.
 *
 * @security
 * - TODOS los payloads se validan con Zod antes de ejecutar
 * - Las operaciones bulk están limitadas a 500 registros
 * - Los errores se retornan como { success: false, error }
 *
 * @param {ParticipantService} participantService - Servicio de participantes
 */
export function registerParticipantHandlers(
  participantService: ParticipantService
): void {
  const channels = IPC_CHANNELS.PARTICIPANTS
  const customerChannels = IPC_CHANNELS.CUSTOMERS

  // ─── CUSTOMERS.LIST: Vista agregada de clientes ─────────────

  /**
   * Canal: customers:list
   * Payload: none
   * Response: ApiResponse<CustomerSummary[]>
   * Lista clientes únicos por cédula con toda su información de contacto
   * (nombre, cédula, teléfono, email) y métricas de trabajo con la agencia.
   */
  ipcMain.handle(
    customerChannels.LIST,
    requireAdmin(
      async (): Promise<ApiResponse<any>> => {
        try {
          const data = await participantService.listCustomers()
          return { success: true, data }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── CUSTOMERS.SET_RATING: Calificar cliente por cédula ─────

  /**
   * Canal: customers:setRating
   * Payload: { cedula: string, rating: number | null }
   * Response: ApiResponse<{ updated: number }>
   * Asigna la calificación (1=Cuidado, 2=Regular, 3=Buena) a un cliente único
   * por cédula. Solo administradores.
   */
  ipcMain.handle(
    customerChannels.SET_RATING,
    requireAdmin(
      async (_, payload: { cedula: string; rating: number | null }): Promise<ApiResponse<any>> => {
        try {
          const data = SetCustomerRatingSchema.parse(payload)
          const result = await participantService.setCustomerRating(data.cedula, data.rating)
          return { success: true, data: result }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── GET_BY_EVENT: Listar participantes de un evento ─────────

  /**
   * Canal: participants:getByEvent
   * Payload: ListParticipantsInput (validado con Zod)
   * Response: ApiResponse<PaginatedResponse<Participant>>
   */
  ipcMain.handle(
    channels.GET_BY_EVENT,
    async (_, payload): Promise<ApiResponse<any>> => {
      try {
        const params = ListParticipantsSchema.parse(payload)
        const data = await participantService.getByEvent(params)
        return { success: true, data }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── GET_BY_ID: Obtener participante con evento ──────────────

  /**
   * Canal: participants:getById
   * Payload: { id: string }
   * Response: ApiResponse<ParticipantWithEvent | null>
   */
  ipcMain.handle(
    channels.GET_BY_ID,
    async (_, payload: { id: string }): Promise<ApiResponse<any>> => {
      try {
        const data = await participantService.getById(payload.id)
        return { success: true, data }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── GET_BY_BARCODE: Búsqueda por escáner ───────────────────

  /**
   * Canal: participants:getByBarcode
   * Payload: { barcode: string }
   * Response: ApiResponse<ParticipantWithEvent | null>
   */
  ipcMain.handle(
    channels.GET_BY_BARCODE,
    async (_, payload: { barcode: string }): Promise<ApiResponse<any>> => {
      try {
        const data = await participantService.getByBarcode(payload.barcode)
        return { success: true, data }
      } catch (err) {
        return {
          success: false,
          error: (err as Error).message,
        }
      }
    }
  )

  // ─── CREATE: Crear participante individual ──────────────────

  /**
   * Canal: participants:create
   * Payload: CreateParticipantInput
   * Response: ApiResponse<Participant>
   */
  ipcMain.handle(
    channels.CREATE,
    requireAdmin(
      async (_, payload): Promise<ApiResponse<any>> => {
        try {
          const data = CreateParticipantSchema.parse(payload)
          const participant = await participantService.create(data)
          return {
            success: true,
            data: participant,
            message: 'Participante registrado',
          }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── UPDATE: Actualizar participante ────────────────────────

  /**
   * Canal: participants:update
   * Payload: UpdateParticipantInput
   * Response: ApiResponse<Participant>
   */
  ipcMain.handle(
    channels.UPDATE,
    requireAdmin(
      async (_, payload): Promise<ApiResponse<any>> => {
        try {
          const data = UpdateParticipantSchema.parse(payload)
          const participant = await participantService.update(data)
          return {
            success: true,
            data: participant,
            message: 'Participante actualizado',
          }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── DELETE: Eliminar participante ──────────────────────────

  /**
   * Canal: participants:delete
   * Payload: { id: string }
   * Response: ApiResponse<null>
   */
  ipcMain.handle(
    channels.DELETE,
    requireAdmin(
      async (_, payload: { id: string }): Promise<ApiResponse<any>> => {
        try {
          await participantService.delete(payload.id)
          return {
            success: true,
            message: 'Participante eliminado',
          }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── BULK_UPDATE_STATUS: Cambio masivo de estado (HU-D6) ───

  /**
   * Canal: participants:bulkUpdateStatus
   * Payload: BulkUpdateStatusInput { participantIds: string[], status: Status }
   * Response: ApiResponse<{ updated: number }>
   *
   * Flujo Optimistic UI:
   * 1. UI actualiza localmente el estado de los seleccionados
   * 2. Envía bulkUpdateStatus() por IPC
   * 3. Si falla → el hook invalida la query y refresca desde DB
   * 4. Si éxito → los datos ya están correctos en UI
   */
  ipcMain.handle(
    channels.BULK_UPDATE_STATUS,
    requireAdmin(
      async (_, payload): Promise<ApiResponse<any>> => {
        try {
          const data = BulkUpdateStatusSchema.parse(payload)
          const result = await participantService.bulkUpdateStatus(data)
          return {
            success: true,
            data: result,
            message: `${result.updated} participantes actualizados`,
          }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── BULK_UPDATE_PAYMENT: Pago masivo ──────────────────────

  /**
   * Canal: participants:bulkUpdatePayment
   * Payload: BulkUpdatePaymentInput
   * Response: ApiResponse<{ updated: number }>
   */
  ipcMain.handle(
    channels.BULK_UPDATE_PAYMENT,
    requireAdmin(
      async (_, payload): Promise<ApiResponse<any>> => {
        try {
          const data = BulkUpdatePaymentSchema.parse(payload)
          const result = await participantService.bulkUpdatePayment(data)
          return {
            success: true,
            data: result,
            message: `${result.updated} pagos registrados`,
          }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── BULK_DELETE: Eliminación masiva ────────────────────────

  /**
   * Canal: participants:bulkDelete
   * Payload: BulkDeleteInput { participantIds: string[] }
   * Response: ApiResponse<{ deleted: number }>
   */
  ipcMain.handle(
    channels.BULK_DELETE,
    requireAdmin(
      async (_, payload): Promise<ApiResponse<any>> => {
        try {
          const data = BulkDeleteSchema.parse(payload)
          const result = await participantService.bulkDelete(data)
          return {
            success: true,
            data: result,
            message: `${result.deleted} participantes eliminados`,
          }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )

  // ─── IMPORT_CSV: Importación masiva (HU-D5) ────────────────

  /**
   * Canal: participants:importCsv
   * Payload: ImportCsvInput { eventId, rows: CsvRow[] }
   * Response: ApiResponse<{ imported, errors, total }>
   *
   * Flujo:
   * 1. Renderer parsea Excel/CSV → extrae filas
   * 2. Valida cada fila contra CsvRowSchema (frontend)
   * 3. Envía array de filas por IPC
   * 4. Main re-valida con ImportCsvSchema
   * 5. ParticipantService valida duplicados
   * 6. ParticipantRepository.inserta en transacción
   * 7. Retorna resumen de la importación
   */
  ipcMain.handle(
    channels.IMPORT_CSV,
    requireAdmin(
      async (_, payload): Promise<ApiResponse<any>> => {
        try {
          const data = ImportCsvSchema.parse(payload)
          const result = await participantService.importCsv(data)
          return {
            success: true,
            data: result,
            message: `${result.imported} de ${result.total} registros importados`,
          }
        } catch (err) {
          return {
            success: false,
            error: (err as Error).message,
          }
        }
      }
    )
  )
}
