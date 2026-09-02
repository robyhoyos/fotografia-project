// src/renderer/src/types/electron-api.d.ts
// Declaración global de window.api para el Renderer.
// El preload expone esta API vía contextBridge; este archivo la define
// para que TypeScript conozca su forma sin importar electron.

import type { ApiResponse, EventWithParticipants, EventStats, DashboardStats, AlertsSummary, ReceivableItem, Incident, CustomerSummary, AuthUser, UserRecord } from '../../../../shared/types/ipc'

declare global {
  interface Window {
    api: {
      auth: {
        setupAdmin: (payload: { username: string; password: string; displayName?: string | null }) => Promise<ApiResponse<AuthUser>>
        isSetup: () => Promise<ApiResponse<boolean>>
        login: (payload: { username: string; password: string }) => Promise<ApiResponse<AuthUser>>
        logout: () => Promise<ApiResponse<null>>
        getCurrent: () => Promise<ApiResponse<AuthUser | null>>
        changePassword: (currentPassword: string, newPassword: string) => Promise<ApiResponse<null>>
        createUser: (payload: { username: string; password: string; role: 'ADMIN' | 'AYUDANTE'; displayName?: string | null }) => Promise<ApiResponse<AuthUser>>
        listUsers: () => Promise<ApiResponse<UserRecord[]>>
        toggleUser: (payload: { userId: string; isActive: boolean }) => Promise<ApiResponse<null>>
      }
      events: {
        getAll: (payload: any) => Promise<ApiResponse<any>>
        getById: (payload: { id: string }) => Promise<ApiResponse<EventWithParticipants | null>>
        create: (payload: any) => Promise<ApiResponse<any>>
        update: (payload: any) => Promise<ApiResponse<any>>
        delete: (payload: { id: string }) => Promise<ApiResponse<null>>
        getStats: (payload: { eventId: string }) => Promise<ApiResponse<EventStats>>
      }
      participants: {
        getByEvent: (payload: any) => Promise<ApiResponse<any>>
        getById: (payload: { id: string }) => Promise<ApiResponse<any>>
        getByBarcode: (payload: { barcode: string }) => Promise<ApiResponse<any>>
        create: (payload: any) => Promise<ApiResponse<any>>
        update: (payload: any) => Promise<ApiResponse<any>>
        delete: (payload: { id: string }) => Promise<ApiResponse<null>>
        bulkUpdateStatus: (payload: any) => Promise<ApiResponse<any>>
        bulkUpdatePayment: (payload: any) => Promise<ApiResponse<any>>
        bulkDelete: (payload: any) => Promise<ApiResponse<any>>
        importCsv: (payload: any) => Promise<ApiResponse<any>>
      }
      customers: {
        list: () => Promise<ApiResponse<CustomerSummary[]>>
        setRating: (payload: { cedula: string; rating: number | null }) => Promise<ApiResponse<{ updated: number }>>
      }
      database: {
        backup: () => Promise<ApiResponse<any>>
        restore: () => Promise<ApiResponse<any>>
        getInfo: () => Promise<ApiResponse<any>>
      }
      payments: {
        create: (payload: any) => Promise<ApiResponse<any>>
        findByParticipant: (payload: { participantId: string }) => Promise<ApiResponse<any>>
        delete: (payload: { id: string }) => Promise<ApiResponse<any>>
      }
      pdf: {
        generateReceipt: (payload: any) => Promise<ApiResponse<any>>
      }
      export: {
        xlsxParticipants: (payload: { eventId: string }) => Promise<ApiResponse<any>>
      }
      settings: {
        getAll: () => Promise<ApiResponse<any>>
        get: (key: string) => Promise<ApiResponse<any>>
        getMany: (keys: string[]) => Promise<ApiResponse<any>>
        set: (key: string, value: string) => Promise<ApiResponse<any>>
        setMany: (items: Array<{ key: string; value: string }>) => Promise<ApiResponse<any>>
        resetCategory: (category: string) => Promise<ApiResponse<any>>
        resetAll: () => Promise<ApiResponse<any>>
      }
      dashboard: {
        getStats: (params?: {
          dateFrom?: string
          dateTo?: string
          category?: string
        }) => Promise<ApiResponse<DashboardStats>>
      }
      alerts: {
        getSummary: () => Promise<ApiResponse<AlertsSummary>>
        createIncident: (payload: any) => Promise<ApiResponse<Incident>>
        updateIncident: (id: string, payload: any) => Promise<ApiResponse<Incident>>
        deleteIncident: (id: string) => Promise<ApiResponse<boolean>>
        getUpcomingEvents: () => Promise<ApiResponse<any>>
        getReceivables: () => Promise<ApiResponse<ReceivableItem[]>>
      }
      dialog: {
        pickDirectory: () => Promise<ApiResponse<string | null>>
      }
    }
  }
}

export {}
