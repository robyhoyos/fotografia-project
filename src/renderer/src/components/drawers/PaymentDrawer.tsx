// src/renderer/src/components/drawers/PaymentDrawer.tsx
// Drawer para registrar pagos de participantes.
// Permite registrar un pago parcial o total.

import React, { useState, useEffect } from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useThemeTokens } from '../../lib/theme'
import { useUpdateParticipant } from '../../hooks/useParticipants'
import { useToast } from '../../hooks/useToast'
import { formatCOP } from '../../lib/format'
import { useCurrencyInput } from '../../lib/currencyInput'
import type { ParticipantSummary } from '../../../../../shared/types/ipc'

export function PaymentDrawer({ eventId }: { eventId: string }) {
  const { activeDrawer, closeDrawer } = useUIStore()
  const t = useThemeTokens()
  const isOpen = activeDrawer.type === 'payment'
  const participant = activeDrawer.data as ParticipantSummary | undefined

  const { success, error: toastError } = useToast()
  const updateMutation = useUpdateParticipant(eventId)

  const { displayValue: amountDisplay, amount, onChange: onAmountChange, set: setAmount } =
    useCurrencyInput()
  const [quickAmounts, setQuickAmounts] = useState<number[]>([])

  const getTotalDue = (p: ParticipantSummary | undefined): number => {
    if (!p) return 0
    if (typeof p.totalAmount === 'number' && p.totalAmount > 0) return p.totalAmount
    if (p.items && p.items.length > 0) {
      const sum = p.items.reduce((acc, it) => acc + (it.subtotal || 0), 0)
      if (sum > 0) return sum
    }
    return (p.unitPrice ?? 0) * (p.quantity ?? 1)
  }

  const totalDue = getTotalDue(participant)
  const remaining = totalDue - (participant?.paidAmount ?? 0)

  useEffect(() => {
    if (participant && isOpen) {
      const due = getTotalDue(participant)
      const rem = due - participant.paidAmount
      setAmount(0)
      setQuickAmounts([
        rem,
        due * 0.5,
        due,
        Math.round(rem / 2),
      ].filter((v) => v > 0 && v !== rem).slice(0, 3))
    }
  }, [participant, isOpen])

  const handlePay = () => {
    if (!participant) return
    const payAmount = amount
    if (isNaN(payAmount) || payAmount <= 0) {
      toastError('Monto inválido', 'Ingresa un monto mayor a 0')
      return
    }

    const newPaidAmount = participant.paidAmount + payAmount
    const totalDue = getTotalDue(participant)
    const newPaymentStatus =
      newPaidAmount >= totalDue
        ? 'PAGO_TOTAL'
        : newPaidAmount > 0
        ? 'PAGO_PARCIAL'
        : 'SIN_PAGO'

    updateMutation.mutate(
      {
        id: participant.id,
        paidAmount: newPaidAmount,
        paymentStatus: newPaymentStatus as any,
      },
      {
        onSuccess: () => {
          success(
            'Pago registrado',
            `${formatCOP(payAmount)} registrados para ${participant.name}`
          )
          closeDrawer()
        },
        onError: (err) => {
          toastError('Error al registrar pago', err.message)
        },
      }
    )
  }

  if (!isOpen || !participant) return null

  return (
    <>
      <div className={`fixed inset-0 z-40 backdrop-blur-sm ${t.overlay}`} onClick={closeDrawer} />

      <div className={`fixed inset-y-0 right-0 z-50 w-[400px] border-l shadow-2xl ${t.drawerHeader} ${t.drawerBg}`}>
        <div className="flex h-full flex-col">
          <div className={`flex items-center justify-between border-b px-6 py-4 ${t.border}`}>
            <div>
              <h2 className={`text-lg font-semibold ${t.textPrimary}`}>Registrar Pago</h2>
              <p className={`text-xs mt-0.5 ${t.textMuted}`}>{participant.name}</p>
            </div>
            <button
              onClick={closeDrawer}
              className={`rounded-lg p-2 transition-colors ${t.iconBtn}`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-5">
              <div className={`rounded-lg border p-4 space-y-2 ${t.border} ${t.surfaceAlt}`}>
                <div className="flex justify-between text-sm">
                  <span className={t.textMuted}>Total a pagar</span>
                  <span className={`font-medium ${t.textPrimary}`}>{formatCOP(totalDue)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className={t.textMuted}>Ya pagado</span>
                  <span className={`font-medium ${t.okText}`}>
                    {formatCOP(participant.paidAmount)}
                  </span>
                </div>
                <div className={`flex justify-between text-sm border-t pt-2 ${t.divider}`}>
                  <span className={t.textMuted}>Pendiente</span>
                  <span className={`font-bold ${t.accent}`}>{formatCOP(remaining)}</span>
                </div>
              </div>

              <div>
                <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                  Monto a pagar (COP)
                </label>
                <input
                  type="text"
                  inputMode="numeric"
                  max={remaining}
                  value={amountDisplay}
                  onChange={onAmountChange}
                  placeholder="0"
                  className={`mt-1 w-full rounded-lg border px-3 py-3 text-lg font-medium ${t.input}`}
                />
              </div>

              {quickAmounts.length > 0 && (
                <div className="flex gap-2">
                  {quickAmounts.map((q) => (
                    <button
                      key={q}
                      onClick={() => setAmount(q)}
                      className={`flex-1 rounded-lg border px-2 py-1.5 text-xs font-medium transition-colors ${t.btnGhost}`}
                    >
                      {formatCOP(q)}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className={`border-t px-6 py-4 ${t.border}`}>
            <div className="flex gap-3">
              <button
                onClick={closeDrawer}
                className={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${t.btnGhost}`}
              >
                Cancelar
              </button>
              <button
                onClick={handlePay}
                disabled={!amount || amount <= 0 || updateMutation.isPending}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50 shadow-lg shadow-emerald-600/20"
              >
                {updateMutation.isPending ? 'Registrando...' : 'Registrar Pago'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
