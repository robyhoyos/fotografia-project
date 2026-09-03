// src/renderer/src/hooks/useEvents.ts
// TanStack Query hooks para operaciones de eventos.
// Maneja caché, re-fetching, optimistic updates y manejo de errores.
//
// Ventajas sobre useEffect + useState:
// - Caché automático (no re-fetch si los datos son recientes)
// - Re-fetch en window focus (vuelve de otra pestaña)
// - Reconnection automatica
// - Mutaciones con rollback en error
// - Optimistic updates nativas

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsInput,
} from '../../../../shared/schemas/event.schema'
import type { EventWithParticipants } from '../../../../shared/types/ipc'

// ─── Query Keys ─────────────────────────────────────────────────────
// Centralizadas para facilitar invalidación de caché

export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (params: ListEventsInput) =>
    [...eventKeys.lists(), params] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
  stats: (eventId: string) =>
    [...eventKeys.all, 'stats', eventId] as const,
}

// ─── Hooks de Consulta ──────────────────────────────────────────────

/**
 * @hook useEvents
 * @description Lista eventos paginados con filtros.
 *
 * @param {ListEventsInput} params - Filtros y paginación
 * @returns Query result con eventos, loading state y error
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useEvents({
 *   page: 1,
 *   pageSize: 20,
 *   category: 'SACRAMENTAL',
 *   search: 'comunión',
 * })
 * ```
 */
export function useEvents(params: ListEventsInput) {
  return useQuery({
    queryKey: eventKeys.list(params),
    queryFn: async () => {
      const response = await window.api.events.getAll(params)
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar eventos')
      }
      return response.data
    },
    staleTime: 30_000, // 30 segundos antes de considerar stale
    gcTime: 5 * 60_000, // 5 minutos en caché
  })
}

/**
 * @hook useEvent
 * @description Obtiene un evento con todos sus participantes.
 *
 * @param {string} id - CUID del evento
 * @returns Query result con evento detallado
 */
export function useEvent(id: string | null) {
  return useQuery({
    queryKey: eventKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null
      const response = await window.api.events.getById({ id })
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar evento')
      }
      return response.data
    },
    enabled: !!id,
    staleTime: 15_000,
  })
}

/**
 * @hook useEventStats
 * @description Estadísticas agregadas de un evento.
 */
export function useEventStats(eventId: string | null) {
  return useQuery({
    queryKey: eventKeys.stats(eventId ?? ''),
    queryFn: async () => {
      if (!eventId) return null
      const response = await window.api.events.getStats({ eventId })
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar estadísticas')
      }
      return response.data
    },
    enabled: !!eventId,
    staleTime: 10_000,
  })
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/**
 * @hook useCreateEvent
 * @description Mutación para crear un nuevo evento.
 *
 * Flujo:
 * 1. Invoca window.api.events.create() con payload validado
 * 2. Si éxito → invalida caché de listas → re-fetch automático
 * 3. Si error → retorna error al componente para mostrar toast
 */
export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateEventInput) => {
      const response = await window.api.events.create(data)
      if (!response.success) {
        throw new Error(response.error || 'Error al crear evento')
      }
      return response.data
    },
    onSuccess: () => {
      // Invalidar todas las listas de eventos para re-fetch
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
    },
  })
}

/**
 * @hook useUpdateEvent
 * @description Mutación para actualizar un evento existente.
 *
 * Optimistic Update:
 * 1. Actualiza la caché local ANTES de la petición IPC
 * 2. Si la petición falla → revierte el cambio
 * 3. Si éxito → los datos ya están correctos en UI
 */
export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateEventInput) => {
      const response = await window.api.events.update(data)
      if (!response.success) {
        throw new Error(response.error || 'Error al actualizar evento')
      }
      return response.data
    },
    onMutate: async (newData) => {
      // Cancelar queries en curso para evitar sobreescribir
      await queryClient.cancelQueries({
        queryKey: eventKeys.detail(newData.id),
      })

      // Guardar snapshot anterior para rollback
      const previousEvent = queryClient.getQueryData(
        eventKeys.detail(newData.id)
      )

      // Optimistic update
      queryClient.setQueryData(
        eventKeys.detail(newData.id),
        (old: EventWithParticipants) => ({ ...old, ...newData })
      )

      return { previousEvent }
    },
    onError: (_err, newData, context) => {
      // Rollback al estado anterior
      if (context?.previousEvent) {
        queryClient.setQueryData(
          eventKeys.detail(newData.id),
          context.previousEvent
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      // Siempre refrescar después de la mutación
      queryClient.invalidateQueries({
        queryKey: eventKeys.detail(variables.id),
      })
      queryClient.invalidateQueries({ queryKey: eventKeys.lists() })
    },
  })
}

/**
 * @hook useDeleteEvent
 * @description Mutación para eliminar un evento.
 */
export function useDeleteEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await window.api.events.delete({ id })
      if (!response.success) {
        throw new Error(response.error || 'Error al eliminar evento')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: eventKeys.all })
    },
  })
}
