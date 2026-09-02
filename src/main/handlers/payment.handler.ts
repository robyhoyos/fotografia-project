// src/main/handlers/payment.handler.ts
// Handler IPC para operaciones del ledger de pagos.
// Cada registro es una transacción individual con monto, método y fecha.

import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import { PaymentService } from '../services/payment.service'
import { requireAdmin } from '../auth/permissions'

const channels = IPC_CHANNELS.PAYMENTS

// ─── Schemas de validación ──────────────────────────────────────────

const CreatePaymentSchema = z.object({
  participantId: z.string().cuid(),
  amount: z.number().positive('El monto debe ser mayor a 0'),
  method: z.string().max(50).nullable().optional(),
  notes: z.string().max(200).nullable().optional(),
})

const FindByParticipantSchema = z.object({
  participantId: z.string().cuid(),
})

const DeletePaymentSchema = z.object({
  id: z.string().cuid(),
})

/**
 * @function registerPaymentHandlers
 * @description Registra los handlers IPC para el ledger de pagos.
 *
 * Canales:
 * - payments:create → Registra un pago individual
 * - payments:findByParticipant → Historial de pagos de un participante
 * - payments:delete → Elimina un pago y recalcula saldo
 */
export function registerPaymentHandlers(paymentService: PaymentService) {
  // ─── Crear pago ────────────────────────────────────────────
  ipcMain.handle(channels.CREATE, requireAdmin(async (_, payload) => {
    try {
      const data = CreatePaymentSchema.parse(payload)
      const payment = await paymentService.create(data)
      return {
        success: true,
        data: payment,
        message: 'Pago registrado exitosamente',
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }))

  // ─── Historial por participante ─────────────────────────────
  ipcMain.handle(channels.FIND_BY_PARTICIPANT, async (_, payload) => {
    try {
      const data = FindByParticipantSchema.parse(payload)
      const result = await paymentService.findByParticipant(data.participantId)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Eliminar pago ─────────────────────────────────────────
  ipcMain.handle(channels.DELETE, requireAdmin(async (_, payload) => {
    try {
      const data = DeletePaymentSchema.parse(payload)
      const result = await paymentService.delete(data.id)
      return {
        success: true,
        data: result,
        message: 'Pago eliminado y saldo recalculado',
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }))
}
