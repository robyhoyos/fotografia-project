// src/main/handlers/pdf.handler.ts
// Handler IPC para generación de documentos PDF.
// Actualmente solo soporta recibos de pago.

import { ipcMain, BrowserWindow } from 'electron'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import { generateReceiptPDF } from '../services/pdf.service'
import { requireAdmin } from '../auth/permissions'

const channels = IPC_CHANNELS.PDF

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

      const filePath = await generateReceiptPDF(win, payload)

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
