// src/renderer/src/hooks/useSettings.ts
// Hooks para configuraciones de la aplicación.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface SettingItem {
  key: string
  value: string
  category: string
  label: string
  description: string | null
}

/**
 * @function flattenSettings
 * @description Aplana las configuraciones agrupadas a un mapa key → SettingItem.
 */
export function useSettingValue(key: string, fallback = ''): string {
  const { data } = useSettings()
  if (!data) return fallback
  for (const categoryItems of Object.values(data)) {
    const found = categoryItems.find((s) => s.key === key)
    if (found) return found.value
  }
  return fallback
}

/**
 * @hook usePaymentMethods
 * @description Obtiene la lista de métodos de pago configurados,
 * tomando un fallback coherente mientras cargan las settings.
 */
export function usePaymentMethods(): string[] {
  const fallback = 'Efectivo,Transferencia bancaria,Nequi,Daviplata,Otro'
  const raw = useSettingValue('payment_methods', fallback)
  // Normaliza y elimina duplicados (por ejemplo "Daviplata" guardado dos veces),
  // evitando keys repetidas en selects y chips que generan warnings de React.
  return Array.from(
    new Set(
      raw
        .split(',')
        .map((m) => m.trim())
        .filter(Boolean)
    )
  )
}

/**
 * @hook useSettings
 * @description Obtiene todas las configuraciones agrupadas por categoría.
 */
export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const response = await window.api.settings.getAll()
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar configuraciones')
      }
      return response.data as Record<string, SettingItem[]>
    },
  })
}

/**
 * @hook useSetting
 * @description Obtiene una configuración individual.
 */
export function useSetting(key: string) {
  return useQuery({
    queryKey: ['settings', key],
    queryFn: async () => {
      const response = await window.api.settings.get(key)
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar configuración')
      }
      return response.data as string | null
    },
  })
}

/**
 * @hook useUpdateSetting
 * @description Actualiza una configuración individual.
 */
export function useUpdateSetting() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await window.api.settings.set(key, value)
      if (!response.success) {
        throw new Error(response.error || 'Error al guardar configuración')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

/**
 * @hook useUpdateSettings
 * @description Actualiza múltiples configuraciones en lote.
 */
export function useUpdateSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (items: Array<{ key: string; value: string }>) => {
      const response = await window.api.settings.setMany(items)
      if (!response.success) {
        throw new Error(response.error || 'Error al guardar configuraciones')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}

/**
 * @hook useResetSettings
 * @description Restaura configuraciones a valores por defecto.
 */
export function useResetSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (category?: string) => {
      const response = category
        ? await window.api.settings.resetCategory(category)
        : await window.api.settings.resetAll()
      if (!response.success) {
        throw new Error(response.error || 'Error al restaurar configuraciones')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] })
    },
  })
}
