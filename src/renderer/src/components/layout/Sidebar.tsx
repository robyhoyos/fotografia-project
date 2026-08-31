// src/renderer/src/components/layout/Sidebar.tsx
// Sidebar de navegación de la aplicación.
// Muestra secciones principales y permite navegar entre vistas.

import React, { useState } from 'react'
import { useUIStore } from '../../stores/ui.store'
import { useToast } from '../../hooks/useToast'
import { useSettingValue } from '../../hooks/useSettings'
import { useThemeTokens } from '../../lib/theme'
import { ConfirmDialog } from '../ui/ConfirmDialog'

type View = 'events' | 'scanner' | 'dashboard' | 'alerts' | 'settings'

interface SidebarProps {
  activeView: View
  onNavigate: (view: View) => void
}

const NAV_ITEMS: { id: View; label: string; icon: React.ReactNode }[] = [
  {
    id: 'events',
    label: 'Eventos',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
  {
    id: 'scanner',
    label: 'Escanear',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
      </svg>
    ),
  },
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'alerts',
    label: 'Alertas',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
      </svg>
    ),
  },
  {
    id: 'settings',
    label: 'Configuración',
    icon: (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
]

export function Sidebar({ activeView, onNavigate }: SidebarProps) {
  const { sidebarOpen, toggleSidebar } = useUIStore()
  const { success, error: toastError } = useToast()
  const t = useThemeTokens()
  const [dbLoading, setDbLoading] = useState(false)
  const [showRestoreConfirm, setShowRestoreConfirm] = useState(false)

  const businessName = useSettingValue('business_name', 'FotoApp')
  const businessTagline = useSettingValue('business_tagline', 'Gestión Fotográfica')

  if (!sidebarOpen) return null

  const bgClass = t.sidebarBg
  const borderClass = 'border-r border-gray-800/50'

  const handleBackup = async () => {
    setDbLoading(true)
    try {
      const result = await window.api.database.backup()
      if (result.success) {
        success('Respaldo creado', result.message || 'Archivo guardado exitosamente')
      } else {
        if (result.error !== 'Operación cancelada por el usuario') {
          toastError('Error al crear respaldo', result.error)
        }
      }
    } catch {
      toastError('Error inesperado', 'No se pudo crear el respaldo')
    } finally {
      setDbLoading(false)
    }
  }

  const handleRestore = async () => {
    setDbLoading(true)
    try {
      const result = await window.api.database.restore()
      if (result.success) {
        success('Restaurado', result.message || 'Base de datos restaurada')
        window.location.reload()
      } else {
        if (result.error !== 'Operación cancelada por el usuario') {
          toastError('Error al restaurar', result.error)
        }
      }
    } catch {
      toastError('Error inesperado', 'No se pudo restaurar la base de datos')
    } finally {
      setDbLoading(false)
      setShowRestoreConfirm(false)
    }
  }

  return (
    <aside className={`flex h-full w-56 flex-col ${bgClass} ${borderClass}`}>
      <div className="px-4 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <div>
              <p className="font-display text-base font-bold leading-tight text-white tracking-tight line-clamp-1">{businessName}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-widest line-clamp-1">{businessTagline}</p>
            </div>
          </div>
          <button
            onClick={toggleSidebar}
            className="rounded-md p-1 text-gray-500 hover:bg-gray-800 hover:text-white transition-colors"
            title="Colapsar sidebar"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          </button>
        </div>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = activeView === item.id
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`flex w-full items-center gap-3 rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? 'border-l-emerald-500 bg-emerald-500/15 text-emerald-400'
                  : 'border-l-transparent text-gray-400 hover:bg-gray-800/50 hover:text-white'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          )
        })}
      </nav>

      <div className="border-t border-gray-800/50 px-3 py-3 space-y-1">
        <button
          onClick={handleBackup}
          disabled={dbLoading}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          {dbLoading ? 'Procesando...' : 'Crear respaldo'}
        </button>
        <button
          onClick={() => setShowRestoreConfirm(true)}
          disabled={dbLoading}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium text-gray-400 hover:bg-gray-800/50 hover:text-white transition-colors disabled:opacity-50"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          {dbLoading ? 'Procesando...' : 'Restaurar respaldo'}
        </button>
      </div>

      <div className="border-t border-gray-800/50 px-4 py-4">
        <p className="text-[10px] text-gray-600 text-center">
          v1.0.0 — Portfolio Photography
        </p>
      </div>

      <ConfirmDialog
        isOpen={showRestoreConfirm}
        title="Restaurar respaldo"
        message="Se cerrará la conexión actual y se reemplazará con el archivo seleccionado. Los datos no respaldados se perderán."
        confirmLabel="Restaurar"
        variant="danger"
        onConfirm={handleRestore}
        onCancel={() => setShowRestoreConfirm(false)}
      />
    </aside>
  )
}
