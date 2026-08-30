// src/renderer/src/hooks/useAlerts.ts
// Hooks para el módulo de Alertas (incidencias, eventos próximos y cuentas por cobrar).

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AlertsSummary, IncidentInput, ReceivableItem } from '../../../../shared/types/ipc'

export function useAlertsSummary() {
  return useQuery({
    queryKey: ['alerts-summary'],
    queryFn: async () => {
      const response = await window.api.alerts.getSummary()
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar alertas')
      }
      return response.data as AlertsSummary
    },
    staleTime: 10_000,
  })
}

export function useReceivables() {
  return useQuery({
    queryKey: ['alerts-receivables'],
    queryFn: async () => {
      const response = await window.api.alerts.getReceivables()
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar cuentas por cobrar')
      }
      return response.data as ReceivableItem[]
    },
    staleTime: 15_000,
  })
}

export function useCreateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: IncidentInput) => {
      const response = await window.api.alerts.createIncident(input)
      if (!response.success) {
        throw new Error(response.error || 'Error al crear incidencia')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-summary'] })
    },
  })
}

export function useUpdateIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id: string; input: IncidentInput }) => {
      const response = await window.api.alerts.updateIncident(id, input)
      if (!response.success) {
        throw new Error(response.error || 'Error al actualizar incidencia')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-summary'] })
    },
  })
}

export function useDeleteIncident() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await window.api.alerts.deleteIncident(id)
      if (!response.success) {
        throw new Error(response.error || 'Error al eliminar incidencia')
      }
      return response.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['alerts-summary'] })
    },
  })
}