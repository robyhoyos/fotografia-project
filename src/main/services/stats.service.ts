// src/main/services/stats.service.ts
// Service de estadísticas globales del dashboard.
// Delega el cálculo agregado al StatsRepository.

import { StatsRepository } from '../repositories/stats.repository'
import type { DashboardStatsParams } from '../../../shared/types/ipc'

export class StatsService {
  constructor(private repository: StatsRepository) {}

  async getStats(params: DashboardStatsParams = {}) {
    return this.repository.getStats(params)
  }
}