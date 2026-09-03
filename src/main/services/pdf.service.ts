// src/main/services/pdf.service.ts
// Service para generar PDFs de recibos de pago.
//
// Dirección de diseño (frontend-design):
// - Masthead editorial: wordmark con tracking amplio, número de recibo y sumario de emisión
// - Tinta casi negra (#0f172a) + acento configurable; grises tipo pizarra para etiquetas
// - Tarjeta de información Cliente/Evento sobre fondo #f8fafc con regla de acento superior
// - Marcadores de sección con cuadrado de acento (jerarquía estructural real)
// - Caja RESUMEN DE PAGO con barra lateral de acento y jerarquía de montos
// - Respiración espacial generosa; tablas con divisorias sutiles y montos tabulares a la derecha
// - Fallbacks: datos faltantes o fechas inválidas → "No especificado" en cursiva gris

import PDFDocument from 'pdfkit'
import fs from 'fs'
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
const FONT = 'Helvetica'
const FONT_BOLD = 'Helvetica-Bold'
const FONT_OBLIQUE = 'Helvetica-Oblique'

const C_INK = '#0f172a' // tinta principal (títulos / encabezados)
const C_VALUE = '#111827' // valores de datos
const C_LABEL = '#64748b' // etiquetas (pizarra)
const C_MUTED = '#94a3b8' // secundario / "No especificado"
const C_BORDER = '#e2e8f0' // divisorias sutiles
const C_CARD = '#f8fafc' // fondo de superficie
const GREEN_TEXT = '#16a34a'
const RED_TEXT = '#dc2626'
const FALLBACK = 'No especificado'

