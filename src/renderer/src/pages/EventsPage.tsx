// src/renderer/src/pages/EventsPage.tsx
// Página principal de gestión de eventos y participantes.
// Orquesta la tabla de eventos, estadísticas y el drawer de detalle.

import React, { useState, useEffect } from 'react'
import { useUIStore } from '../stores/ui.store'
import { useThemeTokens } from '../lib/theme'
import { useEvents, useDeleteEvent, useEventStats, useUpdateEvent } from '../hooks/useEvents'
import {
  useParticipants,
  useDeleteParticipant,
  useBulkUpdateStatus,
  useBulkDelete,
} from '../hooks/useParticipants'
import { useExportXlsx } from '../hooks/useExport'
import { PrintView } from '../components/ui/PrintView'
import { EventTable } from '../components/tables/EventTable'
import { ParticipantTable } from '../components/tables/ParticipantTable'
import { ParticipantDrawer } from '../components/drawers/ParticipantDrawer'
import { PaymentDrawer } from '../components/drawers/PaymentDrawer'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import { useToast } from '../hooks/useToast'
import { useRole } from '../hooks/useRole'
import { formatCOP } from '../lib/format'
import type { StoredEvent } from '../../../../shared/types/ipc'
import type { ParticipantSummary, ParticipantItem, EventWithParticipants } from '../../../../shared/types/ipc'
import type { BulkUpdateStatusInput } from '../../../../shared/schemas/participant.schema'

