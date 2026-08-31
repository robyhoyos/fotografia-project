// src/renderer/src/pages/AlertsPage.tsx
// Vista de Alertas: banner de eventos próximos + gestión de incidencias
// editables/resolubles (equipo dañado, accesorios por comprar, pendientes).

import React, { useState } from 'react'
import { useUIStore } from '../stores/ui.store'
import { useThemeTokens } from '../lib/theme'
import { useToast } from '../hooks/useToast'
import { useAlertsSummary, useCreateIncident, useUpdateIncident, useDeleteIncident } from '../hooks/useAlerts'
import { useEvents } from '../hooks/useEvents'
import { ConfirmDialog } from '../components/ui/ConfirmDialog'
import type { Incident, IncidentInput } from '../../../../shared/types/ipc'
import type { ThemeTokens } from '../lib/theme'

const TYPE_LABELS: Record<Incident['type'], string> = {
  EQUIPO_DANADO: 'Equipo dañado',
  ACCESORIO_POR_COMPRAR: 'Accesorio por comprar',
  PENDIENTE: 'Pendiente',
}

const TYPE_BADGE: Record<Incident['type'], keyof ThemeTokens> = {
  EQUIPO_DANADO: 'badgeRed',
  ACCESORIO_POR_COMPRAR: 'badgeAmber',
  PENDIENTE: 'badgeGray',
}

