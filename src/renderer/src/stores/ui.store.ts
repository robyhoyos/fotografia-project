// src/renderer/src/stores/ui.store.ts
// Zustand store para estado global de UI.
// Maneja tema, sidebar, drawers y selección múltiple.

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ParticipantSummary, EventWithParticipants } from '../../../../shared/types/ipc'

export type AppView = 'events' | 'scanner' | 'dashboard' | 'alerts' | 'clients' | 'settings'

interface UIState {
  theme: 'dark' | 'light'
  toggleTheme: () => void

  sidebarOpen: boolean
  toggleSidebar: () => void
  setSidebarOpen: (open: boolean) => void

  activeView: AppView
  setActiveView: (view: AppView) => void

  // Pilas de navegación: permite que "Atrás" recorra las pantallas
  // anteriores hasta volver a la página principal (Gestión de Eventos).
  navStack: AppView[]
  navigateTo: (view: AppView) => void
  goBack: () => void

  selectedEventId: string | null
  setSelectedEventId: (id: string | null) => void

  requestedEventId: string | null
  requestEvent: (id: string) => void
  consumeRequestedEvent: () => void

  unsavedSettings: boolean
  setUnsavedSettings: (value: boolean) => void

  activeDrawer: {
    type:
      | 'participant-detail'
      | 'participant-edit'
      | 'participant-create'
      | 'event-edit'
      | 'import-csv'
      | 'payment'
      | null
    data?: ParticipantSummary | EventWithParticipants | { eventId: string; coverPrice?: number } | null
  }
  openDrawer: (
    type: UIState['activeDrawer']['type'],
    data?: UIState['activeDrawer']['data']
  ) => void
  closeDrawer: () => void

  selectedParticipantIds: string[]
  setSelectedParticipantIds: (ids: string[]) => void
  toggleParticipantSelection: (id: string) => void
  selectAllParticipants: (ids: string[]) => void
  clearSelection: () => void

  scannerEventId: string | null
  setScannerEventId: (id: string | null) => void
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      theme: 'dark',
      toggleTheme: () =>
        set((state) => ({
          theme: state.theme === 'dark' ? 'light' : 'dark',
        })),

      sidebarOpen: true,
      toggleSidebar: () =>
        set((state) => ({ sidebarOpen: !state.sidebarOpen })),
      setSidebarOpen: (open) => set({ sidebarOpen: open }),

      activeView: 'events',
      setActiveView: (view) => set({ activeView: view }),

      // navigateTo: cambia de vista y apila la anterior para poder retroceder.
      // Al salir de la vista de eventos se limpia el evento seleccionado
      // (mismo comportamiento que el remontaje actual).
      navStack: [],
      navigateTo: (view) =>
        set((state) => {
          if (view === state.activeView) return {}
          return {
            activeView: view,
            navStack: [...state.navStack, state.activeView].filter(
              (v): v is AppView => v !== undefined
            ),
            selectedEventId: view !== 'events' ? null : state.selectedEventId,
          }
        }),
      goBack: () =>
        set((state) => {
          const stack = [...state.navStack]
          const prev = stack.pop()
          if (!prev) {
            return {
              activeView: 'events',
              navStack: [],
              selectedEventId: null,
            }
          }
          return { activeView: prev, navStack: stack }
        }),

      selectedEventId: null,
      setSelectedEventId: (id) => set({ selectedEventId: id }),

      requestedEventId: null,
      requestEvent: (id) => set({ requestedEventId: id }),
      consumeRequestedEvent: () => set({ requestedEventId: null }),

      unsavedSettings: false,
      setUnsavedSettings: (value) => set({ unsavedSettings: value }),

      activeDrawer: { type: null },
      openDrawer: (type, data) =>
        set({ activeDrawer: { type, data } }),
      closeDrawer: () =>
        set({ activeDrawer: { type: null } }),

      selectedParticipantIds: [],
      setSelectedParticipantIds: (ids) =>
        set({ selectedParticipantIds: ids }),
      toggleParticipantSelection: (id) =>
        set((state) => {
          const isSelected = state.selectedParticipantIds.includes(id)
          return {
            selectedParticipantIds: isSelected
              ? state.selectedParticipantIds.filter((i) => i !== id)
              : [...state.selectedParticipantIds, id],
          }
        }),
      selectAllParticipants: (ids) =>
        set({ selectedParticipantIds: ids }),
      clearSelection: () =>
        set({ selectedParticipantIds: [] }),

      scannerEventId: null,
      setScannerEventId: (id) => set({ scannerEventId: id }),
    }),
    {
      name: 'photo-app-ui',
      partialize: (state) => ({
        theme: state.theme,
        sidebarOpen: state.sidebarOpen,
      }),
    }
  )
)
