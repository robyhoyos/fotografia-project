// src/renderer/src/components/dashboard/StatsDashboard.tsx
// Dashboard de estadísticas globales.
// Muestra métricas reales calculadas en el Main process (StatsService):
// cobrado, pendiente, entregados, por categoría y serie mensual.
// Incluye filtro por categoría, gráfico de barras mensual (sin dependencias)
// y tabla de últimos eventos navegable hacia la vista de Eventos.

import React, { useState } from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useThemeTokens } from '../../lib/theme'
import { useDashboardStats } from '../../hooks/useDashboard'
import { useReceivables } from '../../hooks/useAlerts'
import { formatCOP } from '../../lib/format'
import type { StoredEvent } from '../../../../../shared/types/ipc'

const CATEGORIES = [
  { value: 'SACRAMENTAL', label: 'Sacramental', badge: 'badgeAmber' as const },
  { value: 'ESCOLAR', label: 'Escolar', badge: 'badgeBlue' as const },
  { value: 'ESTUDIO', label: 'Estudio', badge: 'badgePurple' as const },
]

export function StatsDashboard() {
  const t = useThemeTokens()
  const theme = useUIStore((s) => s.theme)
  const requestEvent = useUIStore((s) => s.requestEvent)
  const setActiveView = useUIStore((s) => s.setActiveView)

  const [category, setCategory] = useState('')

  const { data, isLoading, isError, error, refetch } = useDashboardStats({
    category: (category || undefined) as 'SACRAMENTAL' | 'ESCOLAR' | 'ESTUDIO' | undefined,
  })

  const openEvent = (event: StoredEvent) => {
    requestEvent(event.id)
    setActiveView('events')
  }

  const inputClass = `rounded-lg border px-3 py-2 text-sm ${t.input} ${
    theme === 'dark' ? '[color-scheme:dark]' : '[color-scheme:light]'
  }`

  return (
    <div className="space-y-6">
      {/* ─── Encabezado ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className={`text-lg font-semibold ${t.textPrimary}`}>Dashboard</h2>
          <p className={`text-sm ${t.textMuted}`}>
            Resumen general de tu negocio fotográfico
          </p>
        </div>

        {/* ─── Filtros ──────────────────────────────────────── */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <LoadingSkeleton />}

      {isError && (
        <div className={`rounded-xl border p-8 text-center ${t.border} ${t.cardBg}`}>
          <p className={`text-sm font-medium ${t.dangerText}`}>
            Error al cargar estadísticas
          </p>
          <p className={`mt-1 text-sm ${t.textMuted}`}>{error?.message}</p>
          <button
            onClick={() => refetch()}
            className={`mt-4 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${t.btnGhost}`}
          >
            Reintentar
          </button>
        </div>
      )}

      {!isLoading && !isError && data && (
        <>
          {/* ─── KPIs principales ───────────────────────────── */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Total Eventos" value={data.totalEvents} icon={CameraIcon} color={t.textPrimary} />
            <KpiCard label="Participantes" value={data.totalParticipants} icon={PeopleIcon} color={t.infoText} />
            <KpiCard label="Cobrado" value={formatCOP(data.collected)} icon={CheckIcon} color={t.okText} />
            <KpiCard label="Por Cobrar" value={formatCOP(data.outstanding)} icon={ClockIcon} color={t.accent} />
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <KpiCard label="Eventos Activos" value={data.activeEvents} small color={t.okText} />
            <KpiCard label="Entregados" value={data.delivered} small color={t.okText} />
            <KpiCard label="Pendientes" value={data.pending} small color={t.accent} />
            <KpiCard label="Cancelados" value={data.cancelled} small color={t.dangerText} />
          </div>

          {data.totalEvents === 0 && (
            <div className={`flex flex-col items-center justify-center py-12 ${t.textMuted}`}>
              <svg className={`h-12 w-12 mb-4 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              <p className="text-sm font-medium">Sin datos aún</p>
              <p className={`text-xs mt-1 ${t.textFaint}`}>Crea tu primer evento para ver estadísticas</p>
            </div>
          )}

          {data.totalParticipants > 0 && (
            <>
              {/* ─── Por categoría ───────────────────────────── */}
              <section>
                <h3 className={`text-sm font-medium ${t.textMuted} uppercase tracking-wider mb-3`}>
                  Por Categoría
                </h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {CATEGORIES.map((cat) => {
                    const stats = data.byCategory.find((c) => c.category === cat.value)
                    return (
                      <div
                        key={cat.value}
                        className={`rounded-lg border px-4 py-4 ${t.border} ${t.cardBg}`}
                      >
                        <div className="flex items-center justify-between">
                          <p className={`text-xs font-medium uppercase tracking-wider ${t.textMuted}`}>
                            {cat.label}
                          </p>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${t[cat.badge]}`}>
                            {stats?.events ?? 0} ev.
                          </span>
                        </div>
                        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className={`text-lg font-bold ${t.textPrimary}`}>
                              {stats?.participants ?? 0}
                            </p>
                            <p className={`text-[10px] ${t.textFaint}`}>Participantes</p>
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${t.okText}`}>
                              {formatCOP(stats?.collected ?? 0).replace('$', '')}
                            </p>
                            <p className={`text-[10px] ${t.textFaint}`}>Cobrado</p>
                          </div>
                          <div>
                            <p className={`text-lg font-bold ${t.accent}`}>
                              {formatCOP(stats?.outstanding ?? 0).replace('$', '')}
                            </p>
                            <p className={`text-[10px] ${t.textFaint}`}>Por Cobrar</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* ─── Serie mensual (gráfico de barras) ──────── */}
              <section>
                <h3 className={`text-sm font-medium ${t.textMuted} uppercase tracking-wider mb-3`}>
                  Cobrado por Mes
                </h3>
                <MonthlyChart monthly={data.monthly} theme={theme} t={t} />
              </section>
            </>
          )}

          {/* ─── Últimos eventos ─────────────────────────────── */}
          {data.lastEvents.length > 0 && (
            <section>
              <h3 className={`text-sm font-medium ${t.textMuted} uppercase tracking-wider mb-3`}>
                Últimos Eventos
              </h3>
              <div className={`rounded-xl border overflow-hidden ${t.border} ${t.cardBg}`}>
                <div className="overflow-x-auto">
                  <table className="w-full whitespace-nowrap">
                    <thead>
                      <tr className={`border-b ${t.border} ${t.tableHeadBg}`}>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Evento</th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Categoría</th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Participantes</th>
                        <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Precio Base</th>
                        <th className={`px-4 py-3 ${t.tableHeadText}`}></th>
                      </tr>
                    </thead>
                    <tbody className={`divide-y ${t.divider}`}>
                      {data.lastEvents.map((event) => (
                        <tr
                          key={event.id}
                          onClick={() => openEvent(event)}
                          className={`${t.rowHover} transition-colors cursor-pointer`}
                        >
                          <td className="px-4 py-3">
                            <p className={`text-sm font-medium ${t.textPrimary}`}>{event.name}</p>
                            <p className={`text-xs ${t.textMuted}`}>
                              {new Date(event.date).toLocaleDateString('es-CO', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric',
                              })}
                            </p>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                              t[CATEGORIES.find((c) => c.value === event.category)?.badge || 'badgeGray']
                            }`}>
                              {CATEGORIES.find((c) => c.value === event.category)?.label || event.category}
                            </span>
                          </td>
                          <td className={`px-4 py-3 text-sm font-medium ${t.textPrimary}`}>
                            {event._count?.participants ?? 0}
                          </td>
                          <td className={`px-4 py-3 text-sm font-medium ${t.accent}`}>
                            {formatCOP(event.coverPrice)}
                          </td>
                          <td className="px-4 py-3">
                            <svg className={`h-4 w-4 ${t.textFaint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

          <ReceivablesPanel />
        </>
      )}
    </div>
  )
}

// ─── Tarjeta KPI ───────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
  small,
}: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ className?: string }>
  color: string
  small?: boolean
}) {
  const t = useThemeTokens()
  const theme = useUIStore((s) => s.theme)
  const chipBg = theme === 'dark' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-700'
  return (
    <div className={`group relative rounded-xl border p-4 overflow-hidden transition-shadow hover:shadow-md ${t.border} ${t.cardBg}`}>
      <span className="absolute left-0 top-0 h-full w-0.5 bg-emerald-500/0 group-hover:bg-emerald-500/70 transition-colors" aria-hidden="true" />
      <div className="flex items-center justify-between">
        <p className={`text-xs font-semibold uppercase tracking-wider ${t.textMuted}`}>
          {label}
        </p>
        {Icon && (
          <span className={`flex h-7 w-7 items-center justify-center rounded-full ${chipBg}`}>
            <Icon className="h-3.5 w-3.5" />
          </span>
        )}
      </div>
      <p className={`mt-2 font-bold font-display ${small ? 'text-2xl' : 'text-3xl'} tracking-tight ${color}`}>{value}</p>
    </div>
  )
}

// ─── Glifos de KPI (SVG) ────────────────────────────────────────────

function CameraIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function PeopleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  )
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

function ClockIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  )
}

// ─── Skeleton de carga ─────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-4"
          >
            <div className="h-3 w-20 rounded bg-gray-700/40 animate-pulse" />
            <div className="mt-3 h-8 w-16 rounded bg-gray-700/30 animate-pulse" />
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-gray-800/50 bg-gray-900/50 p-5">
        <div className="h-4 w-32 rounded bg-gray-700/40 animate-pulse mb-4" />
        <div className="h-40 rounded-lg bg-gray-700/20 animate-pulse" />
      </div>
    </div>
  )
}

// ─── Cuentas por cobrar (global) ──────────────────────────────────

function ReceivablesPanel() {
  const t = useThemeTokens()
  const setActiveView = useUIStore((s) => s.setActiveView)
  const requestEvent = useUIStore((s) => s.requestEvent)
  const { data, isLoading, refetch } = useReceivables()

  if (isLoading) return null

  if (!data || data.length === 0) return null

  const totalOutstanding = data.reduce((sum, r) => sum + r.outstanding, 0)

  const goToEvent = (eventId: string) => {
    requestEvent(eventId)
    setActiveView('events')
  }

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h3 className={`text-sm font-medium uppercase tracking-wider ${t.textMuted}`}>
            Cuentas por Cobrar
          </h3>
          <p className={`text-xs mt-0.5 ${t.textFaint}`}>
            {data.length} saldo{data.length === 1 ? '' : 's'} pendiente
            {data.length > 0 && ` · ${formatCOP(totalOutstanding)}`}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="text-xs text-gray-400 hover:text-emerald-400 transition-colors"
        >
          Refrescar
        </button>
      </div>

      <div className={`rounded-xl border overflow-hidden ${t.border} ${t.cardBg}`}>
        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap">
            <thead>
              <tr className={`border-b ${t.border} ${t.tableHeadBg}`}>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Participante</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Evento</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Total</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Pagado</th>
                <th className={`px-4 py-3 text-left text-xs font-medium uppercase tracking-wider ${t.tableHeadText}`}>Pendiente</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divider}`}>
              {data.slice(0, 10).map((r) => (
                <tr
                  key={r.participantId}
                  onClick={() => goToEvent(r.eventId)}
                  className={`${t.rowHover} transition-colors cursor-pointer`}
                >
                  <td className="px-4 py-3">
                    <p className={`text-sm font-medium ${t.textPrimary}`}>{r.participantName}</p>
                    {r.phone && <p className={`text-xs ${t.textMuted}`}>{r.phone}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className={`text-sm ${t.textSecondary}`}>{r.eventName}</p>
                    <p className={`text-xs ${t.textMuted}`}>
                      {new Date(r.eventDate).toLocaleDateString('es-CO', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </p>
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${t.textSecondary}`}>
                    {formatCOP(r.totalDue)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${t.okText}`}>
                    {formatCOP(r.paidAmount)}
                  </td>
                  <td className={`px-4 py-3 text-sm font-bold ${t.accent}`}>
                    {formatCOP(r.outstanding)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  )
}

// ─── Gráfico mensual (barras con divs, sin dependencias) ──────────

function MonthlyChart({
  monthly,
  theme,
  t,
}: {
  monthly: Array<{ month: string; label: string; revenue: number; collected: number }>
  theme: 'dark' | 'light'
  t: ReturnType<typeof useThemeTokens>
}) {
  if (monthly.length === 0) {
    return (
      <div className={`rounded-xl border p-6 text-center ${t.border} ${t.cardBg}`}>
        <p className={`text-sm ${t.textMuted}`}>Sin movimientos en el período seleccionado</p>
      </div>
    )
  }

  const maxValue = Math.max(
    ...monthly.map((m) => Math.max(m.collected, m.revenue)),
    1
  )

  const barTrack = theme === 'dark' ? 'bg-gray-800' : 'bg-gray-100'
  const barFill = theme === 'dark' ? 'bg-emerald-500' : 'bg-emerald-600'
  const revenueFill = theme === 'dark' ? 'bg-gray-600' : 'bg-gray-300'
  const tickMuted = theme === 'dark' ? 'text-gray-600' : 'text-gray-400'

  return (
    <div className={`rounded-xl border p-5 ${t.border} ${t.cardBg}`}>
      <div className="flex items-center justify-between mb-4 text-xs">
        <div className="flex items-center gap-4">
          <span className={`flex items-center gap-1.5 ${t.textMuted}`}>
            <span className={`inline-block h-2.5 w-2.5 rounded ${barFill}`} /> Cobrado
          </span>
          <span className={`flex items-center gap-1.5 ${t.textMuted}`}>
            <span className={`inline-block h-2.5 w-2.5 rounded ${revenueFill}`} /> Total facturado
          </span>
        </div>
      </div>

      <div className="flex items-end gap-2 sm:gap-4" style={{ height: 180 }}>
        {monthly.map((m) => {
          const collectedPct = Math.max((m.collected / maxValue) * 100, m.collected > 0 ? 4 : 0)
          const revenuePct = Math.max((m.revenue / maxValue) * 100, m.revenue > 0 ? 4 : 0)
          return (
            <div key={m.month} className="flex flex-1 flex-col items-center gap-2">
              <div className={`text-[10px] ${t.textMuted}`}>
                {formatCOP(m.collected).replace('$', '')}
              </div>
              <div
                className={`relative w-full max-w-[48px] rounded-t-md ${barTrack}`}
                style={{ height: 120 }}
              >
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t-md ${revenueFill}`}
                  style={{ height: `${revenuePct}%` }}
                />
                <div
                  className={`absolute bottom-0 left-0 right-0 rounded-t-md ${barFill}`}
                  style={{ height: `${collectedPct}%` }}
                />
              </div>
              <div className={`text-[10px] font-medium ${tickMuted}`}>{m.label}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}