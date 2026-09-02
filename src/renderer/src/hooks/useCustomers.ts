// src/renderer/src/hooks/useCustomers.ts
// TanStack Query hooks para la vista agregada de clientes.
// Un "cliente" es una persona única por cédula con su historial de trabajo.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CustomerSummary } from '../../../../shared/types/ipc'

// ─── Query Keys ─────────────────────────────────────────────────────

export const customerKeys = {
  all: ['customers'] as const,
  list: () => [...customerKeys.all, 'list'] as const,
}

// ─── Hook de Consulta ──────────────────────────────────────────────

/**
 * @hook useCustomers
 * @description Lista todos los clientes registrados (únicos por cédula)
 * con nombre, cédula, teléfono, email y métricas de trabajo.
 *
 * @example
 * ```tsx
 * const { data, isLoading } = useCustomers()
 * ```
 */
export function useCustomers() {
  return useQuery({
    queryKey: customerKeys.list(),
    queryFn: async (): Promise<CustomerSummary[]> => {
      const response = await window.api.customers.list()
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar clientes')
      }
      return response.data ?? []
    },
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  })
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/**
 * @hook useSetCustomerRating
 * @description Asigna la calificación de un cliente (única por cédula).
 * Tras el éxito invalida el listado para refrescar los datos.
 */
export function useSetCustomerRating() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      cedula: string
      rating: number | null
    }) => {
      const response = await window.api.customers.setRating(data)
      if (!response.success) {
        throw new Error(response.error || 'Error al asignar calificación')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: customerKeys.list() })
    },
  })
}
