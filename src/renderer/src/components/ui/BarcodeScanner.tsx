// src/renderer/src/components/ui/BarcodeScanner.tsx
// Componente de escaneo de código de barras para entrega rápida.
// Permite buscar participantes por barcode y cambiar su estado.

import React, { useState, useRef, useEffect } from 'react'
import { useParticipantByBarcode } from '../../hooks/useParticipants'
import { useUpdateParticipant } from '../../hooks/useParticipants'
import { useSettingValue } from '../../hooks/useSettings'
import { useToast } from '../../hooks/useToast'
import { useThemeTokens } from '../../lib/theme'
import { formatCOP } from '../../lib/format'

interface BarcodeScannerProps {
  eventId: string
  onClose: () => void
}

export function BarcodeScanner({ eventId, onClose }: BarcodeScannerProps) {
  const t = useThemeTokens()
  const [barcode, setBarcode] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { success, error: toastError, info } = useToast()
  const updateMutation = useUpdateParticipant(eventId)

  // Umbral de entrega configurable (Settings → "Cobros y entregas")
  const threshold = parseInt(useSettingValue('delivery_payment_threshold', '50'), 10)
  const deliveryThresholdPct = Number.isFinite(threshold) ? threshold : 50

  const { data: participant, isLoading, error } = useParticipantByBarcode(barcode || null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    if (participant) {
      info('Participante encontrado', `${participant.name} — ${participant.status.replace(/_/g, ' ')}`)
    }
  }, [participant, info])

  const handleDeliver = () => {
    if (!participant) return

    const total = (participant.unitPrice ?? 0) * participant.quantity
    if (participant.paidAmount < total * (deliveryThresholdPct / 100)) {
      toastError(
        'Pago insuficiente',
        `Debe tener al menos ${deliveryThresholdPct}% pagado para entregar`
      )
      return
    }

    updateMutation.mutate(
      {
        id: participant.id,
        status: 'ENTREGADO',
        deliveredAt: new Date().toISOString(),
      },
      {
        onSuccess: () => {
          success('Entrega registrada', `${participant.name} marcado como ENTREGADO`)
          setBarcode('')
          inputRef.current?.focus()
        },
        onError: (err) => {
          toastError('Error al entregar', err.message)
        },
      }
    )
  }

  return (
    <div className={`rounded-xl border p-6 ${t.border} ${t.cardBg}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className={`text-sm font-medium uppercase tracking-wider ${t.textMuted}`}>
          Escanear Código de Barras
        </h3>
        <button
          onClick={onClose}
          className={`rounded-lg p-1.5 transition-colors ${t.iconBtn}`}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="relative">
        <svg
          className={`absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 ${t.textMuted}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={barcode}
          onChange={(e) => setBarcode(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && participant) handleDeliver()
          }}
          placeholder="Escanear o escribir código..."
          className={`w-full rounded-lg border py-3 pl-10 pr-4 text-sm ${t.input}`}
        />
      </div>

      {isLoading && barcode.length >= 5 && (
        <div className={`mt-3 flex items-center gap-2 text-xs ${t.textMuted}`}>
          <div className="animate-spin h-4 w-4 rounded-full border-b-2 border-emerald-500" />
          Buscando...
        </div>
      )}

      {error && barcode.length >= 5 && !isLoading && (
        <p className={`mt-3 text-xs ${t.dangerText}`}>Participante no encontrado</p>
      )}

      {participant && !isLoading && (
        <div className={`mt-4 rounded-lg border p-4 space-y-3 ${t.border} ${t.surfaceAlt}`}>
          <div>
            <p className={`text-sm font-medium ${t.textPrimary}`}>{participant.name}</p>
            <div className="flex gap-2 mt-1">
              <span className={`text-xs ${t.textMuted}`}>
                {participant.status.replace(/_/g, ' ')}
              </span>
              <span className={`text-xs ${t.accent}`}>
                Pagado: {formatCOP(participant.paidAmount ?? 0)}
              </span>
            </div>
          </div>

          {participant.status !== 'ENTREGADO' ? (
            <button
              onClick={handleDeliver}
              disabled={updateMutation.isPending}
              className="w-full rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
            >
              {updateMutation.isPending ? 'Procesando...' : 'Marcar como Entregado'}
            </button>
          ) : (
            <div className={`rounded-lg px-3 py-2 text-center text-xs ${t.successBanner}`}>
              Ya fue entregado el {participant.deliveredAt ? new Date(participant.deliveredAt).toLocaleDateString('es-ES') : ''}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
