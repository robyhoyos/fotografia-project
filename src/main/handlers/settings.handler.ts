// src/main/handlers/settings.handler.ts
// Handler IPC para configuraciones de la aplicación.

import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC_CHANNELS } from '../../../shared/types/ipc'
import { SettingsService } from '../services/settings.service'
import { requireAdmin } from '../auth/permissions'

const channels = IPC_CHANNELS.SETTINGS

// ─── Schemas de validación ──────────────────────────────────────────
const KeySchema = z.string().trim().min(1, 'La clave no puede estar vacía').max(100)
const ValueSchema = z.string().max(5000, 'El valor es demasiado largo')
const SettingItemSchema = z.object({ key: KeySchema, value: ValueSchema })
const SettingsItemsSchema = z.array(SettingItemSchema).min(1, 'Debes enviar al menos una configuración')
const CategorySchema = z.enum(['negocio', 'eventos', 'entregas'])

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
  ipcMain.handle(
    channels.SET,
    requireAdmin(async (_event, key: unknown, value: unknown) => {
      try {
        const input = z.tuple([KeySchema, ValueSchema]).parse([key, value])
        await service.set(input[0], input[1])
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    })
  )

  // ─── Actualizar múltiples configuraciones ────────────────
  ipcMain.handle(
    channels.SET_MANY,
    requireAdmin(async (_event, items: unknown) => {
      try {
        const parsed = SettingsItemsSchema.parse(items)
        await service.setMany(parsed)
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    })
  )

  // ─── Restaurar categoría ─────────────────────────────────
  ipcMain.handle(
    channels.RESET_CATEGORY,
    requireAdmin(async (_event, category: unknown) => {
      try {
        const parsed = CategorySchema.parse(category)
        await service.resetCategory(parsed)
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    })
  )

  // ─── Restaurar todo ──────────────────────────────────────
  ipcMain.handle(
    channels.RESET_ALL,
    requireAdmin(async () => {
      try {
        await service.resetAll()
        return { success: true }
      } catch (err) {
        return { success: false, error: (err as Error).message }
      }
    })
  )
}
