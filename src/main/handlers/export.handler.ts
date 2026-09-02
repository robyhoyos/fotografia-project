// src/main/handlers/export.handler.ts
// Handler IPC para exportación de datos a Excel (.xlsx).
// Permite exportar la lista de participantes de un evento con formato profesional.
//
// Dirección de diseño (frontend-design):
// - Banner de marca: banda oscura con el nombre comercial + tagline, color de pestaña = acento
// - Franja de evento en el color de acento configurado (texto del evento + fecha)
// - Encabezado de tabla con relleno de acento, texto blanco en mayúsculas y autofiltros
// - Inmovilización de encabezados (freeze de las 5 primeras filas + datos desde A6)
// - Filas de datos con bandeo suave (alternancia blanco / #F8FAFC) y divisorias grises
// - Formato contable (COP con separador de miles) en columnas financieras
// - Fila TOTAL con sumas de Total / Pagado / Pendiente y borde medio de acento
// - Formato condicional de estado: rojo claro en SIN_PAGO, verde claro en PAGO_TOTAL
// - Configuración de impresión: horizontal, ajustado a 1 página de ancho, filas 1-5 repetidas
// - Limpieza de datos: elimina columnas 100% vacías (Cédula, Fecha Entrega, etc.)

import path from 'path'
import { ipcMain, dialog, BrowserWindow } from 'electron'
import { Workbook, type Cell, type Fill, type Border } from 'exceljs'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import prisma from '../database/prisma'
import type { SettingsService } from '../services/settings.service'
import { requireAdmin } from '../auth/permissions'

const channels = IPC_CHANNELS.EXPORT

// ─── Paleta de formato ──────────────────────────────────────────────
const DARK_BG = 'FF0F172A' // Banner de marca (tinta casi negra)
const LIGHT_BG = 'FFF8FAFC' // Bandeo de filas de datos
const PRODUCT_BG = 'FFF1F5F9' // Fila de totales
const MUTED_FG = 'FF64748B' // Texto secundario (fecha de generación)
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

