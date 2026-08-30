// src/main/handlers/settings.handler.ts
// Handler IPC para configuraciones de la aplicación.

import { ipcMain } from 'electron'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import { SettingsService } from '../services/settings.service'

const channels = IPC_CHANNELS.SETTINGS

/**
 * @function registerSettingsHandlers
 * @description Registra los handlers IPC para configuraciones.
 */
export function registerSettingsHandlers(service: SettingsService) {
  // ─── Obtener todas las configuraciones ────────────────────
  ipcMain.handle(channels.GET_ALL, async () => {
    try {
      const data = await service.getAll()
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Obtener una configuración ───────────────────────────
  ipcMain.handle(channels.GET, async (_event, key: string) => {
    try {
      const value = await service.get(key)
      return { success: true, data: value }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Obtener múltiples configuraciones ───────────────────
  ipcMain.handle(channels.GET_MANY, async (_event, keys: string[]) => {
    try {
      const data = await service.getMany(keys)
      return { success: true, data }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Actualizar una configuración ────────────────────────
  ipcMain.handle(channels.SET, async (_event, key: string, value: string) => {
    try {
      await service.set(key, value)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Actualizar múltiples configuraciones ────────────────
  ipcMain.handle(
    channels.SET_MANY,
    async (_event, items: Array<{ key: string; value: string }>) => {
      try {
        await service.setMany(items)
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    }
  )

  // ─── Restaurar categoría ─────────────────────────────────
  ipcMain.handle(channels.RESET_CATEGORY, async (_event, category: string) => {
    try {
      await service.resetCategory(category)
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })

  // ─── Restaurar todo ──────────────────────────────────────
  ipcMain.handle(channels.RESET_ALL, async () => {
    try {
      await service.resetAll()
      return { success: true }
    } catch (err) {
      return { success: false, error: (err as Error).message }
    }
  })
}
