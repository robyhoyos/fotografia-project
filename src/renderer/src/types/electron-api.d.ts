// src/renderer/src/types/electron-api.d.ts
// Declaración global de window.api para el Renderer.
// El preload expone esta API vía contextBridge; este archivo la define
// para que TypeScript conozca su forma sin importar electron.

import type {
  ApiResponse,
  EventWithParticipants,
  EventStats,
  DashboardStats,
  AlertsSummary,
  ReceivableItem,
  Incident,
  IncidentInput,
  CustomerSummary,
  AuthUser,
  UserRecord,
  ListEventsResponse,
  ListParticipantsResponse,
  ParticipantItem,
  BulkUpdateResult,
  BulkDeleteResult,
  ImportCsvResult,
  ParticipantPayments,
  PaymentCorrectionResult,
  LogoInfo,
  StoredEvent,
  StoredPayment,
  ExportXlsxResult,
} from '../../../../shared/types/ipc'
import type {
  CreateEventInput,
  UpdateEventInput,
  ListEventsInput,
} from '../../../../shared/schemas/event.schema'
import type {
  CreateParticipantInput,
  UpdateParticipantInput,
  ListParticipantsInput,
  BulkUpdateStatusInput,
  BulkUpdatePaymentInput,
  BulkDeleteInput,
  ImportCsvInput,
} from '../../../../shared/schemas/participant.schema'

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
        getAll: (payload: ListEventsInput) => Promise<ApiResponse<ListEventsResponse>>
        getById: (payload: { id: string }) => Promise<ApiResponse<EventWithParticipants | null>>
        create: (payload: CreateEventInput) => Promise<ApiResponse<StoredEvent>>
        update: (payload: UpdateEventInput) => Promise<ApiResponse<StoredEvent>>
        delete: (payload: { id: string }) => Promise<ApiResponse<null>>
        getStats: (payload: { eventId: string }) => Promise<ApiResponse<EventStats>>
      }
      participants: {
        getByEvent: (payload: ListParticipantsInput) => Promise<ApiResponse<ListParticipantsResponse>>
        getById: (payload: { id: string }) => Promise<ApiResponse<ParticipantItem & { event?: { id: string; name: string; date: string; location: string | null; coverPrice: number } | null } | null>>
        getByBarcode: (payload: { barcode: string }) => Promise<ApiResponse<ParticipantItem & { event?: { id: string; name: string; date: string; location: string | null; coverPrice: number } | null } | null>>
        create: (payload: CreateParticipantInput) => Promise<ApiResponse<ParticipantItem>>
        update: (payload: UpdateParticipantInput) => Promise<ApiResponse<ParticipantItem>>
        delete: (payload: { id: string }) => Promise<ApiResponse<null>>
        bulkUpdateStatus: (payload: BulkUpdateStatusInput) => Promise<ApiResponse<BulkUpdateResult>>
        bulkUpdatePayment: (payload: BulkUpdatePaymentInput) => Promise<ApiResponse<BulkUpdateResult>>
        bulkDelete: (payload: BulkDeleteInput) => Promise<ApiResponse<BulkDeleteResult>>
        importCsv: (payload: ImportCsvInput) => Promise<ApiResponse<ImportCsvResult>>
      }
      customers: {
        list: () => Promise<ApiResponse<CustomerSummary[]>>
        setRating: (payload: { cedula: string; rating: number | null }) => Promise<ApiResponse<number>>
      }
      database: {
        backup: () => Promise<ApiResponse<{ path: string; size: string; lastBackupAt: string }>>
        restore: () => Promise<ApiResponse<{ size: string; safetyBackup: string }>>
        getInfo: () => Promise<ApiResponse<{ path: string; exists: boolean; size: string; sizeBytes: number; eventCount: number; participantCount: number; lastBackupAt: string | null }>>
      }
      payments: {
        create: (payload: { participantId: string; amount: number; method?: string | null; notes?: string | null }) => Promise<ApiResponse<StoredPayment>>
        findByParticipant: (payload: { participantId: string }) => Promise<ApiResponse<ParticipantPayments>>
        delete: (payload: { id: string }) => Promise<ApiResponse<{ deleted: boolean }>>
        correct: (payload: { participantId: string }) => Promise<ApiResponse<PaymentCorrectionResult>>
      }
      pdf: {
        generateReceipt: (payload: Record<string, unknown>) => Promise<ApiResponse<{ path: string }>>
      }
      export: {
        xlsxParticipants: (payload: { eventId: string }) => Promise<ApiResponse<ExportXlsxResult>>
      }
      settings: {
        getAll: () => Promise<ApiResponse<Record<string, Array<{ key: string; value: string; category: string; label: string; description: string | null }>>>>
        get: (key: string) => Promise<ApiResponse<string | null>>
        getMany: (keys: string[]) => Promise<ApiResponse<Record<string, string>>>
        set: (key: string, value: string) => Promise<ApiResponse<null>>
        setMany: (items: Array<{ key: string; value: string }>) => Promise<ApiResponse<null>>
        resetCategory: (category: string) => Promise<ApiResponse<null>>
        resetAll: () => Promise<ApiResponse<null>>
        setLogo: (dataUrl: string) => Promise<ApiResponse<null>>
        getLogo: () => Promise<ApiResponse<LogoInfo>>
        removeLogo: () => Promise<ApiResponse<null>>
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
        createIncident: (payload: IncidentInput) => Promise<ApiResponse<Incident>>
        updateIncident: (id: string, payload: IncidentInput) => Promise<ApiResponse<Incident>>
        deleteIncident: (id: string) => Promise<ApiResponse<boolean>>
        getUpcomingEvents: () => Promise<ApiResponse<AlertsSummary['upcomingEvents']>>
        getReceivables: () => Promise<ApiResponse<ReceivableItem[]>>
      }
      dialog: {
        pickDirectory: () => Promise<ApiResponse<string | null>>
      }
    }
  }
}

export {}
