// src/main/handlers/payment.handler.ts
// Handler IPC para operaciones del ledger de pagos.
// Cada registro es una transacción individual con monto, método y fecha.

import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import type { ApiResponse } from '../../../shared/types/ipc'
import type { RawPayment, RawParticipantPayments } from '../types/raw'
import { PaymentService } from '../services/payment.service'
import { requireStaff } from '../auth/permissions'

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

const CorrectPaymentSchema = z.object({
  participantId: z.string().cuid(),
})

/**
 * @function registerPaymentHandlers
 * @description Registra los handlers IPC para el ledger de pagos.
 *
 * Canales:
 * - payments:create → Registra un pago individual (ADMIN y AYUDANTE)
 * - payments:findByParticipant → Historial de pagos de un participante
 * - payments:delete → Elimina un pago y recalcula saldo (ADMIN y AYUDANTE)
 * - payments:correct → Deshace el último pago erróneo y recalcula (ADMIN y AYUDANTE)
 */
export function registerPaymentHandlers(paymentService: PaymentService) {
  // ─── Crear pago ────────────────────────────────────────────
  ipcMain.handle(channels.CREATE, requireStaff(async (_, payload): Promise<ApiResponse<RawPayment>> => {
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
  ipcMain.handle(channels.FIND_BY_PARTICIPANT, async (_, payload): Promise<ApiResponse<RawParticipantPayments>> => {
    try {
      const data = FindByParticipantSchema.parse(payload)
      const result = await paymentService.findByParticipant(data.participantId)
      return { success: true, data: result }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Eliminar pago ─────────────────────────────────────────
  ipcMain.handle(channels.DELETE, requireStaff(async (_, payload): Promise<ApiResponse<{ deleted: boolean }>> => {
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

  // ─── Corregir pago erróneo ────────────────────────────────
  ipcMain.handle(channels.CORRECT, requireStaff(async (_, payload): Promise<ApiResponse<unknown>> => {
    try {
      const data = CorrectPaymentSchema.parse(payload)
      const result = await paymentService.correct(data.participantId)
      return {
        success: true,
        data: result,
        message: 'Pago corregido y saldo recalculado',
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }))
}
