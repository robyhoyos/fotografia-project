// shared/schemas/stats.schema.ts
// Schemas Zod para las estadísticas globales del dashboard.
// Validan los filtros antes de consultar la base de datos en el Main process.

import { z } from 'zod'
import { EventCategorySchema } from './event.schema'

export const DashboardStatsSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  category: EventCategorySchema.optional(),
})

export type DashboardStatsInput = z.infer<typeof DashboardStatsSchema>