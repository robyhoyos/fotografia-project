// src/renderer/src/components/tables/ParticipantTable.tsx
// Tabla de participantes con soporte para selección múltiple (HU-D6).

import React, { useMemo } from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useThemeTokens } from '../../lib/theme'
import { formatCOP } from '../../lib/format'
import type { ParticipantSummary } from '../../../../../shared/types/ipc'

interface ParticipantTableProps {
  participants: ParticipantSummary[]
  isLoading: boolean
  eventId: string
  onEdit: (participant: ParticipantSummary) => void
  onDelete: (participantId: string) => void
  onBulkStatusChange: (ids: string[], status: string, onSuccess?: () => void) => void
  onBulkDelete: (ids: string[], onSuccess?: () => void) => void
  readOnly?: boolean
}

export function ParticipantTable({
  participants,
  isLoading,
  eventId,
  onEdit,
  onDelete,
  onBulkStatusChange,
  onBulkDelete,
  readOnly = false,
}: ParticipantTableProps) {
  const {
    theme,
    selectedParticipantIds,
    toggleParticipantSelection,
    selectAllParticipants,
    clearSelection,
    openDrawer,
  } = useUIStore()

  const t = useThemeTokens()

  const allIds = useMemo(
    () => participants.map((p) => p.id),
    [participants]
  )

  const isAllSelected =
    allIds.length > 0 &&
    allIds.every((id) => selectedParticipantIds.includes(id))

  const isPartialSelection =
    selectedParticipantIds.length > 0 && !isAllSelected

  const handleSelectAll = () => {
    if (isAllSelected) {
      clearSelection()
    } else {
      selectAllParticipants(allIds)
    }
  }

  const handleBulkDelivered = () => {
    onBulkStatusChange(selectedParticipantIds, 'ENTREGADO', clearSelection)
  }

  const handleBulkPending = () => {
    onBulkStatusChange(selectedParticipantIds, 'PENDIENTE', clearSelection)
  }

  const handleBulkDelete = () => {
    onBulkDelete(selectedParticipantIds, clearSelection)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDIENTE':
        return t.badgeAmber
      case 'EN_PROCESO':
        return t.badgeBlue
      case 'ENTREGADO':
        return t.badgeEmerald
      case 'CANCELADO':
        return t.badgeRed
      default:
        return t.badgeGray
    }
  }

  const getPaymentBadge = (paymentStatus: string, paidAmount: number) => {
    switch (paymentStatus) {
      case 'PAGO_TOTAL':
        return t.badgeEmerald
      case 'PAGO_PARCIAL':
        return t.badgeOrange
      case 'SIN_PAGO':
        return paidAmount > 0
          ? t.badgeAmber
          : t.badgeGray
      default:
        return t.badgeGray
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    )
  }

  return (
    <div className="relative">
      <div className={`overflow-hidden rounded-xl border ${t.border} ${t.tableBg}`}>
        <table className="w-full">
          <thead>
            <tr className={`border-b ${t.border} ${t.tableHeadBg}`}>
              {!readOnly && (
                <th className="w-12 px-4 py-4">
                  <input
                    type="checkbox"
                    checked={isAllSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = isPartialSelection
                    }}
                    onChange={handleSelectAll}
                    className={`h-4 w-4 rounded ${t.checkbox}`}
                  />
                </th>
              )}
              <th className={`px-4 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                Nombre
              </th>
              <th className={`px-4 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                Teléfono
              </th>
              <th className={`px-4 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                Cédula
              </th>
              <th className={`px-4 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                Cantidad
              </th>
              <th className={`px-4 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                Estado
              </th>
              <th className={`px-4 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                Pago
              </th>
              <th className={`px-4 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                Pagado
              </th>
              {!readOnly && (
                <th className={`px-4 py-4 text-right text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
                  Acciones
                </th>
              )}
            </tr>
          </thead>

          <tbody className={`divide-y ${t.divider}`}>
            {participants.map((participant) => {
              const isSelected = selectedParticipantIds.includes(participant.id)

              return (
                <tr
                  key={participant.id}
                  className={`group cursor-pointer transition-colors ${
                    isSelected
                      ? theme === 'dark'
                        ? 'bg-emerald-500/5 border-l-2 border-l-emerald-500'
                        : 'bg-emerald-50 border-l-2 border-l-emerald-500'
                      : `${t.rowHover} border-l-2 border-l-transparent`
                  }`}
                  onClick={() =>
                    openDrawer('participant-detail', participant)
                  }
                >
                  {!readOnly && (
                    <td className="w-12 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() =>
                          toggleParticipantSelection(participant.id)
                        }
                        onClick={(e) => e.stopPropagation()}
                        className={`h-4 w-4 rounded ${t.checkbox}`}
                      />
                    </td>
                  )}

                  <td className="px-4 py-3">
                    <div>
                      <p className={`text-sm font-medium ${t.textPrimary}`}>
                        {participant.name}
                      </p>
                      {participant.email && (
                        <p className={`text-xs ${t.textMuted}`}>
                          {participant.email}
                        </p>
                      )}
                    </div>
                  </td>

                  <td className={`px-4 py-3 text-sm ${t.textSecondary}`}>
                    {participant.phone || '—'}
                  </td>

                  <td className={`px-4 py-3 text-sm ${t.textSecondary}`}>
                    {participant.cedula || '—'}
                  </td>

                  <td className={`px-4 py-3 text-sm ${t.textSecondary}`}>
                    {participant.quantity}
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusBadge(participant.status)}`}
                    >
                      {participant.status.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentBadge(participant.paymentStatus, participant.paidAmount)}`}
                    >
                      {participant.paymentStatus.replace(/_/g, ' ')}
                    </span>
                  </td>

                  <td className={`px-4 py-3 text-sm font-medium ${t.accent}`}>
                    {formatCOP(participant.paidAmount)}
                  </td>

                  {!readOnly && (
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(participant)
                          }}
                          className={`rounded-lg p-1.5 transition-colors ${t.iconBtn}`}
                          title="Editar"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDelete(participant.id)
                          }}
                          className={`rounded-lg p-1.5 transition-colors ${t.iconBtn} ${t.iconBtnDanger}`}
                          title="Eliminar"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              )
            })}
          </tbody>
        </table>

        {participants.length === 0 && (
          <div className={`flex flex-col items-center justify-center py-16 ${t.textMuted}`}>
            <svg className={`h-12 w-12 mb-4 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
            <p className="text-sm font-medium">No hay participantes</p>
            <p className={`text-xs mt-1 ${t.textFaint}`}>
              {readOnly
                ? 'Este evento no tiene participantes registrados'
                : 'Registra participantes o importa desde un archivo CSV'}
            </p>
            {!readOnly && (
              <button
                onClick={() => openDrawer('participant-create', { eventId })}
                className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
              >
                + Nuevo Participante
              </button>
            )}
          </div>
        )}
      </div>

      {!readOnly && selectedParticipantIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className={`flex items-center gap-3 rounded-xl border px-6 py-3 shadow-2xl backdrop-blur-sm ${t.floatingBar}`}>
            <span className={`text-sm font-medium ${t.textSecondary}`}>
              <span className={`${t.accent} font-bold`}>
                {selectedParticipantIds.length}
              </span>{' '}
              seleccionados
            </span>

            <div className={`h-6 w-px ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`} />

            <button
              onClick={handleBulkDelivered}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              Marcar Entregado
            </button>

            <button
              onClick={handleBulkPending}
              className="flex items-center gap-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Marcar Pendiente
            </button>

            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-500 transition-colors"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Eliminar
            </button>

            <div className={`h-6 w-px ${theme === 'dark' ? 'bg-gray-700' : 'bg-gray-300'}`} />

            <button
              onClick={clearSelection}
              className={`rounded-lg p-1.5 transition-colors ${t.iconBtn}`}
              title="Cancelar selección"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
