// src/renderer/src/hooks/useParticipants.ts
// TanStack Query hooks para operaciones de participantes.
// Incluye hooks para CRUD, acciones en lote (HU-D6) e importación (HU-D5).
// Implementa Optimistic UI en las mutaciones frecuentes.

import {
  useQuery,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query'
import type {
  CreateParticipantInput,
  UpdateParticipantInput,
  ListParticipantsInput,
  BulkUpdateStatusInput,
  BulkUpdatePaymentInput,
  BulkDeleteInput,
  ImportCsvInput,
} from '../../../../shared/schemas/participant.schema'
import { eventKeys } from './useEvents'

// ─── Query Keys ─────────────────────────────────────────────────────

export const participantKeys = {
  all: ['participants'] as const,
  byEvent: (eventId: string) =>
    [...participantKeys.all, 'event', eventId] as const,
  listByEvent: (params: ListParticipantsInput) =>
    [...participantKeys.byEvent(params.eventId), params] as const,
  detail: (id: string) =>
    [...participantKeys.all, 'detail', id] as const,
  barcode: (barcode: string) =>
    [...participantKeys.all, 'barcode', barcode] as const,
}

// ─── Hooks de Consulta ──────────────────────────────────────────────

/**
 * @hook useParticipants
 * @description Lista participantes de un evento con filtros y paginación.
 *
 * @param {ListParticipantsInput} params - Parámetros de filtrado
 * @returns Query result con participantes paginados
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useParticipants({
 *   eventId: 'abc123',
 *   page: 1,
 *   pageSize: 50,
 *   status: 'PENDIENTE',
 * })
 * ```
 */
export function useParticipants(params: ListParticipantsInput) {
  return useQuery({
    queryKey: participantKeys.listByEvent(params),
    queryFn: async () => {
      const response = await window.api.participants.getByEvent(params)
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar participantes')
      }
      return response.data
    },
    staleTime: 15_000,
    gcTime: 5 * 60_000,
  })
}

/**
 * @hook useParticipant
 * @description Obtiene un participante con datos del evento padre.
 */
export function useParticipant(id: string | null) {
  return useQuery({
    queryKey: participantKeys.detail(id ?? ''),
    queryFn: async () => {
      if (!id) return null
      const response = await window.api.participants.getById({ id })
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar participante')
      }
      return response.data
    },
    enabled: !!id,
    staleTime: 30_000,
  })
}

/**
 * @hook useParticipantByBarcode
 * @description Búsqueda por código de barras (escáner de entrega).
 * Se ejecuta cuando el usuario escanea o ingresa un código.
 */
export function useParticipantByBarcode(barcode: string | null) {
  return useQuery({
    queryKey: participantKeys.barcode(barcode ?? ''),
    queryFn: async () => {
      if (!barcode) return null
      const response = await window.api.participants.getByBarcode({
        barcode,
      })
      if (!response.success) {
        throw new Error(response.error || 'Participante no encontrado')
      }
      return response.data
    },
    enabled: !!barcode && barcode.length >= 5,
    staleTime: 0, // siempre buscar fresco (código de barras)
  })
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/**
 * @hook useCreateParticipant
 * @description Mutación para crear un participante individual.
 */
export function useCreateParticipant() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: CreateParticipantInput) => {
      const response = await window.api.participants.create(data)
      if (!response.success) {
        throw new Error(response.error || 'Error al crear participante')
      }
      return response.data
    },
    onSuccess: (_data, variables) => {
      // Invalidar lista del evento y stats
      queryClient.invalidateQueries({
        queryKey: participantKeys.byEvent(variables.eventId),
      })
      queryClient.invalidateQueries({
        queryKey: eventKeys.stats(variables.eventId),
      })
    },
  })
}

/**
 * @hook useUpdateParticipant
 * @description Mutación para actualizar un participante.
 * Implementa Optimistic Update para cambios de estado frecuentes.
 *
 * @example
 * ```tsx
 * const updateMutation = useUpdateParticipant()
 *
 * // Cambiar estado de entrega:
 * updateMutation.mutate({
 *   id: participant.id,
 *   status: 'ENTREGADO',
 *   deliveredAt: new Date().toISOString(),
 * })
 * ```
 */
