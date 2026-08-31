// src/renderer/src/components/ui/PaymentHistory.tsx
// Historial de pagos individuales de un participante.
// Muestra lista de transacciones, resumen de saldo, y permite agregar/eliminar pagos.

import React, { useState } from 'react'
import { usePaymentHistory, useCreatePayment, useDeletePayment } from '../../hooks/usePayments'
import { useGenerateReceipt } from '../../hooks/usePdf'
import { usePaymentMethods, useSettingValue } from '../../hooks/useSettings'
import { formatCOP } from '../../lib/format'
import { useCurrencyInput } from '../../lib/currencyInput'
import { useToast } from '../../hooks/useToast'
import { ConfirmDialog } from './ConfirmDialog'
import { useThemeTokens } from '../../lib/theme'
import { useUIStore } from '../../stores/ui.store'

interface PaymentHistoryProps {
  participantId: string
  participantName: string
  participantCedula: string | null
  participantPhone: string | null
  participantEmail: string | null
  quantity: number
  unitPrice: number | null
  coverPrice: number
  eventName: string
  eventDate: string
  eventLocation: string | null
}

export function PaymentHistory({
  participantId,
  participantName,
  participantCedula,
  participantPhone,
  participantEmail,
  quantity,
  unitPrice,
  coverPrice,
  eventName,
  eventDate,
  eventLocation,
}: PaymentHistoryProps) {
  const t = useThemeTokens()
  const theme = useUIStore((s) => s.theme)
  const { data, isLoading } = usePaymentHistory(participantId)
  const createPayment = useCreatePayment()
  const deletePayment = useDeletePayment()
  const generateReceipt = useGenerateReceipt()
  const { success, error: toastError } = useToast()

  const paymentMethods = usePaymentMethods()
  const businessName = useSettingValue('business_name', 'FotoApp')
  const businessTagline = useSettingValue('business_tagline', 'Gestión Fotográfica de Eventos')
  const pdfPageSize = useSettingValue('pdf_page_size', 'A4')
  const pdfAccentColor = useSettingValue('pdf_accent_color', '#22c55e')

  const [paymentType, setPaymentType] = useState<'ABONO' | 'PAGO_TOTAL'>('ABONO')
  const { displayValue: amountDisplay, amount, onChange: onAmountChange, reset: resetAmount, set: setAmount } =
    useCurrencyInput()
  const [method, setMethod] = useState('')
  const [notes, setNotes] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-500" />
      </div>
    )
  }

  if (!data) return null

  const { payments, summary } = data

  const handleAddPayment = () => {
    let parsedAmount = amount
    if (paymentType === 'PAGO_TOTAL') {
      parsedAmount = summary.outstanding
    }
    if (isNaN(parsedAmount) || parsedAmount <= 0) return

    createPayment.mutate(
      {
        participantId,
        amount: parsedAmount,
        method: method || null,
        notes: notes || null,
      },
      {
        onSuccess: () => {
          setMethod('')
          setNotes('')
          setPaymentType('ABONO')
          resetAmount()
        },
      }
    )
  }

  const handleDeletePayment = () => {
    if (!deleteTarget) return
    deletePayment.mutate({ id: deleteTarget, participantId })
    setDeleteTarget(null)
  }

  const handleGenerateReceipt = () => {
    generateReceipt.mutate(
      {
        businessName,
        businessTagline,
        pdfPageSize: pdfPageSize as 'A4' | 'Letter' | 'Legal',
        pdfAccentColor,
        eventName,
        eventDate,
        eventLocation,
        participantName,
        participantCedula,
        participantPhone,
        participantEmail,
        quantity,
        unitPrice: unitPrice ?? coverPrice,
        coverPrice,
        totalCost: summary.totalCost,
        paidAmount: summary.paidAmount,
        outstanding: summary.outstanding,
        paymentStatus: summary.paymentStatus,
        payments: payments.map((p: any) => ({
          amount: p.amount,
          method: p.method,
          notes: p.notes,
          createdAt: p.createdAt,
        })),
      },
      {
        onSuccess: () => {
          success('Recibo generado', 'PDF guardado exitosamente')
        },
        onError: (err) => {
          if (err.message !== 'Operación cancelada por el usuario') {
            toastError('Error al generar recibo', err.message)
          }
        },
      }
    )
  }

  const progress = summary.totalCost > 0
    ? Math.min(100, (summary.paidAmount / summary.totalCost) * 100)
    : 0

  return (
    <div className="space-y-4">
      {/* ─── Resumen de saldo ──────────────────────────────── */}
      <div className={`rounded-lg border p-4 ${t.border} ${t.cardBg}`}>
        <div className="flex items-center justify-between mb-3">
          <span className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
            Estado de cuenta
          </span>
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
            summary.paymentStatus === 'PAGO_TOTAL'
              ? t.badgeEmerald
              : summary.paymentStatus === 'PAGO_PARCIAL'
              ? t.badgeAmber
              : t.badgeGray
          }`}>
            {summary.paymentStatus === 'PAGO_TOTAL'
              ? 'PAGADO'
              : summary.paymentStatus === 'PAGO_PARCIAL'
              ? 'PARCIAL'
              : 'SIN PAGO'}
          </span>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className={`text-[10px] uppercase ${t.textMuted}`}>Total</p>
            <p className={`text-sm font-bold ${t.textPrimary}`}>{formatCOP(summary.totalCost)}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase ${t.textMuted}`}>Pagado</p>
            <p className={`text-sm font-bold ${t.okText}`}>{formatCOP(summary.paidAmount)}</p>
          </div>
          <div>
            <p className={`text-[10px] uppercase ${t.textMuted}`}>Pendiente</p>
            <p className={`text-sm font-bold ${summary.outstanding > 0 ? t.dangerText : t.okText}`}>
              {formatCOP(summary.outstanding)}
            </p>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className={`mt-3 h-1.5 rounded-full overflow-hidden ${t.progressTrack}`}>
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress >= 100 ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className={`text-[10px] text-right mt-1 ${t.textFaint}`}>{Math.round(progress)}%</p>
      </div>

      {/* ─── Registrar pago (siempre visible) ──────────────── */}
      {summary.outstanding > 0 && (
        <div className={`rounded-lg border p-4 space-y-3 ${t.border} ${t.cardBg}`}>
          <span className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
            Registrar pago
          </span>

          {/* Tipo de pago: pago total o abono — siempre visibles */}
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'ABONO', label: 'Abono' },
                { value: 'PAGO_TOTAL', label: 'Pago total' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  setPaymentType(opt.value)
                  if (opt.value === 'PAGO_TOTAL') {
                    setAmount(summary.outstanding)
                  }
                }}
                className={`rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                  paymentType === opt.value
                    ? opt.value === 'PAGO_TOTAL'
                      ? `border-emerald-500/70 bg-emerald-500/15 ${t.okText}`
                      : `border-amber-500/70 bg-amber-500/15 ${t.accent}`
                    : theme === 'dark'
                      ? 'border-gray-700 bg-gray-800/40 text-gray-300 hover:bg-gray-800 hover:text-white'
                      : 'border-gray-300 bg-gray-100 text-gray-600 hover:bg-gray-200 hover:text-gray-800'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {paymentType === 'ABONO' && (
            <>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Monto del abono (COP)"
                value={amountDisplay}
                onChange={onAmountChange}
                className={`w-full rounded-lg border px-3 py-2 text-sm ${t.input}`}
                autoFocus
              />
              <p className={`-mt-1 text-[10px] ${t.textMuted}`}>
                Pendiente: {formatCOP(summary.outstanding)}
              </p>
            </>
          )}

          {paymentType === 'PAGO_TOTAL' && (
            <div className={`rounded-lg border px-4 py-3 ${t.border} ${t.surfaceAlt}`}>
              <div className="flex justify-between text-sm">
                <span className={t.textMuted}>Por pagar</span>
                <span className={`font-semibold ${t.okText}`}>
                  {formatCOP(summary.outstanding)}
                </span>
              </div>
            </div>
          )}

          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${t.input}`}
          >
            <option value="">Método de pago...</option>
            {paymentMethods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Notas (opcional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className={`w-full rounded-lg border px-3 py-2 text-sm ${t.input}`}
          />

          <button
            onClick={handleAddPayment}
            disabled={
              createPayment.isPending ||
              (paymentType === 'ABONO' && (!amount || amount <= 0)) ||
              (paymentType === 'PAGO_TOTAL' && summary.outstanding <= 0)
            }
            className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
          >
            {createPayment.isPending ? 'Registrando...' : 'Registrar pago'}
          </button>
        </div>
      )}

      {/* ─── Botón generar recibo ───────────────────────────── */}
      <button
        onClick={handleGenerateReceipt}
        disabled={generateReceipt.isPending}
        className={`w-full rounded-lg border py-2.5 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2 ${t.btnGhost}`}
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
        {generateReceipt.isPending ? 'Generando...' : 'Generar recibo PDF'}
      </button>

      {/* ─── Lista de pagos ────────────────────────────────── */}
      {payments.length > 0 ? (
        <div className="space-y-2">
          <p className="text-[10px] font-medium uppercase tracking-wider text-gray-500">
            Transacciones ({payments.length})
          </p>
          {payments.map((payment: any) => (
            <div
              key={payment.id}
              className={`flex items-center justify-between rounded-lg border px-4 py-3 group ${t.border} ${t.rowHover}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${t.okText}`}>
                    +{formatCOP(payment.amount)}
                  </span>
                  {payment.method && (
                    <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize ${t.badgeGray}`}>
                      {payment.method}
                    </span>
                  )}
                </div>
                {payment.notes && (
                  <p className={`text-xs mt-0.5 truncate ${t.textMuted}`}>{payment.notes}</p>
                )}
                <p className={`text-[10px] mt-0.5 ${t.textFaint}`}>
                  {new Date(payment.createdAt).toLocaleDateString('es-CO', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                onClick={() => setDeleteTarget(payment.id)}
                className={`ml-2 rounded p-1 opacity-0 group-hover:opacity-100 transition-all ${t.textFaint} ${
                  theme === 'dark'
                    ? 'hover:bg-red-500/10 hover:text-red-400'
                    : 'hover:bg-red-100 hover:text-red-600'
                }`}
                title="Eliminar pago"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-6">
          <p className="text-sm text-gray-500">Sin pagos registrados</p>
        </div>
      )}

      {/* ─── Confirmación de eliminación ───────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar pago"
        message="¿Eliminar este pago? El saldo se recalculará automáticamente."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDeletePayment}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
