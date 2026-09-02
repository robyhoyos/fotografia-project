// src/renderer/src/stores/auth.store.ts
// Zustand store para la sesión de autenticación del renderer.
//
// Mantiene el estado de autenticación reactivo para que la UI se adapte
// según el rol. La validación de seguridad real vive en el Main process
// (src/main/auth/permissions.ts); esta store solo refleja la sesión.

import { create } from 'zustand'
import type { AuthUser, AppRole } from '../../../../shared/types/ipc'

type AuthStatus = 'loading' | 'unauthenticated' | 'authenticated' | 'setup'

interface AuthState {
  status: AuthStatus
  user: AuthUser | null
  checkSession: () => Promise<void>
  login: (username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  setUser: (user: AuthUser) => void
  role: AppRole | null
  isAdmin: boolean
}

export const useAuthStore = create<AuthState>((set) => ({
  status: 'loading',
  user: null,
  role: null,
  isAdmin: false,

  // Verifica la sesión al arrancar: determina si mostrar login o primer arranque.
  checkSession: async () => {
    try {
      const current = await window.api.auth.getCurrent()
      if (current.success && current.data) {
        set({ status: 'authenticated', user: current.data, role: current.data.role, isAdmin: current.data.role === 'ADMIN' })
        return
      }

      const setup = await window.api.auth.isSetup()
      if (setup.success && !setup.data) {
        set({ status: 'setup', user: null, role: null, isAdmin: false })
        return
      }

      set({ status: 'unauthenticated', user: null, role: null, isAdmin: false })
    } catch {
      set({ status: 'unauthenticated', user: null, role: null, isAdmin: false })
    }
  },

  login: async (username, password) => {
    const res = await window.api.auth.login({ username, password })
    if (!res.success || !res.data) {
      throw new Error(res.error || 'No se pudo iniciar sesión')
    }
    set({ status: 'authenticated', user: res.data, role: res.data.role, isAdmin: res.data.role === 'ADMIN' })
  },

  logout: async () => {
    await window.api.auth.logout()
    set({ status: 'unauthenticated', user: null, role: null, isAdmin: false })
  },

  setUser: (user) =>
    set({ user, role: user.role, isAdmin: user.role === 'ADMIN' }),
}))
