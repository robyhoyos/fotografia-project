// src/renderer/src/hooks/useExport.ts
// Hook para exportación de datos.

import { useMutation } from '@tanstack/react-query'

/**
 * @hook useExportXlsx
 * @description Exporta participantes de un evento a Excel (.xlsx) formateado.
 */
export function useExportXlsx() {
  return useMutation({
    mutationFn: async (eventId: string) => {
      const response = await window.api.export.xlsxParticipants({ eventId })
      if (!response.success) {
        throw new Error(response.error || 'Error al exportar Excel')
      }
      return response.data
    },
  })
}