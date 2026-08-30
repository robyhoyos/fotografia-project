// src/renderer/src/hooks/usePayments.ts
// TanStack Query hooks para operaciones de pagos (ledger).
// Maneja caché, re-fetching y manejo de errores.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

// ─── Query Keys ─────────────────────────────────────────────────────

export const paymentKeys = {
  all: ['payments'] as const,
  byParticipant: (participantId: string) =>
    [...paymentKeys.all, 'participant', participantId] as const,
}

// ─── Hooks de Consulta ──────────────────────────────────────────────

/**
 * @hook usePaymentHistory
 * @description Historial de pagos de un participante específico.
 * Retorna pagos individuales + resumen de saldo.
 */
export function usePaymentHistory(participantId: string | null) {
  return useQuery({
    queryKey: paymentKeys.byParticipant(participantId ?? ''),
    queryFn: async () => {
      if (!participantId) return null
      const response = await window.api.payments.findByParticipant({ participantId })
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar historial de pagos')
      }
      return response.data
    },
    enabled: !!participantId,
    staleTime: 10_000,
  })
}

// ─── Mutaciones ─────────────────────────────────────────────────────

/**
 * @hook useCreatePayment
 * @description Registra un nuevo pago para un participante.
 * Invalida caché del historial y del participante.
 */
export function useCreatePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      participantId: string
      amount: number
      method?: string | null
      notes?: string | null
    }) => {
      const response = await window.api.payments.create(data)
      if (!response.success) {
        throw new Error(response.error || 'Error al registrar pago')
      }
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.byParticipant(variables.participantId),
      })
      queryClient.invalidateQueries({ queryKey: ['participants'] })
    },
  })
}

/**
 * @hook useDeletePayment
 * @description Elimina un pago registrado y recalcula el saldo.
 */
export function useDeletePayment() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: { id: string; participantId: string }) => {
      const response = await window.api.payments.delete({ id: data.id })
      if (!response.success) {
        throw new Error(response.error || 'Error al eliminar pago')
      }
      return response.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: paymentKeys.byParticipant(variables.participantId),
      })
      queryClient.invalidateQueries({ queryKey: ['participants'] })
    },
  })
}