export function AlertsPage() {
  const t = useThemeTokens()
  const theme = useUIStore((s) => s.theme)
  const setActiveView = useUIStore((s) => s.setActiveView)
  const requestEvent = useUIStore((s) => s.requestEvent)
  const { success: toastSuccess, error: toastError } = useToast()

  const { data: summary, isLoading, refetch } = useAlertsSummary()
  const createIncident = useCreateIncident()
  const updateIncident = useUpdateIncident()
  const deleteIncident = useDeleteIncident()

  // Eventos para el selector de incidencia
  const { data: eventsData } = useEvents({ page: 1, pageSize: 100, sortBy: 'date', sortOrder: 'desc' })

  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Incident | null>(null)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<Incident['type']>('PENDIENTE')
  const [eventId, setEventId] = useState('')
  const [dueDate, setDueDate] = useState('')

  const openEvent = (id: string) => {
    requestEvent(id)
    setActiveView('events')
  }

  const resetForm = () => {
    setShowForm(false)
    setEditingId(null)
    setTitle('')
    setDescription('')
    setType('PENDIENTE')
    setEventId('')
    setDueDate('')
  }

  const startCreate = () => {
    resetForm()
    setShowForm(true)
  }

  const startEdit = (inc: Incident) => {
    setEditingId(inc.id)
    setTitle(inc.title)
    setDescription(inc.description ?? '')
    setType(inc.type)
    setEventId(inc.eventId ?? '')
    setDueDate(inc.dueDate ? inc.dueDate.slice(0, 16) : '')
    setShowForm(true)
  }

  const handleSave = () => {
    if (!title.trim()) {
      toastError('Título requerido', 'Escribe un título para la incidencia')
      return
    }
    const input: IncidentInput = {
      title: title.trim(),
      description: description.trim() || null,
      type,
      eventId: eventId || null,
      dueDate: dueDate ? new Date(dueDate).toISOString() : null,
    }

    const onSuccess = () => {
      toastSuccess(editingId ? 'Incidencia actualizada' : 'Incidencia creada', '')
      resetForm()
    }
    const onError = (err: Error) => toastError('Error', err.message)

    if (editingId) {
      updateIncident.mutate({ id: editingId, input }, { onSuccess, onError })
    } else {
      createIncident.mutate(input, { onSuccess, onError })
    }
  }

  const handleToggleResolve = (inc: Incident) => {
    const nextStatus = inc.status === 'ABIERTA' ? 'RESUELTA' : 'ABIERTA'
    updateIncident.mutate(
      { id: inc.id, input: { status: nextStatus } },
      {
        onSuccess: () =>
          toastSuccess(
            nextStatus === 'RESUELTA' ? 'Incidencia resuelta' : 'Incidencia reabierta',
            ''
          ),
        onError: (err: Error) => toastError('Error', err.message),
      }
    )
  }

  const handleDelete = () => {
    if (!deleteTarget) return
    deleteIncident.mutate(deleteTarget.id, {
      onSuccess: () => toastSuccess('Incidencia eliminada', ''),
      onError: (err: Error) => toastError('Error', err.message),
    })
    setDeleteTarget(null)
  }

  const inputClass = `w-full rounded-lg border px-3 py-2 text-sm ${t.input}`

  const events = (eventsData?.items ?? []) as Array<{ id: string; name: string }>

  return (
    <div className="space-y-6">
      {/* ─── Encabezado ─────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={`text-lg font-semibold ${t.textPrimary}`}>Alertas</h2>
          <p className={`text-sm ${t.textMuted}`}>
            Eventos próximos e incidencias por resolver
          </p>
        </div>
        <button
          onClick={startCreate}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
        >
          + Nueva incidencia
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
        </div>
      ) : (
        <>
          {/* ─── Eventos próximos ───────────────────────────── */}
          <section>
            <div className={`mb-3 flex items-center gap-2 ${t.textSecondary}`}>
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <h3 className="text-sm font-semibold">Eventos próximos</h3>
            </div>
            {summary?.upcomingEvents.length === 0 ? (
              <p className={`text-sm ${t.textMuted}`}>No hay eventos programados próximamente.</p>
            ) : (
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {summary?.upcomingEvents.map((ev) => {
                  const date = new Date(ev.date)
                  const days = Math.ceil((date.getTime() - Date.now()) / 86_400_000)
                  return (
                    <button
                      key={ev.id}
                      onClick={() => openEvent(ev.id)}
                      className={`rounded-lg border p-4 text-left transition-colors ${t.border} ${t.cardBg} ${t.rowHover}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className={`text-sm font-medium truncate ${t.textPrimary}`}>
                            {ev.name}
                          </p>
                          <p className={`text-xs mt-0.5 ${t.textMuted}`}>
                            {date.toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                          {ev.location && (
                            <p className={`text-xs mt-0.5 truncate ${t.textMuted}`}>
                              📍 {ev.location}
                            </p>
                          )}
                        </div>
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                            days < 3
                              ? t.badgeRed
                              : days <= 7
                              ? t.badgeAmber
                              : t.badgeGray
                          }`}
                        >
                          {days < 0
                            ? 'Hoy'
                            : days === 0
                            ? 'Hoy'
                            : days === 1
                            ? 'Mañana'
                            : `En ${days} días`}
                        </span>
                      </div>
                      <p className={`text-[11px] mt-2 ${t.textMuted}`}>
                        {ev.participantCount} participante{ev.participantCount === 1 ? '' : 's'}
                      </p>
                    </button>
                  )
                })}
              </div>
            )}
          </section>

          {/* ─── Formulario de incidencia ───────────────────── */}
          {showForm && (
            <section
              className={`rounded-lg border p-5 ${t.border} ${t.cardBg}`}
            >
              <h3 className={`text-sm font-semibold mb-4 ${t.textPrimary}`}>
                {editingId ? 'Editar incidencia' : 'Nueva incidencia'}
              </h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                    Título *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Ej: Reparar reflector principal"
                    className={`mt-1 ${inputClass}`}
                  />
                </div>

                <div className="md:col-span-2">
                  <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                    Descripción
                  </label>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Detalles de la incidencia (opcional)"
                    rows={2}
                    className={`mt-1 ${inputClass}`}
                  />
                </div>

                <div>
                  <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                    Tipo
                  </label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as Incident['type'])}
                    className={`mt-1 ${inputClass}`}
                  >
                    {(Object.keys(TYPE_LABELS) as Incident['type'][]).map((k) => (
                      <option key={k} value={k}>
                        {TYPE_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                    Evento relacionado
                  </label>
                  <select
                    value={eventId}
                    onChange={(e) => setEventId(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  >
                    <option value="">Sin evento</option>
                    {events.map((ev) => (
                      <option key={ev.id} value={ev.id}>
                        {ev.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                    Fecha límite
                  </label>
                  <input
                    type="datetime-local"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`mt-1 ${inputClass}`}
                  />
                </div>

                <div className="flex items-end gap-2 md:justify-end">
                  <button
                    onClick={resetForm}
                    className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${t.btnGhost}`}
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={createIncident.isPending || updateIncident.isPending}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors disabled:opacity-50"
                  >
                    {createIncident.isPending || updateIncident.isPending
                      ? 'Guardando...'
                      : 'Guardar'}
                  </button>
                </div>
              </div>
            </section>
          )}

          {/* ─── Lista de incidencias ───────────────────────── */}
          <section>
            <div className={`mb-3 flex items-center justify-between ${t.textSecondary}`}>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                <h3 className="text-sm font-semibold">Incidencias</h3>
                {summary && summary.openIncidents > 0 && (
                  <span className="rounded-full bg-red-500/20 px-2 py-0.5 text-[10px] font-medium text-red-400">
                    {summary.openIncidents} abiertas
                  </span>
                )}
              </div>
              <button
                onClick={() => refetch()}
                className="text-xs text-gray-400 hover:text-emerald-400 transition-colors"
              >
                Refrescar
              </button>
            </div>

            {summary?.incidents.length === 0 ? (
              <div className={`text-center py-12 rounded-lg border border-dashed ${t.border}`}>
                <p className={`text-sm ${t.textMuted}`}>
                  Sin incidencias. Todo bajo control.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {summary?.incidents.map((inc) => (
                  <div
                    key={inc.id}
                    className={`rounded-lg border px-4 py-3 transition-colors ${
                      inc.status === 'RESUELTA'
                        ? `${t.border} opacity-60`
                        : `${t.border} ${t.cardBg}`
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-medium ${
                              inc.status === 'RESUELTA' ? 'line-through' : ''
                            } ${t.textPrimary}`}
                          >
                            {inc.title}
                          </span>
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t[TYPE_BADGE[inc.type]]}`}>
                            {TYPE_LABELS[inc.type]}
                          </span>
                          {inc.status === 'RESUELTA' && (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${t.badgeEmerald}`}>
                              RESUELTA
                            </span>
                          )}
                        </div>
                        {inc.description && (
                          <p className={`text-xs mt-1 ${t.textMuted}`}>{inc.description}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5">
                          {inc.eventName && (
                            <span className={`text-[11px] ${t.textFaint}`}>
                              Evento: {inc.eventName}
                            </span>
                          )}
                          {inc.dueDate && (
                            <span className={`text-[11px] ${t.textFaint}`}>
                              Límite:{' '}
                              {new Date(inc.dueDate).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: 'short',
                              })}
                            </span>
                          )}
                          <span className={`text-[11px] ${t.textFaint}`}>
                            {new Date(inc.createdAt).toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1.5">
                        <button
                          onClick={() => handleToggleResolve(inc)}
                          title={inc.status === 'ABIERTA' ? 'Resolver' : 'Reabrir'}
                          className={`rounded p-1.5 transition-colors ${
                            inc.status === 'ABIERTA'
                              ? 'text-gray-400 hover:bg-emerald-500/10 hover:text-emerald-400'
                              : `text-gray-400 ${
                                  theme === 'dark'
                                    ? 'hover:bg-gray-700/50 hover:text-white'
                                    : 'hover:bg-gray-200 hover:text-gray-800'
                                }`
                          }`}
                        >
                          {inc.status === 'ABIERTA' ? (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          ) : (
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                            </svg>
                          )}
                        </button>
                        <button
                          onClick={() => startEdit(inc)}
                          title="Editar"
                          className={`rounded p-1.5 text-gray-400 transition-colors ${
                            theme === 'dark'
                              ? 'hover:bg-gray-700/50 hover:text-white'
                              : 'hover:bg-gray-200 hover:text-gray-800'
                          }`}
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => setDeleteTarget(inc)}
                          title="Eliminar"
                          className="rounded p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-colors"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <ConfirmDialog
        isOpen={!!deleteTarget}
        title="Eliminar incidencia"
        message="¿Eliminar esta incidencia? Esta acción no se puede deshacer."
        confirmLabel="Eliminar"
        variant="danger"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}