// shared/schemas/event.schema.ts
// Schemas Zod para validación de eventos en ambos lados (Main y Renderer).
// Previene payloads maliciosos o incompletos antes de tocar la base de datos.

import { z } from 'zod'

// ─── Enums sincronizados con Prisma ──────────────────────────────────

export const EventCategorySchema = z.enum([
  'SACRAMENTAL',
  'ESCOLAR',
  'ESTUDIO',
  'VASOS_Y_CAMISETAS',
  'BODAS_Y_15',
  'MARKETING_DIGITAL',
])

export const EventSubtypeSchema = z.enum([
  // Sacramental
  'BODA',
  'COMUNION',
  'BAUTIZO',
  'CONFIRMACION',
  // Escolar
  'RETRATO_GRUPO',
  'ANUARIO',
  'GRADUACION',
  // Estudio
  'RETRATO_FAMILIAR',
  'RETRATO_INDIVIDUAL',
  'BOOK_FOTOGRAFICO',
  'EVENTO_CORPORATIVO',
  // Vasos y Camisetas
  'VASOS',
  'CAMISETAS',
  // Bodas y 15 años
  'QUINCE',
  // Marketing Digital
  'VIDEO',
  'DISENO',
  'FOTOGRAFIA',
  'CORPORATIVO',
])

// ─── Labels de categorías y subtipos (fuente única para la UI) ───────

export const EventCategoryLabels: Record<string, string> = {
  SACRAMENTAL: 'Sacramental',
  ESCOLAR: 'Escolar',
  ESTUDIO: 'Estudio',
  VASOS_Y_CAMISETAS: 'Vasos y Camisetas',
  BODAS_Y_15: 'Bodas y 15 años',
  MARKETING_DIGITAL: 'Marketing Digital',
}

export const EventSubtypeLabels: Record<string, string> = {
  BODA: 'Boda',
  COMUNION: 'Comunión',
  BAUTIZO: 'Bautizo',
  CONFIRMACION: 'Confirmación',
  RETRATO_GRUPO: 'Retrato Grupo',
  ANUARIO: 'Anuario',
  GRADUACION: 'Graduación',
  RETRATO_FAMILIAR: 'Retrato Familiar',
  RETRATO_INDIVIDUAL: 'Retrato Individual',
  BOOK_FOTOGRAFICO: 'Book Fotográfico',
  EVENTO_CORPORATIVO: 'Evento Corporativo',
  VASOS: 'Vasos',
  CAMISETAS: 'Camisetas',
  QUINCE: 'Quince años',
  VIDEO: 'Video',
  DISENO: 'Diseño',
  FOTOGRAFIA: 'Fotografía',
  CORPORATIVO: 'Corporativo',
}

// ─── Schema: Crear Evento ───────────────────────────────────────────

/**
 * @schema CreateEventSchema
 * @description Validación para la creación de un nuevo evento.
 * Ejecuta en: Main handler (events:create) y Renderer (formulario)
 *
 * Flujo:
 * 1. Usuario llena formulario → valida CreateEventSchema
 * 2. Serializa a JSON → window.api.events.create(payload)
 * 3. Main handler re-valida con CreateEventSchema.parse()
 * 4. EventService.create() → EventRepository.create()
 */
export const CreateEventSchema = z.object({
  name: z
    .string()
    .min(3, 'El nombre debe tener al menos 3 caracteres')
    .max(200, 'El nombre no puede exceder 200 caracteres')
    .trim(),
  category: EventCategorySchema,
  subtype: EventSubtypeSchema,
  date: z.string().datetime({ message: 'Fecha inválida' }),
  location: z.string().max(300).nullable().optional(),
  notes: z.string().max(1000).nullable().optional(),
  coverPrice: z
    .number()
    .min(0, 'El precio no puede ser negativo')
    .max(99999999, 'Precio excesivo'),
})

export type CreateEventInput = z.infer<typeof CreateEventSchema>

// ─── Schema: Actualizar Evento ──────────────────────────────────────

/**
 * @schema UpdateEventSchema
 * @description Todos los campos opcionales para actualización parcial.
 */
export const UpdateEventSchema = CreateEventSchema.partial().extend({
  id: z.string().cuid(),
  status: z.enum(['ACTIVO', 'FINALIZADO', 'CANCELADO']).optional(),
})

export type UpdateEventInput = z.infer<typeof UpdateEventSchema>

// ─── Schema: Listar Eventos ─────────────────────────────────────────

export const ListEventsSchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  category: EventCategorySchema.optional(),
  search: z.string().max(100).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(['name', 'date', 'createdAt']).default('date'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
})

export type ListEventsInput = z.infer<typeof ListEventsSchema>

// ─── Subtipos válidos por categoría ──────────────────────────────────

/**
 * @function getSubtypesByCategory
 * @description Retorna los subtipos válidos para una categoría dada.
 * Usado en el frontend para el selector condicional (HU-B4).
 */
export const CategorySubtypeMap: Record<string, string[]> = {
  SACRAMENTAL: ['BODA', 'COMUNION', 'BAUTIZO', 'CONFIRMACION'],
  ESCOLAR: ['RETRATO_GRUPO', 'ANUARIO', 'GRADUACION'],
  ESTUDIO: [
    'RETRATO_FAMILIAR',
    'RETRATO_INDIVIDUAL',
    'BOOK_FOTOGRAFICO',
    'EVENTO_CORPORATIVO',
  ],
  VASOS_Y_CAMISETAS: ['VASOS', 'CAMISETAS'],
  BODAS_Y_15: ['BODA', 'QUINCE'],
  MARKETING_DIGITAL: ['VIDEO', 'DISENO', 'FOTOGRAFIA', 'CORPORATIVO'],
}
