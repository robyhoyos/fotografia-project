// src/renderer/src/hooks/useUsers.ts
// Hooks para la gestión de usuarios y roles (solo ADMIN).
// La seguridad real está en el Main process (guardia requireAdmin);
// estos hooks solo facilitan la UI de administración de usuarios.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AuthUser, UserRecord, AppRole } from '../../../../shared/types/ipc'

/**
 * @hook useUsers
 * @description Lista los usuarios del sistema (solo ADMIN).
 */
export function useUsers() {
  return useQuery({
    queryKey: ['users'],
    queryFn: async (): Promise<UserRecord[]> => {
      const response = await window.api.auth.listUsers()
      if (!response.success) {
        throw new Error(response.error || 'Error al cargar usuarios')
      }
      return response.data as UserRecord[]
    },
  })
}

/**
 * @hook useCreateUser
 * @description Crea un nuevo usuario (ADMIN o AYUDANTE).
 */
export function useCreateUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: {
      username: string
      password: string
      role: AppRole
      displayName?: string | null
    }): Promise<AuthUser> => {
      const response = await window.api.auth.createUser(payload)
      if (!response.success) {
        throw new Error(response.error || 'Error al crear usuario')
      }
      return response.data as AuthUser
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}

/**
 * @hook useToggleUser
 * @description Activa/desactiva un usuario.
 */
export function useToggleUser() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: { userId: string; isActive: boolean }) => {
      const response = await window.api.auth.toggleUser(payload)
      if (!response.success) {
        throw new Error(response.error || 'Error al cambiar el estado del usuario')
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] })
    },
  })
}