// Colores en hex #RRGGBB → ARGB FF
function toArgb(hex?: string): string | null {
  if (typeof hex !== 'string' || !/^#([0-9a-fA-F]{6})$/.test(hex)) return null
  return 'FF' + hex.slice(1).toUpperCase()
}

// Índice de columna (1-based) → letra de columna de Excel ("A", "B", …)
function columnLetter(index: number): string {
  let n = index
  let letters = ''
  while (n > 0) {
    const mod = (n - 1) % 26
    letters = String.fromCharCode(65 + mod) + letters
    n = Math.floor((n - 1) / 26)
  }
  return letters
}

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
 * @param {SettingsService} settingsService - Para leer la carpeta de exportación y personalización (acento, nombre/tagline).
 * @description Registra los handlers IPC para exportación de datos.
 */
export function registerExportHandlers(settingsService: SettingsService) {
  // ─── Exportar participantes a Excel (.xlsx) ──────────────────────
  ipcMain.handle(channels.XLSX_PARTICIPANTS, requireAdmin(async (event, payload: { eventId: string }) => {
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

      const settings = await settingsService.getMany([
        'export_directory',
        'pdf_accent_color',
        'business_name',
        'business_tagline',
      ])

      const exportDir = settings['export_directory'] || ''
      const accent = toArgb(settings['pdf_accent_color'] as string) ?? 'FF22C55E'
      const businessName = (settings['business_name'] as string)?.trim() || 'FotoApp'
      const tagline = (settings['business_tagline'] as string)?.trim() || 'Gestión Fotográfica de Eventos'
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
        total?: boolean
      }> = [
        { header: 'Nombre', key: 'name' },
        { header: 'Cédula', key: 'cedula' },
        { header: 'Teléfono', key: 'phone' },
        { header: 'Email', key: 'email' },
        { header: 'Cantidad', key: 'quantity', integer: true },
        { header: 'Precio Unitario', key: 'unitPrice', currency: true },
        { header: 'Total', key: 'total', currency: true, total: true },
        { header: 'Estado', key: 'status' },
        { header: 'Estado Pago', key: 'paymentStatus' },
        { header: 'Pagado', key: 'paidAmount', currency: true, total: true },
        { header: 'Pendiente', key: 'outstanding', currency: true, total: true },
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
      ws.properties.tabColor = { argb: accent }
      ws.properties.defaultRowHeight = 18

      const lastCol = columns.length
      const lastColLetter = columnLetter(lastCol)

      // ─── Banner de marca ───────────────────────────────────────
      // Fila 1: banda oscura con el nombre comercial + tagline
      ws.mergeCells(1, 1, 1, lastCol)
      const brandRow = ws.getRow(1)
      brandRow.height = 34
      const brandCell = ws.getCell(1, 1)
      brandCell.value = `${businessName.toUpperCase()}    •    ${tagline.toUpperCase()}`
      brandCell.font = { bold: true, size: 13, color: { argb: 'FFFFFFFF' } }
      brandCell.alignment = { vertical: 'middle', horizontal: 'left' }
      brandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK_BG } }

      // Fila 2: franja del evento — texto en el color de acento
      ws.mergeCells(2, 1, 2, lastCol)
      const eventRow = ws.getRow(2)
      eventRow.height = 20
      const eventCell = ws.getCell(2, 1)
      eventCell.value = `EVENTO: ${eventRecord.name.toUpperCase()}   •   ${formatDate(eventRecord.date)}`
      eventCell.font = { bold: true, size: 11, color: { argb: accent } }
      eventCell.alignment = { vertical: 'middle', horizontal: 'left' }

      // Fila 3: metadatos de generación
      ws.mergeCells(3, 1, 3, lastCol)
      const metaRow = ws.getRow(3)
      metaRow.height = 16
      const metaCell = ws.getCell(3, 1)
      const generatedAt = new Date().toLocaleString('es-CO', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
      metaCell.value = `Generado el ${generatedAt}   •   ${participants.length} participantes`
      metaCell.font = { italic: true, size: 9, color: { argb: MUTED_FG } }
      metaCell.alignment = { vertical: 'middle', horizontal: 'left' }

      // Fila 4: respiro espacial
      ws.getRow(4).height = 6

      // ─── Encabezado de tabla (fila 5) ──────────────────────────
      const headerRow = ws.getRow(5)
      headerRow.height = 26
      columns.forEach((col, idx) => {
        const cell = headerRow.getCell(idx + 1)
        cell.value = col.header.toUpperCase()
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 }
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: accent } }
        cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
        cell.border = {
          top: { style: 'thin', color: { argb: accent } },
          left: BORDER_GRAY,
          bottom: { style: 'thin', color: { argb: accent } },
          right: BORDER_GRAY,
        }
      })

      // ─── Inmovilización: congelar filas 1-5 ─────────────────────
      ws.views = [{ state: 'frozen', ySplit: 5, topLeftCell: 'A6', activeCell: 'A6' }]

      // ─── Autofiltros sobre el encabezado ───────────────────────
      ws.autoFilter = {
        from: { row: 5, column: 1 },
        to: { row: 5, column: columns.length },
      }

      // ─── Filas de datos ────────────────────────────────────────
      let maxWidths: number[] = columns.map((col) => col.header.length)

      const FIRST_DATA_ROW = 6
      rows.forEach((row, rowIdx) => {
        const excelRow = ws.getRow(rowIdx + FIRST_DATA_ROW)
        const rowFill = fillForPayment(row.paymentStatus)
        const banded = rowIdx % 2 === 1 && !rowFill

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
          cell.border = allBorders()
          if (rowFill) {
            cell.fill = rowFill
          } else if (banded) {
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: LIGHT_BG } }
          }
        })
      })

      // ─── Fila de totales ───────────────────────────────────────
      const lastDataRow = FIRST_DATA_ROW + rows.length - 1
      const totalRow = ws.getRow(lastDataRow + 1)
      totalRow.height = 22
      columns.forEach((col, colIdx) => {
        const cell = totalRow.getCell(colIdx + 1)

        if (col.key === 'name') {
          cell.value = 'TOTAL'
          cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
          cell.alignment = { vertical: 'middle', horizontal: 'left' }
        } else if (col.total) {
          const sum = rows.reduce((acc, row) => acc + (Number(row[col.key]) as number), 0)
          cell.value = sum as Cell['value']
          cell.numFmt = ACCOUNTING_FORMAT
          cell.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } }
          cell.alignment = { vertical: 'middle', horizontal: 'right' }
          const shown = moneyDisplay(sum)
          if (shown.length > maxWidths[colIdx]) maxWidths[colIdx] = shown.length
        } else {
          cell.value = '' as Cell['value']
          cell.font = { size: 10 }
        }

        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PRODUCT_BG } }
        cell.border = {
          top: { style: 'medium', color: { argb: accent } },
          left: colIdx === 0 ? BORDER_GRAY : undefined,
          bottom: { style: 'double', color: { argb: 'FFCBD5E1' } },
          right: undefined,
        }
      })

      // ─── Auto-ajuste del ancho de columnas ─────────────────────
      columns.forEach((col, colIdx) => {
        ws.getColumn(colIdx + 1).width = Math.min(
          Math.max(maxWidths[colIdx] + 3, 10),
          55
        )
      })

      // ─── Configuración de impresión ────────────────────────────
      ws.pageSetup = {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9, // A4
        margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 },
        printTitlesRow: `1:${headerRow.number}`,
      }

      await workbook.xlsx.writeFile(result.filePath)

      return {
        success: true,
        data: { path: result.filePath, count: participants.length },
        message: `${participants.length} participantes exportados exitosamente`,
      }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  }))
}

// ─── Helpers de estilo ──────────────────────────────────────────────
// Reemplazo de la constante BORDER_GRAY reutilizada como función para
// evitar compartir el mismo objeto entre múltiples celdas.
function allBorders(): Partial<Record<'top' | 'left' | 'bottom' | 'right', Partial<Border>>> {
  return {
    top: { ...BORDER_GRAY },
    left: { ...BORDER_GRAY },
    bottom: { ...BORDER_GRAY },
    right: { ...BORDER_GRAY },
  }
}

function fillForPayment(paymentStatus: string): Fill | undefined {
  if (paymentStatus === 'SIN_PAGO') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: SIN_PAGO_BG } }
  }
  if (paymentStatus === 'PAGO_TOTAL') {
    return { type: 'pattern', pattern: 'solid', fgColor: { argb: PAGO_TOTAL_BG } }
  }
  return undefined
}