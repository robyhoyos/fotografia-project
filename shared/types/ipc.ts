// shared/types/ipc.ts
// Definición tipada de todos los canales IPC disponibles.
// Este archivo es la "contrato" entre Main y Renderer.
// Cada canal tiene un request type y un response type.

/**
 * @module IPCChannels
 * @description Mapa centralizado de canales IPC.
 * Uso: window.api.events.getAll() → IPC → Main process handler
 *
 * Flujo de datos:
 * 1. Renderer llama a window.api.events.getAll()
 * 2. Preload.invoke('events:getAll') envía el mensaje al Main
 * 3. Main handler valida con Zod, ejecuta Repository, retorna resultado
 * 4. Renderer recibe resultado tipado y actualiza TanStack Query cache
 */
export const IPC_CHANNELS = {
  // ─── Autenticación y usuarios ─────────────────────────────
  AUTH: {
    SETUP_ADMIN: 'auth:setupAdmin',         // Primer arranque: crear admin inicial
    IS_SETUP: 'auth:isSetup',               // ¿Existe al menos un usuario?
    LOGIN: 'auth:login',                    // Iniciar sesión
    LOGOUT: 'auth:logout',                  // Cerrar sesión
    GET_CURRENT: 'auth:getCurrent',         // Usuario de la sesión activa
    CHANGE_PASSWORD: 'auth:changePassword', // Cambiar la propia contraseña
    CREATE_USER: 'auth:createUser',         // Crear usuario (solo ADMIN)
    LIST_USERS: 'auth:listUsers',           // Listar usuarios (solo ADMIN)
    TOGGLE_USER: 'auth:toggleUser',         // Activar/desactivar usuario (solo ADMIN)
  } as const,

  // ─── Eventos ──────────────────────────────────────────────
  EVENTS: {
    GET_ALL: 'events:getAll',
    GET_BY_ID: 'events:getById',
    CREATE: 'events:create',
    UPDATE: 'events:update',
    DELETE: 'events:delete',
    GET_STATS: 'events:getStats',
  } as const,

  // ─── Participantes ────────────────────────────────────────
  PARTICIPANTS: {
    GET_BY_EVENT: 'participants:getByEvent',
    GET_BY_ID: 'participants:getById',
    CREATE: 'participants:create',
    UPDATE: 'participants:update',
    DELETE: 'participants:delete',
    BULK_UPDATE_STATUS: 'participants:bulkUpdateStatus',
    BULK_UPDATE_PAYMENT: 'participants:bulkUpdatePayment',
    BULK_DELETE: 'participants:bulkDelete',
    IMPORT_CSV: 'participants:importCsv',
    GET_BY_BARCODE: 'participants:getByBarcode',
  } as const,

  // ─── Clientes (vista agregada por cédula) ─────────────────
  CUSTOMERS: {
    LIST: 'customers:list',
    SET_RATING: 'customers:setRating',
  } as const,

  // ─── Base de Datos ───────────────────────────────────────
  DATABASE: {
    BACKUP: 'database:backup',
    RESTORE: 'database:restore',
    GET_INFO: 'database:getInfo',
  } as const,

  // ─── Pagos (Ledger) ──────────────────────────────────────
  PAYMENTS: {
    CREATE: 'payments:create',
    FIND_BY_PARTICIPANT: 'payments:findByParticipant',
    DELETE: 'payments:delete',
  } as const,

  // ─── PDF ──────────────────────────────────────────────────
  PDF: {
    GENERATE_RECEIPT: 'pdf:generateReceipt',
  } as const,

  // ─── Exportación ──────────────────────────────────────────
  EXPORT: {
    XLSX_PARTICIPANTS: 'export:xlsxParticipants',
  } as const,

  // ─── Configuración ──────────────────────────────────────
  SETTINGS: {
    GET_ALL: 'settings:getAll',
    GET: 'settings:get',
    GET_MANY: 'settings:getMany',
    SET: 'settings:set',
    SET_MANY: 'settings:setMany',
    RESET_CATEGORY: 'settings:resetCategory',
    RESET_ALL: 'settings:resetAll',
  } as const,

  // ─── Dashboard ───────────────────────────────────────────
  DASHBOARD: {
    GET_STATS: 'dashboard:getStats',
  } as const,

  // ─── Alertas (Incidencias + eventos próximos) ─────────────
  ALERTS: {
    GET_INCIDENTS: 'alerts:getIncidents',
    CREATE_INCIDENT: 'alerts:createIncident',
    UPDATE_INCIDENT: 'alerts:updateIncident',
    DELETE_INCIDENT: 'alerts:deleteIncident',
    GET_UPCOMING_EVENTS: 'alerts:getUpcomingEvents',
    GET_RECEIVABLES: 'alerts:getReceivables',
  } as const,

  // ─── Diálogos del sistema ─────────────────────────────────
  DIALOG: {
    PICK_DIRECTORY: 'dialog:pickDirectory',
  } as const,
} as const

