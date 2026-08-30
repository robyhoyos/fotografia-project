// src/main/handlers/export.handler.ts
// Handler IPC para exportación de datos a Excel (.xlsx).
// Permite exportar la lista de participantes de un evento con formato profesional:
// - Limpieza de datos: elimina columnas 100% vacías (Cédula, Fecha Entrega, etc.)
// - Encabezados con fondo oscuro (#1F2937), texto blanco en negrita y autofiltros
// - Inmovilización de la primera fila (freeze_panes → A2)
// - Formato contable (COP con separador de miles) en columnas financieras
// - Auto-ajuste del ancho de columnas según el contenido
// - Formato condicional: rojo claro en SIN_PAGO, verde claro en PAGO_TOTAL

import path from 'path'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { Workbook, type Cell, type Fill, type Border } from 'exceljs'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import prisma from '../database/prisma'
import type { SettingsService } from '../services/settings.service'

const channels = IPC_CHANNELS.EXPORT

// ─── Paleta de formato ──────────────────────────────────────────────
const HEADER_BG = 'FF1F2937' // Encabezado oscuro
const HEADER_FG = 'FFFFFFFF' // Texto blanco
const SIN_PAGO_BG = 'FFFEE2E2' // Rojo claro: estado de pago SIN_PAGO
const PAGO_TOTAL_BG = 'FFDCFCE7' // Verde claro: estado de pago PAGO_TOTAL
const BORDER_GRAY: Partial<Border> = {
  style: 'thin',
  color: { argb: 'FFE5E7EB' },
}

// $1.234.567,00 → formato contable con símbolo y separador de miles
const ACCOUNTING_FORMAT = '"$"#,##0.00'
// Cantidad entera con separador de miles
const INTEGER_FORMAT = '#,##0'

/**
 * @function formatDate
 * @description Formatea una fecha ISO a formato legible dd/mm/yyyy.
 */