// Badges de estado — fondos suaves con texto oscuro
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
 * @description Formatea una fecha ISO. Devuelve '' si la fecha es inválida.
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

    const drawHR = (y: number, color = C_BORDER, width = 0.75) => {
      doc.moveTo(MARGIN, y).lineTo(RIGHT, y).strokeColor(color).lineWidth(width).stroke()
    }

    // Etiqueta: minúsculas mayúsculas, pizarra, tracking amplio
    const label = (x: number, y: number, text: string, width: number) => {
      doc.font(FONT_BOLD).fontSize(8).fillColor(C_LABEL)
        .text(text.toUpperCase(), x, y, { width, characterSpacing: 0.9, lineBreak: false })
    }

    // Valor de dato. Si falta → "No especificado" en cursiva gris.
    const value = (x: number, y: number, text: string | null | undefined, width: number) => {
      const missing = !has(text)
      doc
        .font(missing ? FONT_OBLIQUE : FONT_BOLD)
        .fontSize(missing ? 9.5 : 10.5)
        .fillColor(missing ? C_MUTED : C_VALUE)
        .text(missing ? FALLBACK : (text as string), x, y, { width, lineBreak: false })
    }

    // Monto monetario tabular alineado a la derecha
    const amountValue = (x: number, y: number, amount: number, width: number) => {
      doc.font(FONT_BOLD).fontSize(10.5).fillColor(C_VALUE)
        .text(formatCOP(amount), x, y, { width, align: 'right', lineBreak: false })
    }

    // Marcador de sección: cuadrado de acento + etiqueta
    const sectionMarker = (y: number, text: string) => {
      doc.rect(MARGIN, y, 5, 5).fillColor(accent).fill()
      label(MARGIN + 11, y - 2.5, text, CONTENT_W - 11)
    }

    // Badge de estado: píldora con fondo suave y texto oscuro
    const badge = (x: number, y: number, text: string, bg: string, fg: string) => {
      const w = doc.font(FONT_BOLD).fontSize(7).widthOfString(text.toUpperCase()) + 22
      const h = 16
      doc.roundedRect(x, y, w, h, 8).fillColor(bg).fill()
      doc
        .roundedRect(x, y, w, h, 8)
        .strokeColor(C_BORDER)
        .lineWidth(0.75)
        .stroke()
      doc.fillColor(fg).text(text.toUpperCase(), x + 11, y + 4.5, { width: w, characterSpacing: 0.6, lineBreak: false })
      return w
    }

    // ─── Emisión: número de recibo derivado de la fecha/hora ────
    const now = new Date()
    const pad = (n: number) => String(n).padStart(2, '0')
    const invoiceNo = `REC-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`

    // ─── Masthead ────────────────────────────────────────────────
    let y = 42

    // Marca (izquierda): acento en el rombo, wordmark con tracking
    doc.circle(MARGIN + 4, y + 9, 2.6).fillColor(accent).fill()
    doc.font(FONT_BOLD).fontSize(21).fillColor(C_INK)
      .text(brandName.toUpperCase(), MARGIN + 13, y, { width: 240, characterSpacing: 1.4, lineBreak: false })
    doc.font(FONT).fontSize(8).fillColor(C_LABEL)
      .text(brandTagline.toUpperCase(), MARGIN + 13, y + 24, { width: 260, characterSpacing: 1.6, lineBreak: false })

    // Título del recibo (derecha) con tab de acento
    doc.rect(RIGHT - 30, y - 4, 30, 3).fillColor(accent).fill()
    doc.font(FONT_BOLD).fontSize(15).fillColor(C_INK)
      .text('RECIBO DE PAGO', 320, y + 6, { width: 225, align: 'right', characterSpacing: 1, lineBreak: false })
    doc.font(FONT).fontSize(8.5).fillColor(C_MUTED)
      .text(`Emitido: ${formatDate(now.toISOString(), { day: '2-digit', month: 'long', year: 'numeric' })}`, 320, y + 26, { width: 225, align: 'right', lineBreak: false })
    doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_LABEL)
      .text(invoiceNo, 320, y + 38, { width: 225, align: 'right', characterSpacing: 0.6, lineBreak: false })

    y += 58
    drawHR(y)
    y += 18

    // ─── Tarjeta Cliente | Evento ───────────────────────────────
    const cardY = y
    const cardH = 150
    const innerLeft = MARGIN + 18
    const innerTop = cardY + 18
    const colL = innerLeft
    const colR = 350
    const colW = 175

    // Superficie con regla de acento superior
    doc.roundedRect(MARGIN, cardY, CONTENT_W, cardH, 12).fillColor(C_CARD).fill()
    doc.rect(MARGIN + 12, cardY + 1, CONTENT_W - 24, 2).fillColor(accent).fill()

    doc.font(FONT_BOLD).fontSize(7.5).fillColor(C_LABEL)
      .text('CLIENTE', colL, innerTop, { width: colW, characterSpacing: 1.2, lineBreak: false })
      .text('EVENTO', colR, innerTop, { width: colW, characterSpacing: 1.2, lineBreak: false })

    // Divisor vertical sutil dentro de la tarjeta
    doc.moveTo(332, innerTop - 2).lineTo(332, cardY + cardH - 12)
      .strokeColor(C_BORDER).lineWidth(0.75).stroke()

    const cell = (rowIndex: number, lLabel: string, lValue: string | null | undefined, rLabel: string, rValue: string | null | undefined) => {
      const ry = innerTop + 10 + rowIndex * 30
      label(colL, ry, lLabel, colW)
      value(colL, ry + 10, lValue, colW)
      label(colR, ry, rLabel, colW)
      value(colR, ry + 10, rValue, colW)
    }

    cell(0, 'Nombre', data.participantName, 'Evento', data.eventName)
    cell(1, 'Teléfono', data.participantPhone, 'Fecha', formatDate(data.eventDate, { day: '2-digit', month: 'long', year: 'numeric' }))
    cell(2, 'Email', data.participantEmail, 'Lugar', data.eventLocation)
    cell(3, 'Cédula', data.participantCedula, '—', null)

    y = cardY + cardH + 24

    // ─── Tabla: Detalle de la compra ─────────────────────────────
    sectionMarker(y, 'Detalle de la compra')
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
    drawHR(y, accent, 1)
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

    const boxH = 110
    doc.roundedRect(boxX, y, boxW, boxH, 12).fillColor(C_CARD).fill()
    doc.roundedRect(boxX, y, boxW, boxH, 12).strokeColor(C_BORDER).lineWidth(1).stroke()
    // Barra lateral de acento
    doc.rect(boxX + 1, y + 8, 3, boxH - 16).fillColor(accent).fill()

    doc.font(FONT_BOLD).fontSize(8).fillColor(C_LABEL)
      .text('Resumen de pago'.toUpperCase(), boxX + 16, y + 14, { width: 140, characterSpacing: 1, lineBreak: false })
    badge(boxX + boxW - 110, y + 12, status.text, status.bg, status.fg)

    const boxRow = (rowY: number, text: string, amount: number, bold = false, color = C_VALUE) => {
      doc.font(FONT).fontSize(8).fillColor(C_LABEL)
        .text(text, boxX + 16, rowY, { width: 130, lineBreak: false })
      doc
        .font(bold ? FONT_BOLD : FONT)
        .fontSize(10.5)
        .fillColor(color)
        .text(formatCOP(amount), boxX + 16, rowY - 1, { width: boxW - 32, align: 'right', lineBreak: false })
    }

    const boxInnerY = y + 36
    boxRow(boxInnerY, 'Total a pagar', data.totalCost, false, C_VALUE)
    boxRow(
      boxInnerY + 22,
      'Pagado',
      data.paidAmount,
      false,
      data.paidAmount > 0 ? GREEN_TEXT : C_VALUE
    )
    doc
      .moveTo(boxX + 16, boxInnerY + 44)
      .lineTo(boxX + boxW - 16, boxInnerY + 44)
      .strokeColor(C_BORDER)
      .lineWidth(0.75)
      .stroke()
    boxRow(
      boxInnerY + 58,
      'Pendiente',
      data.outstanding,
      true,
      data.outstanding > 0 ? RED_TEXT : GREEN_TEXT
    )

    y += boxH + 24

    // ─── Tabla: Transacciones ───────────────────────────────────
    if (data.payments.length > 0) {
      sectionMarker(y, 'Transacciones')
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
        `Recibo generado el ${formatDate(now.toISOString(), { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`,
        MARGIN, footerY + 10,
        { align: 'center' }
      )
    doc.font(FONT_BOLD).fontSize(8.5).fillColor(C_LABEL)
      .text(`${brandName.toUpperCase()} — ${brandTagline.toUpperCase()}`, MARGIN, footerY + 24, { align: 'center', characterSpacing: 0.8 })

    doc.end()

    stream.on('finish', () => resolve(result.filePath))
    stream.on('error', reject)
  })
}