// Tipos derivados para los canales
export type AuthChannel = typeof IPC_CHANNELS.AUTH
export type EventChannel = typeof IPC_CHANNELS.EVENTS
export type ParticipantChannel = typeof IPC_CHANNELS.PARTICIPANTS
export type CustomerChannel = typeof IPC_CHANNELS.CUSTOMERS
export type DatabaseChannel = typeof IPC_CHANNELS.DATABASE
export type PaymentChannel = typeof IPC_CHANNELS.PAYMENTS
export type PdfChannel = typeof IPC_CHANNELS.PDF
export type ExportChannel = typeof IPC_CHANNELS.EXPORT
export type SettingsChannel = typeof IPC_CHANNELS.SETTINGS
export type DashboardChannel = typeof IPC_CHANNELS.DASHBOARD
export type AlertsChannel = typeof IPC_CHANNELS.ALERTS
export type DialogChannel = typeof IPC_CHANNELS.DIALOG

/**
 * @interface ApiResponse<T>
 * @description Wrapper estándar para todas las respuestas IPC.
 * Facilita el manejo de errores en el Renderer de forma uniforme.
 */
export interface ApiResponse<T> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

/**
 * @enum AppRole
 * @description Roles de usuario de la aplicación.
 * - ADMIN: acceso total (gestionar, editar, eliminar, respaldos, configuración).
 * - AYUDANTE: solo lectura (puede ver eventos, participantes, dashboard y alertas).
 */
export type AppRole = 'ADMIN' | 'AYUDANTE'

/**
 * @interface AuthUser
 * @description Usuario autenticado (seguro de exponer al renderer).
 * NUNCA incluye el hash de contraseña.
 */
export interface AuthUser {
  id: string
  username: string
  role: AppRole
  displayName: string | null
}

/**
 * @interface UserRecord
 * @description Registro de usuario para administración (solo ADMIN).
 */
export interface UserRecord extends AuthUser {
  isActive: boolean
  createdAt: string
}

/**
 * @interface PaginatedResponse<T>
 * @description Respuesta paginada para listados grandes.
 */
export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

/**
 * @interface EventWithParticipants
 * @description Evento con sus participantes incluidos (para vista de detalle).
 */
export interface EventWithParticipants {
  id: string
  name: string
  category: string
  subtype: string
  date: string
  location: string | null
  notes: string | null
  coverPrice: number
  status: string
  createdAt: string
  updatedAt: string
  participants: ParticipantSummary[]
  _count: { participants: number }
}

/**
 * @interface PurchaseItem
 * @description Ítem del "Detalle de Compra" (patrón carrito/factura).
 * Cada participante puede tener múltiples ítems: Paquete Básico, Mug, Foto Extra, etc.
 */
export interface PurchaseItem {
  id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  subtotal: number
}

/**
 * @interface CustomerSummary
 * @description Cliente agregado por cédula. Un "cliente" es una persona
 * (cédula) que puede aparecer en varios eventos. Representa el listado
 * "clientes registrados con las veces que han trabajado conmigo".
 */
export interface CustomerSummary {
  cedula: string
  name: string
  phone: string | null
  email: string | null
  rating: number | null // 1=Cuidado, 2=Regular, 3=Buena
  timesWorked: number // nº de eventos distintos
  totalPaid: number // suma pagada en todos sus registros
  lastEventDate: Date | null
}

