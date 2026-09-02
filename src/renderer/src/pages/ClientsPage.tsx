// src/renderer/src/pages/ClientsPage.tsx
// Página "Clientes Registrados": base de datos de clientes únicos por cédula.
// Muestra nombre, cédula, teléfono, email y métricas de trabajo con la agencia,
// con búsqueda y filtrado en vivo. Estilo editorial esmeralda coherente con la app.

import React, { useMemo, useState } from 'react'
import { useThemeTokens } from '../lib/theme'
import { useCustomers, useSetCustomerRating } from '../hooks/useCustomers'
import { useToast } from '../hooks/useToast'
import { formatCOP, formatDateLong } from '../lib/format'
import type { CustomerSummary } from '../../../../shared/types/ipc'

const RATING_LABELS: Record<number, string> = {
  1: 'Cuidado',
  2: 'Regular',
  3: 'Buena',
}

const RATING_STYLES: Record<number, string> = {
  1: 'bg-red-500/20 text-red-400 border-red-500/30',
  2: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  3: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

export function ClientsPage() {
  const t = useThemeTokens()
  const { success, error: toastError } = useToast()
  const { data: customers, isLoading, isError } = useCustomers()
  const setRatingMutation = useSetCustomerRating()

  const [search, setSearch] = useState('')
  const [ratingFilter, setRatingFilter] = useState<'all' | 'unrated' | number>('all')

  const filtered = useMemo(() => {
    if (!customers) return []
    const q = search.trim().toLowerCase()
    return customers.filter((c) => {
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        (c.cedula || '').includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      if (!matchesSearch) return false
      if (ratingFilter === 'all') return true
      if (ratingFilter === 'unrated') return c.rating == null
      return c.rating === ratingFilter
    })
  }, [customers, search, ratingFilter])

  const handleSetRating = (cedula: string, rating: number | null) => {
    setRatingMutation.mutate(
      { cedula, rating },
      {
        onSuccess: () => {
          success(
            'Calificación actualizada',
            rating ? RATING_LABELS[rating] : 'Calificación eliminada'
          )
        },
        onError: (err) => {
          toastError('Error', err.message)
        },
      }
    )
  }

  return (
    <div className="px-8 py-6 space-y-6">
      {/* Encabezado editorial */}
      <div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
          <p className="text-xs font-semibold uppercase tracking-widest text-emerald-500">
            Base de datos de clientes
          </p>
        </div>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight">
          Clientes Registrados
        </h1>
        <p className={`mt-1 text-sm ${t.textMuted}`}>
          Todos los clientes únicos por cédula y su historial de trabajo con la agencia
        </p>
      </div>

      {/* Barra de herramientas: búsqueda + filtro + contador */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 items-center gap-2">
          <div className="relative flex-1 max-w-md">
            <svg
              className={`pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 ${t.textMuted}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por nombre, cédula o teléfono..."
              className={`w-full rounded-lg border py-2 pl-9 pr-3 text-sm ${t.input}`}
            />
          </div>

          <select
            value={String(ratingFilter)}
            onChange={(e) => {
              const v = e.target.value
              setRatingFilter(v === 'all' ? 'all' : v === 'unrated' ? 'unrated' : Number(v))
            }}
            className={`rounded-lg border px-3 py-2 text-sm ${t.input}`}
          >
            <option value="all">Todas las calificaciones</option>
            <option value="unrated">Sin calificar</option>
            <option value="3">Buena</option>
            <option value="2">Regular</option>
            <option value="1">Cuidado</option>
          </select>
        </div>

        <div className={`text-sm ${t.textMuted}`}>
          <span className="font-semibold text-emerald-500">{filtered.length}</span>
          {' '}de {customers?.length ?? 0} clientes
        </div>
      </div>

      {/* Estado de carga / error */}
      {isLoading && (
        <div className={`flex items-center justify-center rounded-xl border ${t.border} py-16 ${t.cardBg}`}>
          <p className={`text-sm ${t.textMuted}`}>Cargando clientes...</p>
        </div>
      )}

      {!isLoading && isError && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-red-500/30 bg-red-500/10 py-16 text-center">
          <p className="text-sm font-medium text-red-400">
            No se pudo cargar la base de datos de clientes
          </p>
          <p className={`mt-1 text-xs ${t.textMuted}`}>Revisa la conexión y vuelve a intentar</p>
        </div>
      )}

      {!isLoading && !isError && filtered.length === 0 && (
        <div className={`flex flex-col items-center justify-center rounded-xl border ${t.border} py-16 text-center ${t.cardBg}`}>
          <p className="text-sm font-medium">No hay clientes que coincidan</p>
          <p className={`mt-1 text-xs ${t.textMuted}`}>
            {search
              ? 'Ajusta la búsqueda o los filtros'
              : 'Aún no hay participantes registrados en los eventos'}
          </p>
        </div>
      )}

      {/* Tabla de clientes */}
      {!isLoading && !isError && filtered.length > 0 && (
        <div className={`overflow-hidden rounded-xl border ${t.border}`}>
          <table className="w-full text-sm">
            <thead className={t.tableHeadBg}>
              <tr className={`text-left text-xs uppercase tracking-wider ${t.tableHeadText}`}>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Cédula</th>
                <th className="px-4 py-3 font-semibold">Teléfono</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold text-center">Eventos</th>
                <th className="px-4 py-3 font-semibold text-right">Total pagado</th>
                <th className="px-4 py-3 font-semibold text-center">Calificación</th>
              </tr>
            </thead>
            <tbody className={`divide-y ${t.divider}`}>
              {filtered.map((c) => (
                <ClientRow
                  key={c.cedula}
                  customer={c}
                  ratingStyles={RATING_STYLES}
                  ratingLabels={RATING_LABELS}
                  onSetRating={handleSetRating}
                  disabled={setRatingMutation.isPending}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface ClientRowProps {
  customer: CustomerSummary
  ratingStyles: Record<number, string>
  ratingLabels: Record<number, string>
  onSetRating: (cedula: string, rating: number | null) => void
  disabled: boolean
}

function ClientRow({
  customer: c,
  ratingStyles,
  ratingLabels,
  onSetRating,
  disabled,
}: ClientRowProps) {
  const t = useThemeTokens()

  return (
    <tr className={`${t.rowHover} transition-colors`}>
      {/* Nombre con inicial circulada */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 font-display text-sm font-bold text-emerald-500">
            {c.name.charAt(0).toUpperCase()}
          </span>
          <div>
            <p className="font-medium leading-tight">{c.name}</p>
            {c.lastEventDate && (
              <p className={`text-xs ${t.textMuted}`}>
                Último: {formatDateLong(String(c.lastEventDate))}
              </p>
            )}
          </div>
        </div>
      </td>

      <td className="px-4 py-3 tabular-nums">{c.cedula || '—'}</td>

      <td className={`px-4 py-3 tabular-nums ${c.phone ? '' : t.textFaint}`}>
        {c.phone || '—'}
      </td>

      <td className={`px-4 py-3 ${c.email ? 'break-all' : t.textFaint}`}>
        {c.email || '—'}
      </td>

      <td className="px-4 py-3 text-center">
        <span className={`inline-flex min-w-[2rem] items-center justify-center rounded-full border px-2 py-0.5 text-xs font-semibold ${t.badgeEmerald}`}>
          {c.timesWorked}
        </span>
      </td>

      <td className="px-4 py-3 text-right font-medium tabular-nums">
        {formatCOP(c.totalPaid)}
      </td>

      {/* Selector de calificación */}
      <td className="px-4 py-3 text-center">
        <RatingCell
          rating={c.rating}
          ratingStyles={ratingStyles}
          ratingLabels={ratingLabels}
          onChange={(r) => onSetRating(c.cedula, r)}
          disabled={disabled}
        />
      </td>
    </tr>
  )
}

function RatingCell({
  rating,
  ratingStyles,
  ratingLabels,
  onChange,
  disabled,
}: {
  rating: number | null
  ratingStyles: Record<number, string>
  ratingLabels: Record<number, string>
  onChange: (rating: number | null) => void
  disabled: boolean
}) {
  const t = useThemeTokens()

  if (rating != null) {
    return (
      <button
        onClick={() => onChange(null)}
        disabled={disabled}
        title="Clic para quitar la calificación"
        className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium transition-all ${ratingStyles[rating]} hover:opacity-80 disabled:opacity-50`}
      >
        {ratingLabels[rating]}
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    )
  }

  return (
    <div className="flex items-center justify-center gap-1">
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          disabled={disabled}
          title={`Calificar como ${ratingLabels[n]}`}
          className={`flex h-6 w-6 items-center justify-center rounded-full border text-xs transition-colors ${t.border} ${t.textMuted} hover:border-emerald-500 hover:text-emerald-500 disabled:opacity-50`}
        >
          {n}
        </button>
      ))}
    </div>
  )
}
