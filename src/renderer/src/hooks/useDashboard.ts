// src/renderer/src/hooks/useDashboard.ts
// Hook para las estadísticas globales del dashboard.

import { useQuery } from '@tanstack/react-query'
import type { DashboardStatsInput } from '../../../../shared/schemas/stats.schema'

/**
 * @hook useDashboardStats
 * @description Obtiene las estadísticas globales del dashboard.
 * Los filtros forman parte de la queryKey → cambia automáticamente si se filtran fechas/categoría.
 */
export function useDashboardStats(params: DashboardStatsInput = {}) {
  return useQuery({
    queryKey: ['dashboard-stats', params],
    queryFn: async () => {
      const response = await window.api.dashboard.getStats(params)
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar estadísticas')
      }
      return response.data
    },
    staleTime: 15_000,
  })
}