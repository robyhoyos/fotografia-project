// src/renderer/src/components/ui/Toaster.tsx
// Contenedor de notificaciones toast.
// Renderiza toasts con animaciones de entrada/salida.

import React from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useToast, type Toast, type ToastType } from '../../hooks/useToast'

function getToastStyles(type: ToastType, theme: 'dark' | 'light') {
  if (theme === 'light') {
    switch (type) {
      case 'success':
        return 'border-emerald-200 bg-emerald-50 text-emerald-800'
      case 'error':
        return 'border-red-200 bg-red-50 text-red-800'
      case 'warning':
        return 'border-amber-200 bg-amber-50 text-amber-800'
      case 'info':
        return 'border-blue-200 bg-blue-50 text-blue-800'
    }
  }
  switch (type) {
    case 'success':
      return 'border-emerald-500/30 bg-emerald-900/90 text-emerald-200'
    case 'error':
      return 'border-red-500/30 bg-red-900/90 text-red-200'
    case 'warning':
      return 'border-amber-500/30 bg-amber-900/90 text-amber-200'
    case 'info':
      return 'border-blue-500/30 bg-blue-900/90 text-blue-200'
  }
}

function getToastIcon(type: ToastType) {
  switch (type) {
    case 'success':
      return (
        <svg className="h-5 w-5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      )
    case 'error':
      return (
        <svg className="h-5 w-5 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      )
    case 'warning':
      return (
        <svg className="h-5 w-5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    case 'info':
      return (
        <svg className="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
  }
}

function ToastItem({
  toast,
  onRemove,
  theme,
}: {
  toast: Toast
  onRemove: (id: string) => void
  theme: 'dark' | 'light'
}) {
  return (
    <div
      className={`pointer-events-auto flex items-start gap-3 rounded-lg border px-4 py-3 shadow-2xl backdrop-blur-sm animate-slide-in ${getToastStyles(toast.type, theme)}`}
    >
      <div className="mt-0.5 shrink-0">{getToastIcon(toast.type)}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{toast.title}</p>
        {toast.message && (
          <p className="mt-0.5 text-xs opacity-80">{toast.message}</p>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        className="shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  )
}

export function Toaster() {
  const { toasts, removeToast } = useToast()
  const theme = useUIStore((s) => s.theme)

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} theme={theme} />
      ))}
    </div>
  )
}
