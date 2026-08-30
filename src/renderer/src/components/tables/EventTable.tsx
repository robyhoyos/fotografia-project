// src/renderer/src/components/tables/EventTable.tsx
// Tabla de eventos con diseño "Portfolio Fotográfico".

import React from 'react'
import { useThemeTokens } from '../../lib/theme'
import { formatCOP } from '../../lib/format'
import type { EventWithParticipants } from '../../../../../shared/types/ipc'

interface EventTableProps {
  events: EventWithParticipants[]
  isLoading: boolean
  onEdit: (event: EventWithParticipants) => void
  onDelete: (eventId: string) => void
  onSelectEvent: (eventId: string) => void
}

export function EventTable({
  events,
  isLoading,
  onEdit,
  onDelete,
  onSelectEvent,
}: EventTableProps) {
  const t = useThemeTokens()

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case 'SACRAMENTAL':
        return t.badgeAmber
      case 'ESCOLAR':
        return t.badgeBlue
      case 'ESTUDIO':
        return t.badgePurple
      default:
        return t.badgeGray
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVO':
        return 'bg-emerald-500'
      case 'FINALIZADO':
        return 'bg-gray-500'
      case 'CANCELADO':
        return 'bg-red-500'
      default:
        return 'bg-gray-500'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    )
  }

  return (
    <div className={`overflow-hidden rounded-xl border ${t.border} ${t.tableBg}`}>
      <table className="w-full">
        <thead>
          <tr className={`border-b ${t.border} ${t.tableHeadBg}`}>
            <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Evento
            </th>
            <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Categoría
            </th>
            <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Subtipo
            </th>
            <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Fecha
            </th>
            <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Participantes
            </th>
            <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Precio
            </th>
            <th className={`px-6 py-4 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Estado
            </th>
            <th className={`px-6 py-4 text-right text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>
              Acciones
            </th>
          </tr>
        </thead>

        <tbody className={`divide-y ${t.divider}`}>
          {events.map((event) => (
            <tr
              key={event.id}
              className={`group cursor-pointer transition-colors ${t.rowHover}`}
              onClick={() => onSelectEvent(event.id)}
            >
              <td className="px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className={`h-2 w-2 rounded-full ${getStatusColor(event.status)}`} />
                  <div>
                    <p className={`text-sm font-medium ${t.textPrimary}`}>{event.name}</p>
                    {event.location && (
                      <p className={`text-xs ${t.textMuted}`}>{event.location}</p>
                    )}
                  </div>
                </div>
              </td>

              <td className="px-6 py-4">
                <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getCategoryBadgeColor(event.category)}`}>
                  {event.category}
                </span>
              </td>

              <td className={`px-6 py-4 text-sm ${t.textSecondary}`}>
                {event.subtype.replace(/_/g, ' ')}
              </td>

              <td className={`px-6 py-4 text-sm ${t.textSecondary}`}>
                {new Date(event.date).toLocaleDateString('es-ES', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                })}
              </td>

              <td className={`px-6 py-4 text-sm ${t.textSecondary}`}>
                <span className={`font-medium ${t.textPrimary}`}>
                  {event._count?.participants ?? 0}
                </span>
              </td>

              <td className={`px-6 py-4 text-sm font-medium ${t.accent}`}>
                {formatCOP(event.coverPrice)}
              </td>

              <td className="px-6 py-4">
                <span className={`text-xs font-medium ${
                  event.status === 'ACTIVO'
                    ? t.okText
                    : event.status === 'CANCELADO'
                    ? t.dangerText
                    : t.textMuted
                }`}>
                  {event.status}
                </span>
              </td>

              <td className="px-6 py-4 text-right">
                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(event)
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
                      onDelete(event.id)
                    }}
                    className={`rounded-lg p-1.5 transition-colors text-gray-400 ${t.iconBtnDanger}`}
                    title="Eliminar"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {events.length === 0 && (
        <div className={`flex flex-col items-center justify-center py-16 ${t.textMuted}`}>
          <svg className={`h-12 w-12 mb-4 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-sm font-medium">No hay eventos registrados</p>
          <p className={`text-xs mt-1 ${t.textFaint}`}>Crea tu primer evento para comenzar</p>
        </div>
      )}
    </div>
  )
}
