// src/renderer/src/hooks/useToast.ts
// Sistema de notificaciones toast para feedback del usuario.
// Reemplaza window.confirm() y errores silenciosos.
//
// Usa un store Zustand global para que todos los componentes
// (drawers, páginas, handlers) compartan la misma lista de toasts
// y el <Toaster> singular montado en App.tsx pueda renderizarlos.

import { create } from 'zustand'
import { useCallback } from 'react'

export type ToastType = 'success' | 'error' | 'warning' | 'info'

export interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
  duration?: number
}

let toastId = 0

interface ToastStore {
  toasts: Toast[]
  addToast: (toast: Omit<Toast, 'id'>) => void
  removeToast: (id: string) => void
}

const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (toast) => {
    const id = `toast-${++toastId}`
    const newToast = { ...toast, id }
    set((state) => ({ toasts: [...state.toasts, newToast] }))

    setTimeout(() => {
      set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }))
    }, toast.duration || 4000)
  },
  removeToast: (id) =>
    set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}))

export function useToast() {
  const toasts = useToastStore((state) => state.toasts)

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>) => useToastStore.getState().addToast(toast),
    []
  )

  const removeToast = useCallback(
    (id: string) => useToastStore.getState().removeToast(id),
    []
  )

  const success = useCallback(
    (title: string, message?: string) => addToast({ type: 'success', title, message }),
    [addToast]
  )

  const error = useCallback(
    (title: string, message?: string) =>
      addToast({ type: 'error', title, message, duration: 6000 }),
    [addToast]
  )

  const warning = useCallback(
    (title: string, message?: string) => addToast({ type: 'warning', title, message }),
    [addToast]
  )

  const info = useCallback(
    (title: string, message?: string) => addToast({ type: 'info', title, message }),
    [addToast]
  )

  return { toasts, addToast, removeToast, success, error, warning, info }
}

// Funciones globales para usar fuera de componentes React.
// Como el estado vive en un store global, delegan directo al store
// y no dependen de un registro previo.

export function toastSuccess(title: string, message?: string) {
  useToastStore.getState().addToast({ type: 'success', title, message })
}

export function toastError(title: string, message?: string) {
  useToastStore.getState().addToast({ type: 'error', title, message, duration: 6000 })
}

export function toastWarning(title: string, message?: string) {
  useToastStore.getState().addToast({ type: 'warning', title, message })
}
