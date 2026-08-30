// src/main/handlers/incident.handler.ts
// Handler IPC para el módulo de Alertas (incidencias + eventos próximos + recibos).

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import type { IncidentService } from '../services/incident.service'

const channels = IPC_CHANNELS.ALERTS

/**
 * @function registerIncidentHandlers
 * @description Registra los handlers IPC del módulo de Alertas.
 */
export function registerIncidentHandlers(service: IncidentService) {
  // ─── Resumen (incidencias + eventos próximos) ─────────────
  ipcMain.handle(channels.GET_INCIDENTS, async () => {
    try {
      const data = await service.getSummary()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Crear incidencia ────────────────────────────────────
  ipcMain.handle(channels.CREATE_INCIDENT, async (_event, payload?: unknown) => {
    try {
      const data = await service.createIncident((payload ?? {}) as never)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Actualizar incidencia (incluye resolver/reabrir por status) ─────
  ipcMain.handle(
    channels.UPDATE_INCIDENT,
    async (_event, id: string, payload?: unknown) => {
      try {
        const data = await service.updateIncident(id, (payload ?? {}) as never)
        return { success: true, data }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ─── Eliminar incidencia ─────────────────────────────────
  ipcMain.handle(channels.DELETE_INCIDENT, async (_event, id: string) => {
    try {
      const data = await service.deleteIncident(id)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Eventos próximos ────────────────────────────────────
  ipcMain.handle(channels.GET_UPCOMING_EVENTS, async () => {
    try {
      const summary = await service.getSummary()
      return { success: true, data: summary.upcomingEvents }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Cuentas por cobrar ──────────────────────────────────
  ipcMain.handle(channels.GET_RECEIVABLES, async () => {
    try {
      const data = await service.getReceivables()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