/**
 * @function computeItemsTotal
 * @description Suma los subtotales de todos los ítems del detalle de compra.
 * @param {PurchaseItem[]} items - Lista de ítems
 * @returns {number} Total a pagar
 */
export function computeItemsTotal(items: PurchaseItem[] = []): number {
  return items.reduce((sum, item) => sum + (item.subtotal || 0), 0)
}

/**
 * @interface ParticipantSummary
 * @description Resumen de participante para listados (sin campos sensibles).
 */
export interface ParticipantSummary {
  id: string
  name: string
  cedula: string | null
  phone: string | null
  email: string | null
  quantity: number
  unitPrice: number | null
  items: PurchaseItem[] | null
  totalAmount: number
  status: string
  paymentStatus: string
  paidAmount: number
  deliveredAt: string | null
  barcode: string | null
  notes?: string | null
  event?: {
    id: string
    name: string
    date: string
    location: string | null
    coverPrice: number
  } | null
}

/**
 * @interface EventStats
 * @description Estadísticas agregadas de un evento para dashboard.
 */
export interface EventStats {
  totalParticipants: number
  delivered: number
  pending: number
  totalRevenue: number
  collected: number
  outstanding: number
}

/**
 * @interface DashboardStatsParams
 * @description Filtros opcionales para las estadísticas globales del dashboard.
 */
export interface DashboardStatsParams {
  dateFrom?: string
  dateTo?: string
  category?: 'SACRAMENTAL' | 'ESCOLAR' | 'ESTUDIO'
}

/**
 * @interface DashboardCategoryStats
 * @description Métricas agregadas por categoría de evento.
 */
export interface DashboardCategoryStats {
  category: string
  events: number
  participants: number
  delivered: number
  revenue: number
  collected: number
  outstanding: number
}

/**
 * @interface DashboardMonthlyStats
 * @description Serie mensual de ingresos y cobros.
 */
export interface DashboardMonthlyStats {
  month: string
  label: string
  revenue: number
  collected: number
}

/**
 * @interface DashboardStats
 * @description Estadísticas globales calculadas en el Main process.
 */
export interface DashboardStats {
  totalEvents: number
  activeEvents: number
  totalParticipants: number
  delivered: number
  pending: number
  cancelled: number
  totalRevenue: number
  collected: number
  outstanding: number
  byCategory: DashboardCategoryStats[]
  monthly: DashboardMonthlyStats[]
  lastEvents: EventWithParticipants[]
}

/**
 * @interface Incident
 * @description Incidencia o pendiente operativo (equipo dañado, accesorio por
 * comprar, tarea) con estado editable/resoluble.
 */
export interface Incident {
  id: string
  title: string
  description: string | null
  type: 'EQUIPO_DANADO' | 'ACCESORIO_POR_COMPRAR' | 'PENDIENTE'
  status: 'ABIERTA' | 'RESUELTA'
  eventId: string | null
  eventName: string | null
  dueDate: string | null
  createdAt: string
  updatedAt: string
}

/**
 * @interface IncidentInput
 * @description Payload de creación/actualización de una incidencia.
 */
export interface IncidentInput {
  id?: string
  title?: string
  description?: string | null
  type?: 'EQUIPO_DANADO' | 'ACCESORIO_POR_COMPRAR' | 'PENDIENTE'
  status?: 'ABIERTA' | 'RESUELTA'
  eventId?: string | null
  dueDate?: string | null
}

/**
 * @interface UpcomingEvent
 * @description Evento próximo para el aviso de alertas.
 */
export interface UpcomingEvent {
  id: string
  name: string
  category: string
  subtype: string
  date: string
  location: string | null
  participantCount: number
}

/**
 * @interface ReceivableItem
 * @description Cuenta por cobrar global: participante con saldo pendiente.
 */
export interface ReceivableItem {
  participantId: string
  participantName: string
  phone: string | null
  eventId: string
  eventName: string
  eventDate: string
  totalDue: number
  paidAmount: number
  outstanding: number
}

/**
 * @interface AlertsSummary
 * @description Resumen agregado para la vista de Alertas.
 */
export interface AlertsSummary {
  upcomingEvents: UpcomingEvent[]
  openIncidents: number
  totalIncidents: number
  incidents: Incident[]
}
