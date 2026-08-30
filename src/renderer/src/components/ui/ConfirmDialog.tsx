// src/renderer/src/components/ui/ConfirmDialog.tsx
// Diálogo de confirmación estilizado que reemplaza window.confirm().
// Diseño premium coherente con el tema Portfolio Fotográfico.

import React, { useEffect, useRef } from 'react'
import { useThemeTokens } from '../../lib/theme'

interface ConfirmDialogProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'warning' | 'info'
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null)
  const t = useThemeTokens()

  useEffect(() => {
    if (isOpen) {
      cancelRef.current?.focus()
      const handleEsc = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onCancel()
      }
      window.addEventListener('keydown', handleEsc)
      return () => window.removeEventListener('keydown', handleEsc)
    }
  }, [isOpen, onCancel])

  if (!isOpen) return null

  const confirmStyles = {
    danger: 'bg-red-600 hover:bg-red-500',
    warning: 'bg-amber-600 hover:bg-amber-500',
    info: 'bg-blue-600 hover:bg-blue-500',
  }

  return (
    <>
      <div
        className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-sm"
        onClick={onCancel}
      />
      <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
        <div className={`w-full max-w-md rounded-xl border shadow-2xl ${t.border} ${t.drawerBg}`}>
          <div className="px-6 py-5">
            <h3 className={`text-lg font-semibold ${t.textPrimary}`}>{title}</h3>
            <p className={`mt-2 text-sm ${t.textSecondary}`}>{message}</p>
          </div>
          <div className={`flex justify-end gap-3 border-t px-6 py-4 ${t.border}`}>
            <button
              ref={cancelRef}
              onClick={onCancel}
              className={`rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${t.btnGhost}`}
            >
              {cancelLabel}
            </button>
            <button
              onClick={onConfirm}
              className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${confirmStyles[variant]}`}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
