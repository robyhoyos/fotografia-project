// src/renderer/src/App.tsx
// Componente raíz de la aplicación.
// Renderiza Layout con Sidebar y página activa.

import React, { useCallback, useEffect, useState } from 'react'
import { useUIStore, type AppView } from './stores/ui.store'
import { useAuthStore } from './stores/auth.store'
import { useThemeTokens } from './lib/theme'
import { Toaster } from './components/ui/Toaster'
import { ConfirmDialog } from './components/ui/ConfirmDialog'
import { Sidebar } from './components/layout/Sidebar'
import { EventsPage } from './pages/EventsPage'
import { StatsDashboard } from './components/dashboard/StatsDashboard'
import { BarcodeScanner } from './components/ui/BarcodeScanner'
import { EventDrawer } from './components/drawers/EventDrawer'
import { CsvImportDrawer } from './components/drawers/CsvImportDrawer'
import { SettingsPage } from './pages/SettingsPage'
import { AlertsPage } from './pages/AlertsPage'
import { ClientsPage } from './pages/ClientsPage'
import { LoginPage } from './pages/LoginPage'

function LoadingSplash() {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#0b0e0d]">
      <div className="flex flex-col items-center gap-4">
        <span className="relative flex h-3 w-3">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
        </span>
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-emerald-400">
          Portfolio Studio
        </p>
      </div>
    </div>
  )
}

export function App() {
  const authStatus = useAuthStore((s) => s.status)
  const checkSession = useAuthStore((s) => s.checkSession)

  useEffect(() => {
    checkSession()
  }, [checkSession])

  if (authStatus === 'loading') return <LoadingSplash />
  if (authStatus === 'setup') return <LoginPage mode="setup" />
  if (authStatus !== 'authenticated') return <LoginPage mode="login" />
  return <AppShell />
}

function AppShell() {
  const isAdmin = useAuthStore((s) => s.isAdmin)
  const {
    theme,
    scannerEventId,
    setScannerEventId,
    sidebarOpen,
    toggleSidebar,
    activeView,
    navigateTo,
    goBack,
    navStack,
    unsavedSettings,
    setUnsavedSettings,
  } = useUIStore()
  const t = useThemeTokens()
  const [eventsNavSeq, setEventsNavSeq] = useState(0)
  const [navConfirmTarget, setNavConfirmTarget] = useState<AppView | null>(null)

  const bgClass = t.pageBg
  const textClass = t.textPrimary

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.body.dataset.theme = theme
  }, [theme])

  // Al volver a la vista de Eventos, fuerza el remontaje (la página consume
  // `requestedEventId` para abrir el evento solicitado desde el dashboard).
  useEffect(() => {
    if (activeView === 'events') {
      setEventsNavSeq((s) => s + 1)
    }
  }, [activeView])

  // Guardia: al salir de Configuración con cambios sin guardar, pedir confirmación.
  const handleNavigate = useCallback((view: AppView) => {
    if (activeView === 'settings' && unsavedSettings && view !== 'settings') {
      setNavConfirmTarget(view)
      return
    }
    navigateTo(view)
  }, [activeView, unsavedSettings, navigateTo])

  const handleConfirmNavigation = () => {
    if (!navConfirmTarget) return
    setUnsavedSettings(false)
    navigateTo(navConfirmTarget)
    setNavConfirmTarget(null)
  }

  // "Atrás" global: recorre las vistas anteriores hasta la principal
  // (Gestión de Eventos). Respeta la guardia de cambios sin guardar.
  const handleGlobalBack = () => {
    if (activeView === 'settings' && unsavedSettings) {
      setNavConfirmTarget(navStack.length ? navStack[navStack.length - 1] : 'events')
      return
    }
    goBack()
  }

  return (
    <div className={`flex h-screen overflow-hidden ${bgClass} ${textClass}`}>
      <Sidebar activeView={activeView} onNavigate={handleNavigate} />

      <main className="flex-1 overflow-y-auto">
        {navStack.length > 0 && activeView !== 'events' && (
          <div className="px-8 pt-4">
            <button
              onClick={handleGlobalBack}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${t.btnGhost}`}
              title="Volver a la pantalla anterior"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7 7-7m8 14l-7-7 7-7" />
              </svg>
              Atrás
            </button>
          </div>
        )}

        {activeView === 'events' && <EventsPage key={eventsNavSeq} />}

        {activeView === 'scanner' && (
          <div className="px-8 py-6 space-y-6">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Escanear Código</h1>
              <p className={`mt-1 text-sm ${t.textMuted}`}>
                Escanea el código de barras de un participante para gestionar entregas
              </p>
            </div>
            {scannerEventId ? (
              <BarcodeScanner
                eventId={scannerEventId}
                onClose={() => setScannerEventId(null)}
              />
            ) : (
              <div className="text-center py-16">
                <p className={`${t.textMuted} text-sm`}>
                  Selecciona un evento primero desde la sección de Eventos
                </p>
                <button
                  onClick={() => navigateTo('events')}
                  className="mt-4 rounded-lg border-l-4 border-emerald-800 bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 transition-colors"
                >
                  Ir a Eventos
                </button>
              </div>
            )}
          </div>
        )}

        {activeView === 'dashboard' && (
          <div className="px-8 py-6">
            <StatsDashboard />
          </div>
        )}

        {activeView === 'alerts' && (
          <div className="px-8 py-6">
            <AlertsPage />
          </div>
        )}

        {isAdmin && activeView === 'clients' && <ClientsPage />}

        {isAdmin && activeView === 'settings' && <SettingsPage />}
      </main>

      <EventDrawer />
      <CsvImportDrawer />
      <Toaster />

      <ConfirmDialog
        isOpen={!!navConfirmTarget}
        title="Cambios sin guardar"
        message="Tienes cambios sin guardar en Configuración. Si sales ahora, se perderán."
        confirmLabel="Salir sin guardar"
        cancelLabel="Permanecer aquí"
        variant="warning"
        onConfirm={handleConfirmNavigation}
        onCancel={() => setNavConfirmTarget(null)}
      />

      {!sidebarOpen && (
        <button
          onClick={toggleSidebar}
          className={`fixed left-3 top-3 z-50 rounded-lg border p-2 transition-colors shadow-lg ${
            theme === 'dark'
              ? 'border-gray-700 bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              : 'border-gray-300 bg-white text-gray-600 hover:bg-gray-100 hover:text-gray-800'
          }`}
          title="Expandir sidebar"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </div>
  )
}
