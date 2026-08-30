// src/main/services/pdf.service.ts
// Service para generar PDFs de recibos de pago.
// Rediseño minimalista y moderno:
// - Cuadrícula Cliente | Evento para equilibrar el espacio en blanco
// - Jerarquía tipográfica: etiquetas gris medio (#6b7280) / valores gris oscuro (#111827)
// - Fallbacks: datos faltantes o fechas inválidas → "No especificado" en cursiva gris
// - Tablas (Detalle y Transacciones) con divisorias sutiles (#e5e7eb) y montos a la derecha
// - Badges de estado con fondos suaves (sin verdes/rojos puros)
// - Caja de totales alineada a la derecha para lectura de un vistazo

import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { dialog, BrowserWindow } from 'electron'

interface ReceiptData {
  businessName?: string
  businessTagline?: string
  pdfPageSize?: 'A4' | 'Letter' | 'Legal'
  pdfAccentColor?: string
  eventName: string
  eventDate: string
  eventLocation: string | null
  participantName: string
  participantCedula: string | null
  participantPhone: string | null
  participantEmail: string | null
  quantity: number
  unitPrice: number
  coverPrice: number
  totalCost: number
  paidAmount: number
  outstanding: number
  paymentStatus: string
  payments: {
    amount: number
    method: string | null
    notes: string | null
    createdAt: string
  }[]
}

// ─── Tokens de diseño ──────────────────────────────────────────────
// Fuente sans-serif limpia (Helvetica, embebida en PDF).
const FONT = 'Helvetica'
const FONT_BOLD = 'Helvetica-Bold'
const FONT_OBLIQUE = 'Helvetica-Oblique'

const C_VALUE = '#111827' // valores de datos (gris oscuro)
const C_LABEL = '#6b7280' // etiquetas (gris medio)
const C_MUTED = '#9ca3af' // "No especificado" / texto secundario
const C_BORDER = '#e5e7eb' // divisorias sutiles
const C_CARD = '#f9fafb' // fondo de la caja de totales
const GREEN_TEXT = '#16a34a' // monto pagado
const RED_TEXT = '#dc2626' // saldo pendiente (deuda)
const FALLBACK = 'No especificado'

// Badges de estado — fondos suaves con texto oscuro (sin colores puros)
const BG_GREEN = '#dcfce7'
const TXT_GREEN = '#15803d'
const BG_RED = '#fee2e2'
const TXT_RED = '#b91c1c'
const BG_AMBER = '#fef3c7'
const TXT_AMBER = '#b45309'

const MARGIN = 50
const BOTTOM_LIMIT = 735

const PAGE_WIDTHS: Record<string, number> = { A4: 595.28, Letter: 612, Legal: 612 }

const DEFAULT_BRAND = 'FotoApp'
const DEFAULT_TAGLINE = 'Gestión Fotográfica de Eventos'

/**
 * @function isHexColor
 * @description Valida que un color sea hexadecimal (#RRGGBB).
 */
function isHexColor(value?: string): boolean {
  return typeof value === 'string' && /^#([0-9a-fA-F]{6})$/.test(value)
}

/**
 * @function formatCOP
 * @description Formatea número a pesos colombianos.
 */
function formatCOP(value: number): string {
  return '$' + Math.round(value).toLocaleString('es-CO')
}

/**
 * @function has
 * @description Verifica si un texto opcional tiene contenido real.
 */
function has(value?: string | null): boolean {
  return !!value && value.trim().length > 0
}

/**
 * @function formatDate
 * @description Formatea una fecha ISO. Devuelve '' si la fecha es inválida
 * (evita renderizar "Invalid Date"; el render lo muestra como "No especificado").
 */
function formatDate(iso: string, opts: Intl.DateTimeFormatOptions): string {
  const date = new Date(iso)
  if (isNaN(date.getTime())) return ''
  return date.toLocaleDateString('es-CO', opts)
}