export function EventsPage() {
  const {
    theme,
    toggleTheme,
    openDrawer,
    setScannerEventId,
    consumeRequestedEvent,
    selectedEventId,
    setSelectedEventId,
  } = useUIStore()
  const t = useThemeTokens()
  const { success, error: toastError } = useToast()
  const { readOnly } = useRole()

  const [eventSearch, setEventSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [participantSearch, setParticipantSearch] = useState('')
  const [participantPage, setParticipantPage] = useState(1)

  // Si el dashboard solicitó abrir un evento, lo selecciona al montar.
  useEffect(() => {
    const requested = useUIStore.getState().requestedEventId
    if (requested) {
      setSelectedEventId(requested)
      setParticipantPage(1)
      setParticipantSearch('')
      consumeRequestedEvent()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean
    title: string
    message: string
    variant: 'danger' | 'warning' | 'info'
    confirmLabel?: string
    onConfirm: () => void
  }>({
    isOpen: false,
    title: '',
    message: '',
    variant: 'danger',
    onConfirm: () => {},
  })

  const { data: eventsData, isLoading: eventsLoading } = useEvents({
    page: 1,
    pageSize: 50,
    sortBy: 'date',
    sortOrder: 'desc',
    search: eventSearch || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
  })

  const { data: participantsData, isLoading: participantsLoading } =
    useParticipants({
      eventId: selectedEventId || '',
      page: participantPage,
      pageSize: 50,
      sortBy: 'name',
      sortOrder: 'asc',
      search: participantSearch || undefined,
    })

  const { data: eventStats } = useEventStats(selectedEventId)

  const deleteEventMutation = useDeleteEvent()
  const updateEventMutation = useUpdateEvent()
  const deleteParticipantMutation = useDeleteParticipant(selectedEventId || '')
  const bulkStatusMutation = useBulkUpdateStatus(selectedEventId || '')
  const bulkDeleteMutation = useBulkDelete(selectedEventId || '')
  const exportXlsxMutation = useExportXlsx()

  const handleSelectEvent = (eventId: string) => {
    setSelectedEventId(eventId)
    setParticipantPage(1)
    setParticipantSearch('')
  }

  const handleBackToEvents = () => {
    setSelectedEventId(null)
    setParticipantSearch('')
  }

  const handleEditEvent = (event: StoredEvent) => {
    openDrawer('event-edit', event as EventWithParticipants)
  }

  const handleDeleteEvent = (eventId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Evento',
      message:
        '¿Eliminar este evento y todos sus participantes? Esta acción no se puede deshacer.',
      variant: 'danger',
      confirmLabel: 'Eliminar',
      onConfirm: () => {
        deleteEventMutation.mutate(eventId, {
          onSuccess: () => {
            success('Evento eliminado')
            handleBackToEvents()
          },
          onError: (err) => {
            toastError('Error al eliminar', err.message)
          },
        })
        setConfirmState((s) => ({ ...s, isOpen: false }))
      },
    })
  }

  const handleEditParticipant = (participant: ParticipantSummary) => {
    openDrawer('participant-edit', participant)
  }

  const handleDeleteParticipant = (participantId: string) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Participante',
      message: '¿Eliminar este participante? Esta acción no se puede deshacer.',
      variant: 'danger',
      confirmLabel: 'Eliminar',
      onConfirm: () => {
        deleteParticipantMutation.mutate(participantId, {
          onSuccess: () => success('Participante eliminado'),
          onError: (err) => toastError('Error al eliminar', err.message),
        })
        setConfirmState((s) => ({ ...s, isOpen: false }))
      },
    })
  }

  const handleBulkStatusChange = (ids: string[], status: string, onSuccess?: () => void) => {
    bulkStatusMutation.mutate(
      { participantIds: ids, status: status as BulkUpdateStatusInput['status'] },
      {
        onSuccess: () => {
          success('Estado actualizado', `${ids.length} participantes actualizados`)
          onSuccess?.()
        },
        onError: (err) => toastError('Error en actualización masiva', err.message),
      }
    )
  }

  const handleBulkDelete = (ids: string[], onSuccess?: () => void) => {
    setConfirmState({
      isOpen: true,
      title: 'Eliminar Participantes',
      message: `¿Eliminar ${ids.length} participantes? Esta acción no se puede deshacer.`,
      variant: 'danger',
      confirmLabel: 'Eliminar',
      onConfirm: () => {
        bulkDeleteMutation.mutate(
          { participantIds: ids },
          {
            onSuccess: () => {
              success('Participantes eliminados', `${ids.length} registros eliminados`)
              onSuccess?.()
            },
            onError: (err) => toastError('Error en eliminación masiva', err.message),
          }
        )
        setConfirmState((s) => ({ ...s, isOpen: false }))
      },
    })
  }

  const handleScanEvent = () => {
    if (selectedEventId) {
      setScannerEventId(selectedEventId)
    }
  }

  const handleStatusChange = (newStatus: string) => {
    if (!selectedEventId) return
    const label = newStatus === 'ACTIVO' ? 'activo' : newStatus === 'FINALIZADO' ? 'finalizado' : 'cancelado'
    setConfirmState({
      isOpen: true,
      title: `Cambiar a ${label}`,
      message: `¿Cambiar el estado del evento a "${label}"?`,
      variant: newStatus === 'CANCELADO' ? 'danger' : 'warning',
      confirmLabel: 'Cambiar',
      onConfirm: () => {
        updateEventMutation.mutate(
          { id: selectedEventId, status: newStatus as 'ACTIVO' | 'FINALIZADO' | 'CANCELADO' },
          {
            onSuccess: () => success('Estado actualizado', `Evento marcado como ${label}`),
            onError: (err) => toastError('Error al cambiar estado', err.message),
          }
        )
        setConfirmState((s) => ({ ...s, isOpen: false }))
      },
    })
  }

  const bgClass = t.pageBg
  const textClass = t.textPrimary
  const mutedText = t.textMuted

  const selectedEvent = eventsData?.items?.find(
    (e: StoredEvent) => e.id === selectedEventId
  )

  return (
    <div className={`min-h-screen ${bgClass} ${textClass}`}>
      <header className={`border-b px-8 py-6 ${t.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {selectedEvent ? (
                <span className="flex items-center gap-3">
                  <button
                    onClick={handleBackToEvents}
                    className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${t.btnGhost}`}
                    title="Volver a Gestión de Eventos"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7m8 14l-7-7 7-7" />
                    </svg>
                    Atrás
                  </button>
                  {selectedEvent.name}
                </span>
              ) : (
                'Gestión de Eventos'
              )}
            </h1>
            <p className={`mt-1 text-sm ${mutedText}`}>
              {selectedEvent
                ? `${selectedEvent._count?.participants ?? 0} participantes • ${selectedEvent.category}`
                : 'Eventos fotográficos y participantes'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={toggleTheme}
              className={`rounded-lg p-2 transition-colors ${t.iconBtn}`}
              title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
            >
              {theme === 'dark' ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
                </svg>
              )}
            </button>

            {!selectedEventId && !readOnly && (
              <button
                onClick={() => openDrawer('event-edit', null)}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Nuevo Evento
              </button>
            )}

            {selectedEventId && (
              <>
                <button
                  onClick={handleScanEvent}
className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${t.btnGhost}`}
                  >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                  </svg>
                  Escanear
                </button>
                {!readOnly && (
                  <button
                    onClick={() => openDrawer('import-csv', { eventId: selectedEventId })}
className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${t.btnGhost}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                    </svg>
                    Importar CSV
                  </button>
                )}
                {!readOnly && (
                  <button
                    onClick={() => {
                      if (selectedEventId) {
                        exportXlsxMutation.mutate(selectedEventId, {
                          onSuccess: (data) => success('Exportado', `${data?.count} participantes exportados`),
                          onError: (err) => {
                            if (err.message !== 'Operación cancelada por el usuario') {
                              toastError('Error al exportar', err.message)
                            }
                          },
                        })
                      }
                    }}
                    disabled={exportXlsxMutation.isPending}
                    className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 ${t.btnGhost}`}
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4 4l-4-4m0 0L8 20m4-4v12" />
                    </svg>
                    {exportXlsxMutation.isPending ? 'Exportando...' : 'Exportar Excel'}
                  </button>
                )}
                <button
                  onClick={() => window.print()}
