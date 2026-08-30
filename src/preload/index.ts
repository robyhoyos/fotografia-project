// src/preload/index.ts
// Puente de seguridad entre Main y Renderer.
// Expone una API tipada a través de contextBridge.
//
// @security
// - contextIsolation: true → Este script corre en un contexto aislado
// - nodeIntegration: false → NO se importa ningún módulo de Node.js
// - Solo expone invoke() para canales específicos y predefinidos
// - El Renderer solo puede llamar a window.api.xxx, nunca a ipcRenderer directamente

import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from '../../shared/types/ipc'

/**
 * @module preload
 * @description Puente de seguridad IPC para la aplicación fotográfica.
 *
 * Arquitectura de seguridad:
 * ```text
 * ┌─────────────────────────────────────────────────────────────┐
 * │  RENDERER (React)                                          │
 * │  Solo tiene acceso a window.api (inyectado por preload)   │
 * │  Nunca importa electron, fs, path, etc.                    │
 * └────────────────────────┬────────────────────────────────────┘
 *                          │ window.api.events.getAll()
 *                          ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │  PRELOAD (contextBridge)  ← ESTE ARCHIVO                  │
 * │  Expone API selectiva vía contextBridge.exposeInMainWorld  │
 * │  Solo permite invoke() en canales predefinidos             │
 * └────────────────────────┬────────────────────────────────────┘
 *                          │ ipcRenderer.invoke('events:getAll')
 *                          ▼
 * ┌─────────────────────────────────────────────────────────────┐
 * │  MAIN PROCESS (Electron)                                   │
 * │  ipcMain.handle() → Zod validation → Service → Repository  │
 * └─────────────────────────────────────────────────────────────┘
 * ```
 *
 * Cada método expuesto:
 * 1. Serializa el payload a JSON (automático por IPC)
 * 2. Envía al Main process por el canal específico
 * 3. Main process valida con Zod y ejecuta la lógica
 * 4. Retorna ApiResponse<T> al Renderer
 */
