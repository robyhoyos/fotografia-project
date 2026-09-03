// src/main/types/raw.ts
// Tipos RAW del Main process: describen lo que Prisma/Repository devuelve
// ANTES de la serialización por IPC (fechas como Date, items como JsonValue).
// Los handlers IPC usan estos tipos; el renderer usa los DTO serializados
// de `shared/types/ipc.ts` (fechas como string). El puente IPC convierte
// Date → ISO string de forma automática al cruzar contextBridge.

import type { PaginatedResponse } from '../../../shared/types/ipc'

/** Evento tal como lo devuelve Prisma (con conteo de participantes). */
export interface RawEvent {
  id: string
  name: string
  category: string
  subtype: string
  date: Date
  location: string | null
  notes: string | null
  coverPrice: number
  status: string
  createdAt: Date
  updatedAt: Date
  _count: { participants: number }
}

/** Respuesta de events:getAll en el Main. */
export type RawListEvents = PaginatedResponse<RawEvent>

/** Evento completo (con participantes) en el Main. */
export interface RawEventDetail extends RawEvent {
  participants: RawParticipant[]
}

/** Participante tal como lo devuelve Prisma (items crudos, fechas Date). */
export interface RawParticipant {
  id: string
  name: string
  cedula: string | null
  phone: string | null
  email: string | null
  notes: string | null
  quantity: number
  unitPrice: number | null
  items: unknown
  totalAmount: number
  status: string
  paymentStatus: string
  paidAmount: number
  deliveredAt: Date | null
  barcode: string | null
  rating: number | null
  createdAt: Date
  updatedAt: Date
  eventId: string
  event?: {
    id: string
    name: string
    date: Date
    location: string | null
    coverPrice: number
  } | null
}

/** Respuesta de participant:GET_BY_EVENT en el Main. */
export type RawListParticipants = PaginatedResponse<RawParticipant>

/** Pago tal como lo devuelve Prisma. */
export interface RawPayment {
  id: string
  participantId: string
  amount: number
  method: string | null
  notes: string | null
  createdAt: Date
}

/** Respuesta de payments:findByParticipant en el Main. */
export interface RawParticipantPayments {
  payments: RawPayment[]
  summary: {
    totalCost: number
    paidAmount: number
    outstanding: number
    paymentStatus: string
  }
}