export function useUpdateParticipant(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: UpdateParticipantInput) => {
      const response = await window.api.participants.update(data)
      if (!response.success) {
        throw new Error(response.error || 'Error al actualizar participante')
      }
      return response.data
    },
    // ─── Optimistic Update ──────────────────────────────────
    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: participantKeys.byEvent(eventId),
      })

      // Snapshot anterior para rollback
      const previousQueryData = queryClient.getQueriesData({
        queryKey: participantKeys.byEvent(eventId),
      })

      // Actualizar optimísticamente cada query que liste este evento
      queryClient.setQueriesData(
        { queryKey: participantKeys.byEvent(eventId) },
        (old: any) => {
          if (!old?.items) return old
          return {
            ...old,
            items: old.items.map((p: any) =>
              p.id === newData.id ? { ...p, ...newData } : p
            ),
          }
        }
      )

      return { previousQueryData }
    },
    onError: (_err, _newData, context) => {
      // Rollback: restaurar datos anteriores
      if (context?.previousQueryData) {
        for (const [key, data] of context.previousQueryData) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      // Refrescar desde el servidor
      queryClient.invalidateQueries({
        queryKey: participantKeys.byEvent(eventId),
      })
      queryClient.invalidateQueries({
        queryKey: eventKeys.stats(eventId),
      })
    },
  })
}

/**
 * @hook useDeleteParticipant
 * @description Elimina un participante individual.
 */
export function useDeleteParticipant(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await window.api.participants.delete({ id })
      if (!response.success) {
        throw new Error(response.error || 'Error al eliminar participante')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: participantKeys.byEvent(eventId),
      })
      queryClient.invalidateQueries({
        queryKey: eventKeys.stats(eventId),
      })
    },
  })
}

// ─── Mutaciones Bulk (HU-D6) ────────────────────────────────────────

/**
 * @hook useBulkUpdateStatus
 * @description Cambio masivo de estado de entrega para múltiples participantes.
 *
 * Optimistic UI Strategy:
 * 1. Actualiza el estado de todos los seleccionados en caché local
 * 2. Envía bulkUpdateStatus() por IPC
 * 3. Si falla → invalida caché y refresca desde DB
 * 4. Si éxito → los datos ya están correctos
 *
 * @example
 * ```tsx
 * const bulkMutation = useBulkUpdateStatus(eventId)
 *
 * // Marcar 50 participantes como ENTREGADO en un clic:
 * bulkMutation.mutate({
 *   participantIds: selectedIds,
 *   status: 'ENTREGADO',
 * })
 * ```
 */
export function useBulkUpdateStatus(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BulkUpdateStatusInput) => {
      const response = await window.api.participants.bulkUpdateStatus(data)
      if (!response.success) {
        throw new Error(response.error || 'Error en actualización masiva')
      }
      return response.data
    },
    onMutate: async (newData) => {
      await queryClient.cancelQueries({
        queryKey: participantKeys.byEvent(eventId),
      })

      const previousQueryData = queryClient.getQueriesData({
        queryKey: participantKeys.byEvent(eventId),
      })

      // Optimistic: actualizar todos los IDs seleccionados
      queryClient.setQueriesData(
        { queryKey: participantKeys.byEvent(eventId) },
        (old: any) => {
          if (!old?.items) return old
          return {
            ...old,
            items: old.items.map((p: any) =>
              newData.participantIds.includes(p.id)
                ? {
                    ...p,
                    status: newData.status,
                    ...(newData.status === 'ENTREGADO' && {
                      deliveredAt: new Date().toISOString(),
                    }),
                  }
                : p
            ),
          }
        }
      )

      return { previousQueryData }
    },
    onError: (_err, _newData, context) => {
      if (context?.previousQueryData) {
        for (const [key, data] of context.previousQueryData) {
          queryClient.setQueryData(key, data)
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: participantKeys.byEvent(eventId),
      })
      queryClient.invalidateQueries({
        queryKey: eventKeys.stats(eventId),
      })
    },
  })
}

/**
 * @hook useBulkDelete
 * @description Eliminación masiva de participantes.
 */
export function useBulkDelete(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BulkDeleteInput) => {
      const response = await window.api.participants.bulkDelete(data)
      if (!response.success) {
        throw new Error(response.error || 'Error en eliminación masiva')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: participantKeys.byEvent(eventId),
      })
      queryClient.invalidateQueries({
        queryKey: eventKeys.stats(eventId),
      })
    },
  })
}

/**
 * @hook useImportCsv
 * @description Importación masiva desde CSV/Excel (HU-D5).
 */
export function useImportCsv(eventId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: ImportCsvInput) => {
      const response = await window.api.participants.importCsv(data)
      if (!response.success) {
        throw new Error(response.error || 'Error en importación')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: participantKeys.byEvent(eventId),
      })
      queryClient.invalidateQueries({
        queryKey: eventKeys.stats(eventId),
      })
    },
  })
}