const api = {
  // ─── Eventos ────────────────────────────────────────────────

  events: {
    /**
     * @description Lista eventos paginados con filtros
     * @param payload - { page, pageSize, category?, search?, sortBy, sortOrder }
     * @returns ApiResponse<PaginatedResponse<Event>>
     */
    getAll: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.EVENTS.GET_ALL, payload),

    /**
     * @description Obtiene un evento con todos sus participantes
     * @param payload - { id: string }
     * @returns ApiResponse<EventWithParticipants | null>
     */
    getById: (payload: { id: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.EVENTS.GET_BY_ID, payload),

    /**
     * @description Crea un nuevo evento
     * @param payload - CreateEventInput validado por Zod
     * @returns ApiResponse<Event>
     */
    create: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.EVENTS.CREATE, payload),

    /**
     * @description Actualiza un evento existente
     * @param payload - UpdateEventInput (ID + campos parciales)
     * @returns ApiResponse<Event>
     */
    update: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.EVENTS.UPDATE, payload),

    /**
     * @description Elimina un evento y sus participantes (CASCADE)
     * @param payload - { id: string }
     * @returns ApiResponse<null>
     */
    delete: (payload: { id: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.EVENTS.DELETE, payload),

    /**
     * @description Estadísticas agregadas de un evento
     * @param payload - { eventId: string }
     * @returns ApiResponse<EventStats>
     */
    getStats: (payload: { eventId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.EVENTS.GET_STATS, payload),
  },

  // ─── Participantes ──────────────────────────────────────────

  participants: {
    /**
     * @description Lista participantes de un evento con filtros
     * @param payload - ListParticipantsInput
     * @returns ApiResponse<PaginatedResponse<Participant>>
     */
    getByEvent: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.PARTICIPANTS.GET_BY_EVENT, payload),

    /**
     * @description Obtiene un participante con datos del evento
     * @param payload - { id: string }
     * @returns ApiResponse<ParticipantWithEvent | null>
     */
    getById: (payload: { id: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.PARTICIPANTS.GET_BY_ID, payload),

    /**
     * @description Búsqueda por código de barras (escáner)
     * @param payload - { barcode: string }
     * @returns ApiResponse<ParticipantWithEvent | null>
     */
    getByBarcode: (payload: { barcode: string }) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.PARTICIPANTS.GET_BY_BARCODE,
        payload
      ),

    /**
     * @description Crea un participante individual
     * @param payload - CreateParticipantInput
     * @returns ApiResponse<Participant>
     */
    create: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.PARTICIPANTS.CREATE, payload),

    /**
     * @description Actualiza un participante
     * @param payload - UpdateParticipantInput
     * @returns ApiResponse<Participant>
     */
    update: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.PARTICIPANTS.UPDATE, payload),

    /**
     * @description Elimina un participante individual
     * @param payload - { id: string }
     * @returns ApiResponse<null>
     */
    delete: (payload: { id: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.PARTICIPANTS.DELETE, payload),

    /**
     * @description Cambio masivo de estado de entrega (HU-D6)
     * @param payload - BulkUpdateStatusInput { participantIds, status }
     * @returns ApiResponse<{ updated: number }>
     */
    bulkUpdateStatus: (payload: any) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.PARTICIPANTS.BULK_UPDATE_STATUS,
        payload
      ),

    /**
     * @description Actualización masiva de pagos
     * @param payload - BulkUpdatePaymentInput
     * @returns ApiResponse<{ updated: number }>
     */
    bulkUpdatePayment: (payload: any) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.PARTICIPANTS.BULK_UPDATE_PAYMENT,
        payload
      ),

    /**
     * @description Eliminación masiva de participantes
     * @param payload - BulkDeleteInput { participantIds }
     * @returns ApiResponse<{ deleted: number }>
     */
    bulkDelete: (payload: any) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.PARTICIPANTS.BULK_DELETE,
        payload
      ),

    /**
     * @description Importación masiva desde CSV/Excel (HU-D5)
     * @param payload - ImportCsvInput { eventId, rows }
     * @returns ApiResponse<{ imported, errors, total }>
     */
    importCsv: (payload: any) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.PARTICIPANTS.IMPORT_CSV,
        payload
      ),
  },

  // ─── Base de Datos ────────────────────────────────────────

  database: {
    /**
     * @description Crea un respaldo de la base de datos
     * @returns ApiResponse<{ path, size }>
     */
    backup: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DATABASE.BACKUP),

    /**
     * @description Restaura la base de datos desde un archivo
     * @returns ApiResponse<{ path, size }>
     */
    restore: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DATABASE.RESTORE),

    /**
     * @description Obtiene información de la base de datos
     * @returns ApiResponse<{ path, exists, size, eventCount, participantCount }>
     */
    getInfo: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DATABASE.GET_INFO),
  },

  // ─── Pagos (Ledger) ─────────────────────────────────────

  payments: {
    /**
     * @description Registra un pago individual para un participante
     * @param payload - { participantId, amount, method?, notes? }
     * @returns ApiResponse<Payment>
     */
    create: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.PAYMENTS.CREATE, payload),

    /**
     * @description Obtiene el historial de pagos de un participante
     * @param payload - { participantId: string }
     * @returns ApiResponse<{ payments, summary }>
     */
    findByParticipant: (payload: { participantId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.PAYMENTS.FIND_BY_PARTICIPANT, payload),

    /**
     * @description Elimina un pago y recalcula el saldo del participante
     * @param payload - { id: string }
     * @returns ApiResponse<{ deleted: boolean }>
     */
    delete: (payload: { id: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.PAYMENTS.DELETE, payload),
  },

  // ─── PDF ──────────────────────────────────────────────────

  pdf: {
    /**
     * @description Genera un recibo de pago en PDF
     * @param payload - ReceiptData con datos del evento, participante y pagos
     * @returns ApiResponse<{ path: string }>
     */
    generateReceipt: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.PDF.GENERATE_RECEIPT, payload),
  },

  // ─── Exportación ──────────────────────────────────────────

  export: {
    /**
     * @description Exporta participantes de un evento a Excel (.xlsx) formateado
     * @param payload - { eventId: string }
     * @returns ApiResponse<{ path: string, count: number }>
     */
    xlsxParticipants: (payload: { eventId: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT.XLSX_PARTICIPANTS, payload),
  },

  // ─── Configuración ──────────────────────────────────────

  settings: {
    /**
     * @description Obtiene todas las configuraciones agrupadas por categoría
     */
    getAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET_ALL),

    /**
     * @description Obtiene una configuración por su clave
     */
    get: (key: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET, key),

    /**
     * @description Obtiene múltiples configuraciones por sus claves
     */
    getMany: (keys: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.GET_MANY, keys),

    /**
     * @description Actualiza una configuración
     */
    set: (key: string, value: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET, key, value),

    /**
     * @description Actualiza múltiples configuraciones en lote
     */
    setMany: (items: Array<{ key: string; value: string }>) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.SET_MANY, items),

    /**
     * @description Restaura una categoría a sus valores por defecto
     */
    resetCategory: (category: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.RESET_CATEGORY, category),

    /**
     * @description Restaura todas las configuraciones a sus valores por defecto
     */
    resetAll: () =>
      ipcRenderer.invoke(IPC_CHANNELS.SETTINGS.RESET_ALL),
  },

  // ─── Dashboard ──────────────────────────────────────────

  dashboard: {
    /**
     * @description Estadísticas globales del dashboard con filtros opcionales
     * @param payload - DashboardStatsParams { dateFrom?, dateTo?, category? }
     * @returns ApiResponse<DashboardStats>
     */
    getStats: (payload?: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.DASHBOARD.GET_STATS, payload ?? {}),
  },

  // ─── Diálogos del sistema ───────────────────────────────

  dialog: {
    /**
     * @description Abre el diálogo nativo de selección de carpeta
     * @returns ApiResponse<string | null> (null si se cancela)
     */
    pickDirectory: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG.PICK_DIRECTORY),
  },

  // ─── Alertas (Incidencias + eventos próximos + recibos) ──

  alerts: {
    /**
     * @description Resumen de alertas: incidencias + eventos próximos
     * @returns ApiResponse<AlertsSummary>
     */
    getSummary: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERTS.GET_INCIDENTS),

    /**
     * @description Crea una nueva incidencia
     * @param payload - IncidentInput
     * @returns ApiResponse<Incident>
     */
    createIncident: (payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERTS.CREATE_INCIDENT, payload),

    /**
     * @description Actualiza una incidencia (incluye resolver/reabrir por status)
     * @param id - id de la incidencia
     * @param payload - IncidentInput
     * @returns ApiResponse<Incident>
     */
    updateIncident: (id: string, payload: any) =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERTS.UPDATE_INCIDENT, id, payload),

    /**
     * @description Elimina una incidencia
     * @param id - id de la incidencia
     * @returns ApiResponse<boolean>
     */
    deleteIncident: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERTS.DELETE_INCIDENT, id),

    /**
     * @description Eventos próximos para el aviso de alertas
     * @returns ApiResponse<UpcomingEvent[]>
     */
    getUpcomingEvents: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERTS.GET_UPCOMING_EVENTS),

    /**
     * @description Cuentas por cobrar globales (participantes con saldo pendiente)
     * @returns ApiResponse<ReceivableItem[]>
     */
    getReceivables: () =>
      ipcRenderer.invoke(IPC_CHANNELS.ALERTS.GET_RECEIVABLES),
  },
}

// ─── Exposición segura al Renderer ──────────────────────────────────

/**
 * @security Solo se expone el objeto `api` al Renderer.
 * El Renderer accede via: window.api.events.xxx() / window.api.participants.xxx()
 * Nunca tiene acceso a ipcRenderer, electron, fs, path, etc.
 */
contextBridge.exposeInMainWorld('api', api)

// Tipo TypeScript para window.api (para el Renderer)
export type ElectronAPI = typeof api
