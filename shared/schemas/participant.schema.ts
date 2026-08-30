// shared/schemas/participant.schema.ts
// Schemas Zod para validación de participantes.
// Cubre creación individual, actualización, acciones en lote (HU-D6)
// e importación masiva (HU-D5).

import { z } from 'zod'

// ─── Validación de teléfono colombiano ───────────────────────────────
// Acepta celular (10 dígitos, inicia en 3) o fijo/convencional (7-10
// dígitos iniciando en 1-8), con o sin prefijo nacional (+57 / 0057 / 57)
// y tolerando espacios, guiones y paréntesis típicos del ingreso manual.

export function isValidColombianPhone(raw: string | null | undefined): boolean {
  if (!raw) return false
  const n = raw.replace(/[\s\-()]/g, '')
  const local = n.replace(/^(?:\+?57|0057)/, '')
  if (local.length < 7 || local.length > 10) return false
  if (/^3\d{9}$/.test(local)) return true // celular 3XXXXXXXXX
  if (/^[1-8]\d{6,9}$/.test(local)) return true // fijo 7-10 dígitos
  return false
}

export const CO_PHONE_MESSAGE =
  'Teléfono colombiano inválido: ej. 3001234567 (cel) o 6012345678 (fijo), con/sin +57'

// 

export const ParticipantStatusSchema = z.enum([
  'PENDIENTE',
  'EN_PROCESO',
  'ENTREGADO',
  'CANCELADO',
])

export const PaymentStatusSchema = z.enum([
  'SIN_PAGO',
  'PAGO_PARCIAL',
  'PAGO_TOTAL',
])

// ─── Schema: Ítem del Detalle de Compra ─────────────────────────────

/**
 * @schema PurchaseItemSchema
 * @description Ítem individual del "Detalle de Compra" (patrón carrito).
 * { id, descripcion, cantidad, precio_unitario, subtotal }
 */
export const PurchaseItemSchema = z.object({
  id: z.string(),
  descripcion: z
    .string()
    .max(200, 'Descripción demasiado larga')
    .trim()
    .default(''),
  cantidad: z.number().int().min(0).max(999).default(1),
  precio_unitario: z.number().min(0).max(99999999).default(0),
  subtotal: z.number().min(0).default(0),
})

export type PurchaseItemInput = z.infer<typeof PurchaseItemSchema>

// ─── Schema: Crear Participante ─────────────────────────────────────

/**
 * @schema CreateParticipantSchema
 * @description Validación para registro individual de participante.
 *
 * Flujo:
 * 1. Usuario abre drawer de creación → llena formulario
 * 2. Frontend valida → window.api.participants.create(payload)
 * 3. Main re-valida con Zod → ParticipantService.create()
 * 4. ParticipantRepository.create() → SQLite INSERT
 *
 * El detalle de compra se almacena como un array de ítems (`items`).
 * Los campos `quantity` y `unitPrice` se conservan por compatibilidad,
 * y representan el primer ítem o el paquete base del participante.
 */
export const CreateParticipantSchema = z.object({
  eventId: z.string().cuid('ID de evento inválido'),
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(200, 'El nombre es demasiado largo')
    .trim(),
  cedula: z
    .string()
    .min(4, 'La cédula es obligatoria (mínimo 4 dígitos)')
    .max(12, 'La cédula debe tener máximo 12 dígitos')
    .regex(/^[0-9]+$/, 'La cédula debe contener solo dígitos')
    .trim(),
  phone: z
    .string()
    .min(1, 'El teléfono es obligatorio')
    .trim()
    .refine(isValidColombianPhone, CO_PHONE_MESSAGE),
  email: z
    .string()
    .trim()
    .email('Email inválido')
    .nullable()
    .optional(),
  notes: z.string().max(500).nullable().optional(),
  quantity: z.number().int().min(1).max(999).default(1),
  unitPrice: z.number().min(0).nullable().optional(),
  items: z.array(PurchaseItemSchema).max(100).optional(),
})

export type CreateParticipantInput = z.infer<typeof CreateParticipantSchema>

// ─── Schema: Actualizar Participante ────────────────────────────────