/**
 * @function generateReceiptPDF
 * @description Genera un PDF de recibo de pago y lo guarda en disco.
 * Retorna la ruta del archivo generado.
 */
export async function generateReceiptPDF(
  win: BrowserWindow,
  data: ReceiptData
): Promise<string> {
  const result = await dialog.showSaveDialog(win, {
    title: 'Guardar recibo de pago',
    defaultPath: `recibo-${(data.participantName || 'cliente').replace(/\s+/g, '-').toLowerCase()}.pdf`,
    filters: [
      { name: 'Documento PDF', extensions: ['pdf'] },
    ],
  })

  if (result.canceled || !result.filePath) {
    throw new Error('Operación cancelada por el usuario')
  }

  return new Promise((resolve, reject) => {
    const pageSize = data.pdfPageSize ?? 'A4'
    const pageWidth = PAGE_WIDTHS[pageSize] ?? PAGE_WIDTHS.A4
    const RIGHT = pageWidth - MARGIN
    const CONTENT_W = RIGHT - MARGIN

    const brandName = data.businessName?.trim() || DEFAULT_BRAND
    const brandTagline = data.businessTagline?.trim() || DEFAULT_TAGLINE
    const accent: string =
      data.pdfAccentColor && isHexColor(data.pdfAccentColor)
        ? data.pdfAccentColor
        : '#22c55e'

    const doc = new PDFDocument({
      size: pageSize as 'A4' | 'Letter' | 'Legal',
      margins: { top: 45, bottom: 45, left: MARGIN, right: MARGIN },
    })

    const stream = fs.createWriteStream(result.filePath)
    doc.pipe(stream)

    // ─── Helpers de dibujo ─────────────────────────────────────

    const drawHR = (y: number) => {
      doc.moveTo(MARGIN, y).lineTo(RIGHT, y).strokeColor(C_BORDER).lineWidth(0.75).stroke()
    }

    // Etiqueta (gris medio #6b7280, pequeña, mayúscula)
    const label = (x: number, y: number, text: string, width: number) => {
      doc.font(FONT_BOLD).fontSize(8).fillColor(C_LABEL)
        .text(text.toUpperCase(), x, y, { width, characterSpacing: 0.6, lineBreak: false })
    }

    // Valor de dato (gris oscuro #111827). Si falta → "No especificado" en cursiva gris.
    const value = (x: number, y: number, text: string | null | undefined, width: number) => {
      const missing = !has(text)
      doc
        .font(missing ? FONT_OBLIQUE : FONT_BOLD)
        .fontSize(missing ? 9.5 : 10.5)
        .fillColor(missing ? C_MUTED : C_VALUE)
        .text(missing ? FALLBACK : (text as string), x, y, { width, lineBreak: false })
    }

    // Monto monetario (alineado a la derecha)
    const amountValue = (x: number, y: number, amount: number, width: number) => {
      doc.font(FONT_BOLD).fontSize(10.5).fillColor(C_VALUE)
        .text(formatCOP(amount), x, y, { width, align: 'right', lineBreak: false })
    }

    const sectionLabel = (y: number, text: string) => {
      label(MARGIN, y, text, CONTENT_W)
    }

    // Badge de estado: fondo redondeado suave + texto oscuro
    const badge = (x: number, y: number, text: string, bg: string, fg: string) => {
      doc.font(FONT_BOLD).fontSize(7.5)
      const w = doc.widthOfString(text.toUpperCase()) + 20
      const h = 16
      doc.roundedRect(x, y, w, h, 8).fillColor(bg).fill()
      doc
        .roundedRect(x, y, w, h, 8)
        .strokeColor(C_BORDER)
        .lineWidth(0.75)
        .stroke()
      doc.fillColor(fg).text(text.toUpperCase(), x + 10, y + 4.5, { width: w, lineBreak: false })
      return w
    }

    // ─── Encabezado de marca ────────────────────────────────────
    let y = 45

    // Marca (izquierda)
    doc.font(FONT_BOLD).fontSize(20).fillColor(accent)
      .text(brandName.toUpperCase(), MARGIN, y, { width: 200, lineBreak: false })
    doc.font(FONT).fontSize(9).fillColor(C_LABEL)
      .text(brandTagline, MARGIN, y + 23, { width: 260, lineBreak: false })

    // Título del recibo (derecha)
    doc.font(FONT_BOLD).fontSize(13).fillColor(C_VALUE)
      .text('RECIBO DE PAGO', 330, y, { width: 215, align: 'right', lineBreak: false })
    doc.font(FONT).fontSize(9).fillColor(C_LABEL)
      .text(
        `Emitido: ${formatDate(new Date().toISOString(), { day: '2-digit', month: 'long', year: 'numeric' })}`,
        330,
        y + 20,
        { width: 215, align: 'right', lineBreak: false }
      )

    y += 50
    drawHR(y)
    y += 20

    // ─── Cuadrícula de datos: Cliente (izq) | Evento (der) ──────
    const colL = MARGIN
    const colR = 320
    const colW = 225

    const infoRow = (
      rowY: number,
      leftLabelText: string,
      leftValue: string | null | undefined,
      rightLabelText: string,
      rightValue: string | null | undefined
    ) => {
      label(colL, rowY, leftLabelText, colW)
      value(colL, rowY + 10, leftValue, colW)
      label(colR, rowY, rightLabelText, colW)
      value(colR, rowY + 10, rightValue, colW)
    }

    infoRow(y, 'Nombre', data.participantName, 'Evento', data.eventName)
    y += 34
    infoRow(y, 'Teléfono', data.participantPhone, 'Fecha', formatDate(data.eventDate, { day: '2-digit', month: 'long', year: 'numeric' }))
    y += 34
    infoRow(y, 'Email', data.participantEmail, 'Lugar', data.eventLocation)
    y += 34
    label(colL, y, 'Cédula', colW)
    value(colL, y + 10, data.participantCedula, colW)
    y += 32 // margen inferior del bloque Cliente/Evento antes de la tabla

    // ─── Tabla: Detalle de la compra ─────────────────────────────
    sectionLabel(y, 'Detalle de la compra')
    y += 18

    const detCols = [
      { x: MARGIN, w: 190, align: 'left' as const },
      { x: 250, w: 70, align: 'center' as const },
      { x: 330, w: 100, align: 'right' as const },
      { x: 455, w: 90, align: 'right' as const },
    ]

    label(detCols[0].x, y, 'Descripción', detCols[0].w)
    label(detCols[1].x, y, 'Cantidad', detCols[1].w)
    label(detCols[2].x, y, 'Precio unit.', detCols[2].w)
    label(detCols[3].x, y, 'Total', detCols[3].w)

    y += 16
    drawHR(y)
    y += 14

    const price = data.unitPrice || data.coverPrice
    doc.font(FONT).fontSize(10).fillColor(C_VALUE)

    doc.text('Fotografías / copias', detCols[0].x, y, { width: detCols[0].w, lineBreak: false })
    doc.text(String(data.quantity), detCols[1].x, y, { width: detCols[1].w, align: detCols[1].align, lineBreak: false })
    doc.text(formatCOP(price), detCols[2].x, y, { width: detCols[2].w, align: detCols[2].align, lineBreak: false })
    amountValue(detCols[3].x, y, data.totalCost, detCols[3].w)

    y += 20
    drawHR(y)
    y += 28 // margen inferior de la tabla Detalle

    // ─── Caja de totales: Resumen de Pago (derecha) ─────────────
    const boxW = 252
    const boxX = RIGHT - boxW

    const status =
      data.paymentStatus === 'PAGO_TOTAL'
        ? { text: 'Pagado', bg: BG_GREEN, fg: TXT_GREEN }
        : data.paymentStatus === 'PAGO_PARCIAL'
        ? { text: 'Pago parcial', bg: BG_AMBER, fg: TXT_AMBER }
        : { text: 'Pendiente', bg: BG_RED, fg: TXT_RED }

    const boxH = 108
    doc.roundedRect(boxX, y, boxW, boxH, 10).fillColor(C_CARD).fill()
    doc.roundedRect(boxX, y, boxW, boxH, 10).strokeColor(C_BORDER).lineWidth(1).stroke()

    doc.font(FONT_BOLD).fontSize(8).fillColor(C_LABEL)
      .text('RESUMEN DE PAGO', boxX + 14, y + 14, { width: 120, lineBreak: false })
    badge(boxX + boxW - 110, y + 12, status.text, status.bg, status.fg)

    const boxRow = (rowY: number, text: string, amount: number, bold = false, color = C_VALUE) => {
      doc.font(FONT).fontSize(8).fillColor(C_LABEL)
        .text(text, boxX + 14, rowY, { width: 130, lineBreak: false })
      doc
        .font(bold ? FONT_BOLD : FONT)
        .fontSize(10.5)
        .fillColor(color)
        .text(formatCOP(amount), boxX + 14, rowY - 1, { width: boxW - 28, align: 'right', lineBreak: false })
    }

    const boxInnerY = y + 34
    boxRow(boxInnerY, 'Total a pagar', data.totalCost, false, C_VALUE)
    boxRow(
      boxInnerY + 22,
      'Pagado',
      data.paidAmount,
      false,
      data.paidAmount > 0 ? GREEN_TEXT : C_VALUE
    )
    doc
      .moveTo(boxX + 14, boxInnerY + 44)
      .lineTo(boxX + boxW - 14, boxInnerY + 44)
      .strokeColor(C_BORDER)
      .lineWidth(0.75)
      .stroke()
    boxRow(
      boxInnerY + 56,
      'Pendiente',
      data.outstanding,
      true,
      data.outstanding > 0 ? RED_TEXT : GREEN_TEXT
    )

    y += boxH + 24

    // ─── Tabla: Transacciones ───────────────────────────────────
    if (data.payments.length > 0) {
      sectionLabel(y, 'Transacciones')
      y += 14

      const txCols = [
        { x: MARGIN, w: 120, align: 'left' as const, labelText: 'Fecha' },
        { x: 180, w: 100, align: 'left' as const, labelText: 'Método' },
        { x: 295, w: 150, align: 'left' as const, labelText: 'Notas' },
        { x: 445, w: 100, align: 'right' as const, labelText: 'Monto' },
      ]

      for (const c of txCols) label(c.x, y, c.labelText, c.w)
      y += 16
      drawHR(y)
      y += 14

      let ty = y
      for (const payment of data.payments) {
        if (ty > BOTTOM_LIMIT) {
          doc.addPage()
          ty = 45
        }

        const fecha = formatDate(payment.createdAt, { day: '2-digit', month: 'short', year: 'numeric' })
        doc.font(FONT).fontSize(9.5).fillColor(C_VALUE)
          .text(fecha || FALLBACK, txCols[0].x, ty, { width: txCols[0].w, lineBreak: false })
          .text(payment.method || '—', txCols[1].x, ty, { width: txCols[1].w, lineBreak: false })
          .text(payment.notes || '—', txCols[2].x, ty, { width: txCols[2].w, lineBreak: false })
        amountValue(txCols[3].x, ty, payment.amount, txCols[3].w)

        ty += 26
      }
      y = ty + 12
    }

    // ─── Footer ────────────────────────────────────────────────
    const footerY = Math.min(Math.max(y + 20, 740), 795)
    drawHR(footerY)

    doc.font(FONT).fontSize(8).fillColor(C_MUTED)
      .text(
        `Recibo generado el ${formatDate(new Date().toISOString(), { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        MARGIN, footerY + 10,
        { align: 'center' }
      )
      .text(`${brandName} — ${brandTagline}`, MARGIN, footerY + 24, { align: 'center' })

    doc.end()

    stream.on('finish', () => resolve(result.filePath))
    stream.on('error', reject)
  })
}