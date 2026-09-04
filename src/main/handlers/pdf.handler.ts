// src/main/handlers/pdf.handler.ts
// Handler IPC para generación de documentos PDF.
// Actualmente solo soporta recibos de pago.

import { ipcMain, BrowserWindow } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import { generateReceiptPDF } from '../services/pdf.service'
import { requireAdmin } from '../auth/permissions'

const channels = IPC_CHANNELS.PDF

// ─── Schemas de validación ──────────────────────────────────────────
// Alineado con ReceiptData de pdf.service.ts.
const PaymentSchema = z.object({
  amount: z.number().finite('Monto inválido'),
  method: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.union([z.string(), z.date()]),
})

const ReceiptInputSchema = z.object({
  businessName: z.string().optional(),
  businessTagline: z.string().optional(),
  pdfPageSize: z.enum(['A4', 'Letter', 'Legal']).optional(),
  pdfAccentColor: z.string().regex(/^#([0-9a-fA-F]{6})$/, 'Color hex inválido').optional(),
  eventName: z.string().min(1, 'El nombre del evento es obligatorio'),
  eventDate: z.union([z.string(), z.date()]),
  eventLocation: z.string().nullable().optional(),
  participantName: z.string().min(1, 'El nombre del participante es obligatorio'),
  participantCedula: z.string().nullable().optional(),
  participantPhone: z.string().nullable().optional(),
  participantEmail: z.string().nullable().optional(),
  quantity: z.number().finite('Cantidad inválida').min(0),
  unitPrice: z.number().finite('Precio inválido').min(0),
  coverPrice: z.number().finite('Precio inválido').min(0),
  totalCost: z.number().finite('Monto inválido').min(0),
  paidAmount: z.number().finite('Monto inválido').min(0),
  outstanding: z.number().finite('Monto inválido').min(0),
  paymentStatus: z.string(),
  payments: z.array(PaymentSchema),
})

/**
 * @function registerPdfHandlers
 * @description Registra los handlers IPC para generación de PDFs.
 */
export function registerPdfHandlers() {
  // ─── Generar recibo de pago ────────────────────────────────
  ipcMain.handle(channels.GENERATE_RECEIPT, requireAdmin(async (event, payload) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return { success: false, error: 'No se encontró la ventana principal' }
      }

      const data = ReceiptInputSchema.parse(payload)
      const filePath = await generateReceiptPDF(win, data as Parameters<typeof generateReceiptPDF>[1])

      return {
        success: true,
        data: { path: filePath },
        message: 'Recibo generado exitosamente',
      }
    } catch (err) {
      if ((err as Error).message === 'Operación cancelada por el usuario') {
        return { success: false, error: 'Operación cancelada por el usuario' }
      }
      return { success: false, error: (err as Error).message }
    }
  }))
}
