// src/main/handlers/stats.handler.ts
// Handler IPC para las estadísticas globales del dashboard.

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import { DashboardStatsSchema } from '../../../shared/schemas/stats.schema'
import type { StatsService } from '../services/stats.service'

const channels = IPC_CHANNELS.DASHBOARD

export function registerStatsHandlers(statsService: StatsService) {
  ipcMain.handle(channels.GET_STATS, async (_, payload?: unknown) => {
    try {
      const params = DashboardStatsSchema.parse(payload ?? {})
      const data = await statsService.getStats(params)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}