function formatDate(date: Date | string | null): string {
  if (!date) return ''
  return new Date(date).toLocaleDateString('es-CO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

/**
 * @function moneyDisplay
 * @description Representación legible de un monto monetario (para auto-ancho).
 */
function moneyDisplay(value: number): string {
  return `$${Math.abs(value).toLocaleString('es-CO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

/**
 * @function registerExportHandlers
 * @param {SettingsService} settingsService - Para leer la carpeta de exportación por defecto.
 * @description Registra los handlers IPC para exportación de datos.
 */
export function registerExportHandlers(settingsService: SettingsService) {
  // ─── Exportar participantes a Excel (.xlsx) ──────────────────────
  ipcMain.handle(channels.XLSX_PARTICIPANTS, async (event, payload: { eventId: string }) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return { success: false, error: 'No se encontró la ventana principal' }
      }

      const { eventId } = payload

      const eventRecord = await prisma.event.findUnique({
        where: { id: eventId },
        select: { name: true, date: true },
      })

      if (!eventRecord) {
        return { success: false, error: 'Evento no encontrado' }
      }

      const participants = await prisma.participant.findMany({
        where: { eventId },
        orderBy: { name: 'asc' },
      })

      if (participants.length === 0) {
        return { success: false, error: 'No hay participantes para exportar' }
      }

      const exportSettings = await settingsService.getMany(['export_directory'])
      const exportDir = exportSettings['export_directory'] || ''
      const fileName = `${eventRecord.name.replace(/\s+/g, '-').toLowerCase()}-participantes.xlsx`

      const result = await dialog.showSaveDialog(win, {
        title: 'Exportar participantes a Excel',
        defaultPath: exportDir ? path.join(exportDir, fileName) : fileName,
        filters: [{ name: 'Archivo Excel', extensions: ['xlsx'] }],
      })

      if (result.canceled || !result.filePath) {
        return { success: false, error: 'Operación cancelada por el usuario' }
      }

      // ─── Datos planos ──────────────────────────────────────────
      const rows = participants.map((p) => {
        const unitPrice = p.unitPrice ?? 0
        const total = unitPrice * p.quantity
        const outstanding = Math.max(total - p.paidAmount, 0)

        return {
          name: p.name,
          cedula: p.cedula ?? '',
          phone: p.phone ?? '',
          email: p.email ?? '',
          quantity: p.quantity,
          unitPrice,
          total,
          status: p.status,
          paymentStatus: p.paymentStatus,
          paidAmount: p.paidAmount,
          outstanding,
          deliveredAt: formatDate(p.deliveredAt),
          barcode: p.barcode ?? '',
          notes: p.notes ?? '',
        }
      })

      // ─── Definición de columnas (orden del reporte) ─────────────
      const columnDefs: Array<{
        header: string
        key: keyof (typeof rows)[number]
        currency?: boolean
        integer?: boolean
      }> = [
        { header: 'Nombre', key: 'name' },
        { header: 'Cédula', key: 'cedula' },
        { header: 'Teléfono', key: 'phone' },
        { header: 'Email', key: 'email' },
        { header: 'Cantidad', key: 'quantity', integer: true },
        { header: 'Precio Unitario', key: 'unitPrice', currency: true },
        { header: 'Total', key: 'total', currency: true },
        { header: 'Estado', key: 'status' },
        { header: 'Estado Pago', key: 'paymentStatus' },
        { header: 'Pagado', key: 'paidAmount', currency: true },
        { header: 'Pendiente', key: 'outstanding', currency: true },
        { header: 'Fecha Entrega', key: 'deliveredAt' },
        { header: 'Código Barras', key: 'barcode' },
        { header: 'Notas', key: 'notes' },
      ]

      // ─── Limpieza de datos: eliminar columnas 100% vacías ───────
      const columns = columnDefs.filter((col) =>
        rows.some((row) => String(row[col.key]).trim().length > 0)
      )

      const workbook = new Workbook()
      const ws = workbook.addWorksheet('Participantes')

      // ─── Inmovilización: congelar la primera fila ───────────────
      ws.views = [{ state: 'frozen', ySplit: 1, topLeftCell: 'A2', activeCell: 'A2' }]

      const headerFill: Fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: HEADER_BG },
      }

      const headerBorder: Partial<Border> = {
        style: 'thin',
        color: { argb: 'FF374151' },
      }

      const allBorders: Partial<Record<'top' | 'left' | 'bottom' | 'right', Partial<Border>>> = {
        top: BORDER_GRAY,
        left: BORDER_GRAY,
        bottom: BORDER_GRAY,
        right: BORDER_GRAY,
      }

      const fillForPayment = (paymentStatus: string): Fill | undefined => {
        if (paymentStatus === 'SIN_PAGO') {
          return { type: 'pattern', pattern: 'solid', fgColor: { argb: SIN_PAGO_BG } }
        }
        if (paymentStatus === 'PAGO_TOTAL') {
          return { type: 'pattern', pattern: 'solid', fgColor: { argb: PAGO_TOTAL_BG } }
        }
        return undefined
      }

      // ─── Encabezados con estilo ────────────────────────────────
      const headerRow = ws.getRow(1)
      headerRow.height = 22
      columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1)
        cell.value = col.header
        cell.font = { bold: true, color: { argb: HEADER_FG }, size: 11 }
        cell.fill = headerFill
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = allBorders
        // Redefinir border del encabezado con el gris de la paleta
        cell.border = {
          top: headerBorder,
          left: headerBorder,
          bottom: headerBorder,
          right: headerBorder,
        }
      })

      // ─── Autofiltros en todas las columnas ─────────────────────
      ws.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: 1, column: columns.length },
      }

      // ─── Filas de datos ────────────────────────────────────────
      let maxWidths: number[] = columns.map((col) => col.header.length)

      rows.forEach((row, rowIdx) => {
        const excelRow = ws.getRow(rowIdx + 2)
        const rowFill = fillForPayment(row.paymentStatus)

        columns.forEach((col, colIdx) => {
          const raw = row[col.key]
          const value = typeof raw === 'string' ? raw : raw
          const cell = excelRow.getCell(colIdx + 1)

          if (col.currency) {
            cell.value = Number(value) as Cell['value']
            cell.numFmt = ACCOUNTING_FORMAT
            const shown = moneyDisplay(Number(value))
            if (shown.length > maxWidths[colIdx]) maxWidths[colIdx] = shown.length
          } else if (col.integer) {
            cell.value = Number(value) as Cell['value']
            cell.numFmt = INTEGER_FORMAT
            const shown = Number(value).toLocaleString('es-CO')
            if (shown.length > maxWidths[colIdx]) maxWidths[colIdx] = shown.length
          } else {
            cell.value = value as Cell['value']
            const shown = String(value ?? '')
            if (shown.length > maxWidths[colIdx]) maxWidths[colIdx] = shown.length
          }

          cell.font = { size: 10 }
          cell.alignment = {
            vertical: 'middle',
            horizontal: col.currency ? 'right' : col.integer ? 'center' : 'left',
          }
          cell.border = allBorders
          if (rowFill) cell.fill = rowFill
        })
      })

      // ─── Auto-ajuste del ancho de columnas ─────────────────────
      columns.forEach((col, colIdx) => {
        ws.getColumn(colIdx + 1).width = Math.min(
          Math.max(maxWidths[colIdx] + 3, 10),
          55
        )
      })

      await workbook.xlsx.writeFile(result.filePath)

      return {
        success: true,
        data: { path: result.filePath, count: participants.length },
        message: `${participants.length} participantes exportados exitosamente`,
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}