export const UpdateParticipantSchema = CreateParticipantSchema.omit({
  eventId: true,
}).partial().extend({
  id: z.string().cuid(),
  status: ParticipantStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  paidAmount: z.number().min(0).optional(),
  deliveredAt: z.string().datetime().nullable().optional(),
})

export type UpdateParticipantInput = z.infer<typeof UpdateParticipantSchema>

// ─── Schema: Acciones en Lote (HU-D6) ──────────────────────────────

/**
 * @schema BulkUpdateStatusSchema
 * @description Cambio masivo de estado de entrega.
 * Se ejecuta cuando el usuario selecciona múltiples participantes
 * y usa la barra flotante de acciones masivas.
 *
 * Flujo Optimistic UI:
 * 1. UI actualiza estados localmente (instantáneo)
 * 2. Envia bulkUpdateStatus() por IPC
 * 3. Si falla → rollback del estado local
 * 4. Si éxito → confirma el cambio
 */
export const BulkUpdateStatusSchema = z.object({
  participantIds: z
    .array(z.string().cuid())
    .min(1, 'Selecciona al menos un participante')
    .max(500, 'Máximo 500 participantes por operación'),
  status: ParticipantStatusSchema,
})

export type BulkUpdateStatusInput = z.infer<typeof BulkUpdateStatusSchema>

// ─── Schema: Actualización Masiva de Pagos ──────────────────────────

/**
 * @schema BulkUpdatePaymentSchema
 * @description Registro masivo de pagos para múltiples participantes.
 */
export const BulkUpdatePaymentSchema = z.object({
  participantIds: z
    .array(z.string().cuid())
    .min(1)
    .max(500),
  paymentStatus: PaymentStatusSchema,
  paidAmount: z.number().min(0).optional(),
})

export type BulkUpdatePaymentInput = z.infer<typeof BulkUpdatePaymentSchema>

// ─── Schema: Eliminación en Lote ────────────────────────────────────

export const BulkDeleteSchema = z.object({
  participantIds: z
    .array(z.string().cuid())
    .min(1)
    .max(500),
})

export type BulkDeleteInput = z.infer<typeof BulkDeleteSchema>

// ─── Schema: Importación CSV (HU-D5) ───────────────────────────────

/**
 * @schema ImportCsvSchema
 * @description Validación de datos parseados de CSV/Excel.
 * Cada fila del archivo se valida contra este schema antes de insertar.
 */
export const ImportCsvRowSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  cedula: z.string().regex(/^[0-9]{4,12}$/).nullable().optional(),
  phone: z
    .string()
    .nullable()
    .optional()
    .refine((v) => !v || isValidColombianPhone(v), CO_PHONE_MESSAGE),
  email: z.string().email('Email inválido').nullable().optional(),
  quantity: z.number().int().min(1).max(999).default(1),
})

export const ImportCsvSchema = z.object({
  eventId: z.string().cuid(),
  rows: z
    .array(ImportCsvRowSchema)
    .min(1, 'El archivo no contiene registros válidos')
    .max(1000, 'Máximo 1000 registros por importación'),
})

export type ImportCsvInput = z.infer<typeof ImportCsvSchema>
export type ImportCsvRow = z.infer<typeof ImportCsvRowSchema>

// ─── Schema: Puntuación de Cliente ───────────────────────────────────-

/**
 * @schema SetCustomerRatingSchema
 * @description Asigna la puntuación de un cliente (única por cédula).
 * rating: 1=Cuidado, 2=Regular, 3=Buena (null limpia la puntuación).
 */
export const SetCustomerRatingSchema = z.object({
  cedula: z
    .string()
    .min(4, 'Cédula inválida')
    .max(12)
    .regex(/^[0-9]+$/, 'Cédula inválida')
    .trim(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3)]).nullable(),
})

export type SetCustomerRatingInput = z.infer<typeof SetCustomerRatingSchema>

// ─── Schema: Listar Participantes ────────────────────────────────────

export const ListParticipantsSchema = z.object({
  eventId: z.string().cuid(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(50),
  search: z.string().max(100).optional(),
  status: ParticipantStatusSchema.optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  sortBy: z
    .enum(['name', 'status', 'paymentStatus', 'createdAt'])
    .default('name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
})

export type ListParticipantsInput = z.infer<typeof ListParticipantsSchema>