className={`flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-colors ${t.btnGhost}`}
                  >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Imprimir
                </button>
                {!readOnly && (
                  <button
                    onClick={() =>
                      openDrawer('participant-create', {
                        eventId: selectedEventId,
                        coverPrice: selectedEvent?.coverPrice,
                      })
                    }
                    className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-500 transition-colors shadow-lg shadow-emerald-600/20"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Nuevo Participante
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </header>

      <main className="px-8 py-6">
        {!selectedEventId ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <svg
                  className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.textMuted}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  placeholder="Buscar eventos..."
                  value={eventSearch}
                  onChange={(e) => setEventSearch(e.target.value)}
                  className={`w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm ${t.input}`}
                />
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                placeholder="Desde"
                className={`rounded-lg border py-2.5 px-3 text-sm ${t.input} ${theme === 'dark' ? '[color-scheme:dark]' : '[color-scheme:light]'}`}
              />
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                placeholder="Hasta"
                className={`rounded-lg border py-2.5 px-3 text-sm ${t.input} ${theme === 'dark' ? '[color-scheme:dark]' : '[color-scheme:light]'}`}
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${t.btnGhost}`}
                >
                  Limpiar fechas
                </button>
              )}
            </div>

            <EventTable
              events={eventsData?.items || []}
              isLoading={eventsLoading}
              onEdit={handleEditEvent}
              onDelete={handleDeleteEvent}
              onSelectEvent={handleSelectEvent}
              readOnly={readOnly}
            />
          </div>
        ) : (
          <div className="space-y-4">
            {eventStats ? (
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  label="Total"
                  value={eventStats.totalParticipants}
                  color={t.textPrimary}
                />
                <StatCard
                  label="Entregados"
                  value={eventStats.delivered}
                  color={t.okText}
                />
                <StatCard
                  label="Pendientes"
                  value={eventStats.pending}
                  color={t.accent}
                />
                <StatCard
                  label="Cobrado"
                  value={formatCOP(eventStats.collected)}
                  color={t.okText}
                />
              </div>
            ) : selectedEvent && (
              <div className="grid grid-cols-4 gap-4">
                <StatCard
                  label="Total"
                  value={selectedEvent._count?.participants ?? 0}
                  color={t.textPrimary}
                />
                <StatCard
                  label="Precio Base"
                  value={formatCOP(selectedEvent.coverPrice)}
                  color={t.accent}
                />
                <StatCard
                  label="Por Cobrar"
                  value={0}
                  color={t.textMuted}
                />
              </div>
            )}

            {selectedEvent && !readOnly && (
              <div className="flex items-center gap-2">
                <span className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>Estado:</span>
                {['ACTIVO', 'FINALIZADO', 'CANCELADO'].map((status) => (
                  <button
                    key={status}
                    onClick={() => handleStatusChange(status)}
                    disabled={selectedEvent.status === status}
                    className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
                      selectedEvent.status === status
                        ? status === 'ACTIVO'
                          ? theme === 'dark'
                            ? 'border-emerald-500/50 bg-emerald-900/30 text-emerald-400 cursor-not-allowed'
                            : 'border-emerald-300 bg-emerald-100 text-emerald-800 cursor-not-allowed'
                          : status === 'FINALIZADO'
                          ? theme === 'dark'
                            ? 'border-gray-500/50 bg-gray-800/50 text-gray-400 cursor-not-allowed'
                            : 'border-gray-300 bg-gray-200 text-gray-600 cursor-not-allowed'
                          : theme === 'dark'
                          ? 'border-red-500/50 bg-red-900/30 text-red-400 cursor-not-allowed'
                          : 'border-red-300 bg-red-100 text-red-700 cursor-not-allowed'
                        : t.btnGhost
                    }`}
                  >
                    {status === 'ACTIVO' ? 'Activo' : status === 'FINALIZADO' ? 'Finalizado' : 'Cancelar'}
                  </button>
                ))}
              </div>
            )}

            <div className="relative">
              <svg
                className={`absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.textMuted}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                placeholder="Buscar por nombre, cédula, teléfono o código..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className={`w-full rounded-lg border py-2.5 pl-10 pr-4 text-sm ${t.input}`}
              />
            </div>

            <ParticipantTable
              participants={participantsData?.items || []}
              isLoading={participantsLoading}
              eventId={selectedEventId}
              onEdit={handleEditParticipant}
              onDelete={handleDeleteParticipant}
              onBulkStatusChange={handleBulkStatusChange}
              onBulkDelete={handleBulkDelete}
              readOnly={readOnly}
            />

            {participantsData && participantsData.totalPages > 1 && (
              <div className="flex items-center justify-between">
                <p className={`text-sm ${mutedText}`}>
                  Mostrando {(participantPage - 1) * 50 + 1}-
                  {Math.min(participantPage * 50, participantsData.total)} de{' '}
                  {participantsData.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setParticipantPage((p) => Math.max(1, p - 1))}
                    disabled={participantPage === 1}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${t.btnGhost}`}
                  >
                    Anterior
                  </button>
                  <button
                    onClick={() =>
                      setParticipantPage((p) =>
                        Math.min(participantsData.totalPages, p + 1)
                      )
                    }
                    disabled={participantPage === participantsData.totalPages}
                    className={`rounded-lg border px-3 py-1.5 text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${t.btnGhost}`}
                  >
                    Siguiente
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </main>

      {selectedEventId && <ParticipantDrawer eventId={selectedEventId} />}
      {selectedEventId && <PaymentDrawer eventId={selectedEventId} />}

      {selectedEvent && participantsData && (
        <PrintView
          eventName={selectedEvent.name}
          eventDate={selectedEvent.date}
          eventLocation={selectedEvent.location ?? null}
          participants={participantsData.items.map((p: ParticipantItem) => ({
            name: p.name,
            phone: p.phone ?? null,
            email: p.email ?? null,
            quantity: p.quantity,
            unitPrice: p.unitPrice ?? null,
            coverPrice: selectedEvent.coverPrice,
            status: p.status,
            paymentStatus: p.paymentStatus,
            paidAmount: p.paidAmount,
            barcode: p.barcode ?? null,
          }))}
        />
      )}

      <ConfirmDialog
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        variant={confirmState.variant}
        confirmLabel={confirmState.confirmLabel || 'Confirmar'}
        onConfirm={confirmState.onConfirm}
        onCancel={() => setConfirmState((s) => ({ ...s, isOpen: false }))}
      />
    </div>
  )
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  const t = useThemeTokens()
  return (
    <div className={`rounded-xl border p-4 ${t.border} ${t.cardBg}`}>
      <p className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
